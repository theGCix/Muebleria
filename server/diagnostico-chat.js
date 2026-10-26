// Diagnóstico del chatbot: dice en español qué parte falla.
// Uso (desde la raíz del proyecto):
//   node server/diagnostico-chat.js                       → Ollama + modelo + agente
//   node server/diagnostico-chat.js http://localhost:3001 → además prueba tu servidor en marcha
// Usa las mismas variables OLLAMA_* que el chat (cárgalas igual que al arrancar el servidor).
import { crearModelo, ejecutarAgente } from "./chat.js";

const base = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const modelo = process.env.OLLAMA_MODEL ?? "qwen2.5:7b";
const limiteActual = Number(process.env.OLLAMA_TIMEOUT_MS ?? 60_000);
const urlServidor = process.argv[2]?.replace(/\/$/, "");

const seg = (t0) => ((performance.now() - t0) / 1000).toFixed(1);
let fallos = 0;
const bien = (t) => console.log(`✅ ${t}`);
const mal = (t, ayuda) => {
  fallos++;
  console.log(`❌ ${t}`);
  if (ayuda) console.log(`   → ${ayuda}`);
};
const aviso = (t, ayuda) => {
  console.log(`⚠️  ${t}`);
  if (ayuda) console.log(`   → ${ayuda}`);
};

/** Supabase falso con un solo producto: aísla Ollama y el agente de la base de datos. */
function supabaseFalso() {
  const respuesta = {
    data: [
      {
        id: "demo-1",
        nombre: "Mueble modelo Terra Comfort",
        categoria: "muebles",
        precio: 1650,
        stock: 1,
        tipo_gestion: "retail",
        sku: "TERRA-1",
        descripcion: "Sala de estilo contemporáneo",
      },
    ],
    error: null,
  };
  const b = new Proxy(
    {},
    { get: (_, p) => (p === "then" ? (ok, no) => Promise.resolve(respuesta).then(ok, no) : () => b) }
  );
  return { from: () => b };
}

console.log(`\nOllama: ${base} · modelo: ${modelo} · límite por turno: ${limiteActual / 1000} s\n`);

// 1) ¿Ollama responde?
let modelos = null;
try {
  const r = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  modelos = (await r.json()).models?.map((m) => m.name) ?? [];
  bien("Ollama responde.");
} catch (e) {
  mal(
    `No hay conexión con Ollama (${e.cause?.code ?? e.message}).`,
    "Inicia Ollama (abre la app o ejecuta `ollama serve`) y revisa OLLAMA_BASE_URL."
  );
}

// 2) ¿Está descargado el modelo?
if (modelos) {
  const hay = modelos.some((n) => n === modelo || n === `${modelo}:latest`);
  if (hay) bien(`El modelo ${modelo} está descargado.`);
  else mal(`El modelo ${modelo} no está descargado.`, `Ejecuta: ollama pull ${modelo}   (disponibles: ${modelos.join(", ") || "ninguno"})`);
}

// 3) y 4) Solo tiene sentido si Ollama y el modelo están bien.
if (modelos && modelos.some((n) => n === modelo || n === `${modelo}:latest`)) {
  try {
    const t0 = performance.now();
    await crearModelo().invoke("Responde solo: ok", { signal: AbortSignal.timeout(300_000) });
    const s = Number(seg(t0));
    bien(`El modelo genera texto (${s} s, incluye la carga en memoria).`);
    if (s * 1000 > limiteActual * 0.6) {
      aviso(`Tarda ${s} s y tu límite es ${limiteActual / 1000} s.`, "Sube OLLAMA_TIMEOUT_MS (por ejemplo 180000) o usa un modelo más chico.");
    }
  } catch (e) {
    mal(`El modelo no pudo generar texto: ${e.message}`, "Mira si Ollama muestra errores de memoria (RAM/VRAM insuficiente).");
  }

  try {
    process.env.OLLAMA_TIMEOUT_MS = "300000"; // aquí medimos el tiempo real, sin cortar
    const t0 = performance.now();
    const out = await ejecutarAgente({
      messages: [{ role: "user", content: "El mueble terra comfort cual es su precio?" }],
      supabaseAdmin: supabaseFalso(),
    });
    const s = Number(seg(t0));
    const tools = out.meta?.herramientas?.map((h) => h.nombre) ?? [];
    if (!tools.includes("buscar_productos")) {
      mal("El modelo no llamó a buscar_productos.", "Revisa que el modelo soporte herramientas (tools). Con qwen2.5:7b debería hacerlo.");
    } else if (!out.meta?.completado) {
      mal("El agente no llegó a una respuesta final.", "El modelo se quedó en un bucle de herramientas; prueba de nuevo o cambia de modelo.");
    } else {
      bien(`El agente con herramientas funciona (${s} s). Respuesta: «${out.reply}»`);
      if (s * 1000 > limiteActual) {
        mal(`Tardó ${s} s y tu límite es ${limiteActual / 1000} s: en el chat real se corta por tiempo.`, "Sube OLLAMA_TIMEOUT_MS a un valor mayor (por ejemplo 180000).");
      }
    }
  } catch (e) {
    mal(`El agente falló: ${e.message}`, "Ese texto es el error real; pégamelo.");
  }
}

// 5) Servidor en marcha (opcional)
if (urlServidor) {
  const explicar = (status) =>
    ({
      404: "La ruta no existe: ¿llamaste a registerChat en el servidor?",
      429: "Límite de mensajes por minuto: espera un momento.",
      503: "Ollama no disponible o se agotó el tiempo. Mira la consola del servidor.",
      500: "Error interno. En la consola del servidor debe aparecer «Error en /api/chat:».",
    })[status] ?? "";
  for (const ruta of ["/api/chat", "/api/chat/stream"]) {
    try {
      const t0 = performance.now();
      const r = await fetch(`${urlServidor}${ruta}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: "Hola" }] }),
        signal: AbortSignal.timeout(300_000),
      });
      const texto = (await r.text()).slice(0, 300).replace(/\s+/g, " ");
      if (r.ok && !texto.includes("event: error")) bien(`${ruta} responde ${r.status} (${seg(t0)} s): ${texto}`);
      else mal(`${ruta} → ${r.status}: ${texto}`, explicar(r.status) || "Mira la consola del servidor.");
    } catch (e) {
      mal(`${ruta}: no se pudo conectar a ${urlServidor} (${e.cause?.code ?? e.message}).`, "¿Está corriendo el servidor y es ese el puerto correcto?");
    }
  }
}

console.log(
  fallos === 0
    ? "\nTodo lo probado funciona. Si el chat sigue fallando, el problema está entre el navegador y el servidor (URL de la API, CORS o un proxy).\n"
    : `\n${fallos} problema(s) encontrados. Corrige el primero de la lista y vuelve a ejecutar.\n`
);
process.exit(fallos === 0 ? 0 : 1);