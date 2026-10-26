// Ejecutar: node --test server/
import { test } from "node:test";
import assert from "node:assert/strict";
import { AIMessage } from "@langchain/core/messages";
import {
  clasificarResultado,
  crearHerramientas,
  ejecutarAgente,
  guardarTurno,
  montosEn,
  montosSinVerificar,
  turnoSinResolver,
} from "./chat.js";

// ── Dobles de prueba ─────────────────────────────────────────

/**
 * Supabase falso: cada from(tabla) consume la siguiente respuesta de la cola de esa
 * tabla. El builder acepta cualquier cadena (.select().eq()…) y se puede `await`.
 */
function supabaseFalso(colas) {
  const builder = (respuesta) => {
    const b = new Proxy(
      {},
      {
        get: (_, prop) =>
          prop === "then"
            ? (ok, fallo) => Promise.resolve(respuesta).then(ok, fallo)
            : () => b,
      }
    );
    return b;
  };
  return {
    from: (tabla) => {
      const siguiente = colas[tabla]?.shift();
      if (siguiente === undefined) throw new Error(`Sin respuesta preparada para ${tabla}`);
      return builder(siguiente);
    },
  };
}

/** LLM falso que devuelve, en orden, los mensajes del guion. */
function llmFalso(guion) {
  let i = 0;
  return { bindTools: () => ({ invoke: async () => guion[i++] }) };
}

const llamarTool = (name, args, id = name) =>
  new AIMessage({ content: "", tool_calls: [{ name, args, id }] });

const producto = {
  id: "p1",
  nombre: "Sofá Milán",
  precio: 1200,
  stock: 3,
  tipo_gestion: "retail",
  activo: true,
  imagen_url: null,
  sku: "SOF-1",
};

/** Invoca una tool real con un Supabase falso y devuelve lo que ve el agente. */
async function correrTool(nombre, args, colas) {
  const tools = crearHerramientas({ supabaseAdmin: supabaseFalso(colas) }, { cartActions: [] });
  return tools.find((t) => t.name === nombre).invoke(args);
}

// ── clasificarResultado contra la salida REAL de cada tool ───

test("buscar_productos: con resultados → ok", async () => {
  const r = await correrTool("buscar_productos", { query: "sofá" }, { products: [{ data: [producto] }] });
  assert.equal(clasificarResultado(r), "ok");
});

test("buscar_productos: sin resultados (también en descripción) → vacio", async () => {
  const r = await correrTool("buscar_productos", { query: "piano" }, { products: [{ data: [] }, { data: [] }] });
  assert.equal(clasificarResultado(r), "vacio");
});

test("buscar_productos: fallo de BD → error", async () => {
  const r = await correrTool("buscar_productos", { query: "sofá" }, { products: [{ data: null, error: { message: "boom" } }] });
  assert.equal(clasificarResultado(r), "error");
});

test("consultar_pedido: no encontrado → vacio", async () => {
  const r = await correrTool(
    "consultar_pedido",
    { order_number: "GM-1", email: "a@b.com" },
    { orders: [{ data: null, error: null }] }
  );
  assert.equal(clasificarResultado(r), "vacio");
});

test("consultar_pedido: encontrado → ok", async () => {
  const r = await correrTool(
    "consultar_pedido",
    { order_number: "GM-1", email: "a@b.com" },
    { orders: [{ data: { id: "o1", order_number: "GM-1", status: "pagado" }, error: null }], order_items: [{ data: [] }] }
  );
  assert.equal(clasificarResultado(r), "ok");
});

test("agregar_al_carrito: producto inexistente o sin stock → error; con stock → ok", async () => {
  const noExiste = await correrTool("agregar_al_carrito", { product_id: "x", cantidad: 1 }, { products: [{ data: null, error: null }] });
  assert.equal(clasificarResultado(noExiste), "error");

  const sinStock = await correrTool("agregar_al_carrito", { product_id: "p1", cantidad: 5 }, { products: [{ data: producto, error: null }] });
  assert.equal(clasificarResultado(sinStock), "error");

  const ok = await correrTool("agregar_al_carrito", { product_id: "p1", cantidad: 1 }, { products: [{ data: producto, error: null }] });
  assert.equal(clasificarResultado(ok), "ok");
});

test("clasificarResultado: texto que no es JSON se asume ok", () => {
  assert.equal(clasificarResultado("hola"), "ok");
});

// ── Agente completo ──────────────────────────────────────────

const pregunta = [{ role: "user", content: "¿Tienen sofá cama?" }];

test("reintento exitoso: vacio y luego ok cuenta como resuelto", async () => {
  const out = await ejecutarAgente({
    messages: pregunta,
    supabaseAdmin: supabaseFalso({ products: [{ data: [] }, { data: [] }, { data: [producto] }] }),
    llm: llmFalso([
      llamarTool("buscar_productos", { query: "sofá cama xl" }, "1"),
      llamarTool("buscar_productos", { query: "sofá" }, "2"),
      new AIMessage("Tenemos el Sofá Milán a S/ 1200."),
    ]),
  });
  assert.deepEqual(
    out.meta.herramientas.map((h) => [h.resultado, h.consulta]),
    [["vacio", "sofá cama xl"], ["ok", "sofá"]]
  );
  assert.equal(turnoSinResolver({ out }), false);
});

test("búsqueda sin resultados y sin reintento exitoso → sin resolver", async () => {
  const out = await ejecutarAgente({
    messages: pregunta,
    supabaseAdmin: supabaseFalso({ products: [{ data: [] }, { data: [] }] }),
    llm: llmFalso([
      llamarTool("buscar_productos", { query: "sofá cama" }),
      new AIMessage("No tenemos ese producto por ahora."),
    ]),
  });
  assert.equal(out.meta.completado, true);
  assert.equal(turnoSinResolver({ out }), true);
});

test("el modelo agota los turnos sin responder → no completado y sin resolver", async () => {
  const llamadas = Array.from({ length: 4 }, (_, i) => llamarTool("buscar_productos", { query: "mesa" }, String(i)));
  const out = await ejecutarAgente({
    messages: pregunta,
    supabaseAdmin: supabaseFalso({ products: Array.from({ length: 4 }, () => ({ data: [producto] })) }),
    llm: llmFalso(llamadas),
  });
  assert.equal(out.meta.completado, false);
  assert.equal(turnoSinResolver({ out }), true);
});

test("privacidad: consultar_pedido no guarda correo ni nº de pedido en meta", async () => {
  const out = await ejecutarAgente({
    messages: [{ role: "user", content: "Mi pedido GM-77, correo ana@ejemplo.com" }],
    supabaseAdmin: supabaseFalso({ orders: [{ data: null, error: null }] }),
    llm: llmFalso([
      llamarTool("consultar_pedido", { order_number: "GM-77", email: "ana@ejemplo.com" }),
      new AIMessage("No encontré ese pedido, ¿puedes revisar los datos?"),
    ]),
  });
  assert.equal(out.meta.herramientas[0].resultado, "vacio");
  const guardado = JSON.stringify(out.meta);
  assert.ok(!guardado.includes("ana@ejemplo.com"));
  assert.ok(!guardado.includes("GM-77"));
});

// ── Precios sin respaldo del catálogo ────────────────────────

test("montosEn: formatos de soles", () => {
  assert.deepEqual(montosEn("Cuesta S/ 1200."), [1200]);
  assert.deepEqual(montosEn("S/1,200.50 o 1.200 soles"), [1200.5, 1200]);
  assert.deepEqual(montosEn("S/. 99,9"), [99.9]);
  assert.deepEqual(montosEn("Garantía de 2 años, 3 colores"), []);
});

test("montosSinVerificar: acepta precio del catálogo, múltiplos, sumas y montos ya citados", () => {
  const preciosTools = [1200, 800];
  const ok = (reply, historial = []) => montosSinVerificar({ reply, historial, preciosTools }).length === 0;
  assert.ok(ok("El sofá cuesta S/ 1,200.00"));
  assert.ok(ok("Dos sofás serían S/ 2400"));
  assert.ok(ok("Sofá más mesa: S/ 2000"));
  assert.ok(ok("Recuerda que el presupuesto era S/ 500", [{ role: "user", content: "tengo S/ 500" }]));
  assert.ok(!ok("Cuesta S/ 950"));
});

test("precio inventado sin buscar en el catálogo → sin verificar y sin resolver", async () => {
  const out = await ejecutarAgente({
    messages: pregunta,
    supabaseAdmin: supabaseFalso({}),
    llm: llmFalso([new AIMessage("Sí, el sofá cama cuesta S/ 1500.")]),
  });
  assert.equal(out.meta.precioSinVerificar, true);
  assert.equal(turnoSinResolver({ out }), true);
});

test("precio que sale de la búsqueda → verificado", async () => {
  const out = await ejecutarAgente({
    messages: pregunta,
    supabaseAdmin: supabaseFalso({ products: [{ data: [producto] }] }),
    llm: llmFalso([
      llamarTool("buscar_productos", { query: "sofá" }),
      new AIMessage("El Sofá Milán cuesta S/ 1200."),
    ]),
  });
  assert.equal(out.meta.precioSinVerificar, false);
  assert.equal(turnoSinResolver({ out }), false);
});

test("repetir un precio dicho antes en la conversación no se marca", async () => {
  const out = await ejecutarAgente({
    messages: [
      { role: "user", content: "¿Cuánto cuesta el sofá?" },
      { role: "assistant", content: "El Sofá Milán cuesta S/ 1200." },
      { role: "user", content: "¿Y cuánto era?" },
    ],
    supabaseAdmin: supabaseFalso({}),
    llm: llmFalso([new AIMessage("Eran S/ 1200.")]),
  });
  assert.equal(out.meta.precioSinVerificar, false);
});

test("guardarTurno guarda el indicador precio_sin_verificar", async () => {
  const insertados = [];
  const supabaseAdmin = {
    from: () => ({
      upsert: async () => ({ error: null }),
      insert: async (filas) => {
        insertados.push(...filas);
        return { error: null };
      },
    }),
  };
  const out = await ejecutarAgente({
    messages: pregunta,
    supabaseAdmin: supabaseFalso({}),
    llm: llmFalso([new AIMessage("Cuesta S/ 1500.")]),
  });
  await guardarTurno({
    supabaseAdmin,
    sessionId: "123e4567-e89b-42d3-a456-426614174000",
    messages: pregunta,
    out,
    ms: 12.4,
  });
  const fila = insertados.find((f) => f.rol === "assistant");
  assert.equal(fila.precio_sin_verificar, true);
  assert.equal(fila.sin_resolver, true);
});