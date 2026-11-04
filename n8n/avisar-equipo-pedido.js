// ═══ CONFIGURA AQUÍ ═══════════════════════════════════════════
// Quién recibe el aviso por WhatsApp (máximo 3). Cada persona activa CallMeBot UNA vez con su propio número
// y recibe su apikey (ver n8n/AVISO-EQUIPO.md). El teléfono va con + y código de país.
const DESTINATARIOS = [
  { nombre: "Gian", telefono: "+51999999999", apikey: "PEGA_AQUI_TU_APIKEY" },
  // { nombre: "Otra persona", telefono: "+51988888888", apikey: "SU_APIKEY" },
];
const SITE_URL = "https://muebleria-q74c.onrender.com"; // sin / al final: enlace al panel de pedidos
// ══════════════════════════════════════════════════════════════

// Cada elemento de entrada es un pedido pagado de Supabase (con sus productos en order_items).
// Por cada pedido: envía el WhatsApp a todos los destinatarios y devuelve un resultado para marcarlo:
//   enviado: true  → llegó al menos a una persona (se marca como avisado)
//   enviado: false → no llegó a nadie (se suma un intento; el flujo se rinde a los 3)

const FLETE_POR_COTIZAR = ["por_cotizar", "por_confirmar"];
const MAX_ITEMS_EN_TEXTO = 4;

const limpio = (s, max = 60) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const soles = (n) => "S/ " + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function construirTexto(o, productos) {
  const lineas = [];
  lineas.push(`🛒 Pedido pagado ${limpio(o.order_number, 30)}`);
  const contacto = [limpio(o.nombre, 50), limpio(o.telefono, 20)].filter(Boolean).join(" · ");
  if (contacto) lineas.push(`👤 ${contacto}`);

  const recojo = o.metodo_entrega === "recojo_tienda";
  const cotizar = FLETE_POR_COTIZAR.includes(o.envio_estado);
  const envio = recojo ? "recojo sin costo" : cotizar ? "flete por confirmar" : `envío ${soles(o.envio)}`;
  lineas.push(`💰 ${soles(o.total)} (${envio})`);

  const visibles = productos.slice(0, MAX_ITEMS_EN_TEXTO).map((i) => `${Number(i.qty) || 1}× ${limpio(i.title, 40)}`);
  const resto = productos.length - visibles.length;
  lineas.push(`🪑 ${visibles.join(", ")}${resto > 0 ? ` y ${resto} más` : ""}`);

  if (recojo) lineas.push("📦 Recojo en tienda");
  else if (cotizar)
    lineas.push(`⚠️ PROVINCIA (${limpio(o.provincia || o.departamento, 40) || "destino por definir"}): falta cotizar el flete y confirmarlo con el cliente`);
  else lineas.push(`📦 Domicilio${o.distrito ? ": " + limpio(o.distrito, 40) : ""}`);

  if (String(o.notas ?? "").trim()) lineas.push(`📝 ${limpio(o.notas, 120)}`);
  lineas.push(`👉 ${SITE_URL.replace(/\/$/, "")}/pedidos`);
  return lineas.join("\n");
}

// CallMeBot responde 200 con "Message queued..." si salió bien; con clave o teléfono inválidos devuelve otro código.
async function enviar(helpers, dest, texto) {
  try {
    const r = await helpers.httpRequest({
      method: "GET",
      url: "https://api.callmebot.com/whatsapp.php",
      qs: { phone: dest.telefono, text: texto, apikey: dest.apikey },
      returnFullResponse: true,
      ignoreHttpStatusErrors: true,
      timeout: 15000,
    });
    const cuerpo = String(r.body ?? "");
    if (r.statusCode === 200 && !/error|invalid/i.test(cuerpo)) return { ok: true };
    return { ok: false, motivo: `${r.statusCode}: ${cuerpo.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 120)}` };
  } catch (err) {
    return { ok: false, motivo: String(err?.message ?? err).slice(0, 120) };
  }
}

const pedidos = $input.all().map((i) => i.json);
if (pedidos.length === 0) return [];

const destinatarios = DESTINATARIOS.filter(
  (d) => /^\+\d{8,15}$/.test(String(d.telefono ?? "").trim()) && String(d.apikey ?? "").trim() && !/PEGA_AQUI/.test(d.apikey),
);
if (destinatarios.length === 0) {
  // Falla a la vista en n8n (Executions) en vez de descartar el aviso en silencio.
  throw new Error("Configura DESTINATARIOS en el nodo «Avisar al equipo» (teléfono con + y apikey de CallMeBot).");
}

const salida = [];
for (const o of pedidos) {
  const productos = Array.isArray(o.order_items) ? o.order_items : [];
  // Si aún no se guardaron los productos, se deja pendiente y se reintenta en la próxima vuelta (sin gastar intentos).
  if (productos.length === 0) continue;

  const texto = construirTexto(o, productos);
  let enviados = 0;
  const fallos = [];
  for (const d of destinatarios) {
    const r = await enviar(this.helpers, d, texto);
    if (r.ok) enviados++;
    else fallos.push(`${limpio(d.nombre, 30) || d.telefono}: ${r.motivo}`);
  }
  salida.push({
    json: {
      order_id: o.id,
      enviado: enviados > 0,
      intentos_siguiente: (Number(o.aviso_equipo_intentos) || 0) + 1,
      error: fallos.length ? fallos.join(" | ").slice(0, 300) : null,
    },
  });
}
return salida;
