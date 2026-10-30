// ═══ CONFIGURA AQUÍ ═══════════════════════════════════════════
const REMITENTE_NOMBRE = "G&M Mueblería";
const REMITENTE_EMAIL = "proyectomuebleria1@gmail.com"; // la MISMA cuenta Gmail de la credencial SMTP
const SITE_URL = "https://muebleria-q74c.onrender.com"; // dirección pública de tu tienda (sin / al final)
const COLOR = "#6B4226";
const CUPON_PORCENTAJE = 5;      // descuento del paso 2
const CUPON_HORAS = 48;          // vigencia del cupón
const HORAS_PASO_2 = 24;         // sin actividad hace al menos X h para el 2.º correo
const HORAS_ENTRE_PASOS = 12;    // mínimo entre el 1.er y el 2.º correo
// ══════════════════════════════════════════════════════════════

const H = 3600 * 1000;
const ahora = Date.now();
const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const sinSaltos = (s) => String(s ?? "").replace(/[\r\n]+/g, " ").trim();
const soles = (n) => "S/ " + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]{2,}$/;

function enlace(paso) {
  const base = SITE_URL.replace(/\/$/, "");
  return `${base}/checkout?utm_source=n8n&utm_medium=email&utm_campaign=carrito_abandonado&utm_content=paso${paso}`;
}

function construir(c, paso, cuponCodigo) {
  const nombre = sinSaltos(c.nombre).split(" ")[0] || "";
  const items = c.items;
  const total = items.reduce((a, i) => a + Number(i.price || 0) * Number(i.qty || 1), 0);
  const url = enlace(paso);

  const titulo = paso === 1
    ? `${nombre ? esc(nombre) + ", t" : "T"}us productos te están esperando`
    : `${nombre ? esc(nombre) + ", u" : "U"}n regalo para completar tu pedido`;
  const intro = paso === 1
    ? "Dejaste estos muebles en tu carrito. Siguen guardados; si tienes dudas de medidas, materiales o tiempos de entrega, responde este correo o escríbenos por WhatsApp."
    : "Son piezas hechas a mano y el stock es limitado. Para ayudarte a decidir, te dejamos un cupón exclusivo para este carrito.";

  const fila = (i) => {
    const img = /^https:\/\//.test(String(i.image ?? ""))
      ? `<img src="${esc(i.image)}" width="56" height="56" alt="" style="border-radius:8px;object-fit:cover;display:block;">`
      : "";
    return `
    <tr>
      <td width="68" style="padding:10px 0;border-bottom:1px solid #eadfd2;">${img}</td>
      <td style="padding:10px 0;border-bottom:1px solid #eadfd2;font-size:14px;color:#2b2118;">${esc(i.title)}<br><span style="color:#8a7a6a;font-size:12px;">Cantidad: ${esc(i.qty)}</span></td>
      <td style="padding:10px 0;border-bottom:1px solid #eadfd2;font-size:14px;color:#2b2118;text-align:right;white-space:nowrap;">${soles(Number(i.price || 0) * Number(i.qty || 1))}</td>
    </tr>`;
  };

  const cupon = paso === 2 && cuponCodigo
    ? `<div style="margin:22px 0 0;padding:16px 18px;background:#faf6f0;border:1px dashed ${COLOR};border-radius:12px;text-align:center;">
        <p style="margin:0 0 6px;font-size:13px;color:#6b5a49;">${CUPON_PORCENTAJE}% de descuento · válido ${CUPON_HORAS} horas · un solo uso</p>
        <p style="margin:0;font-size:22px;font-weight:700;letter-spacing:2px;color:${COLOR};">${esc(cuponCodigo)}</p>
        <p style="margin:6px 0 0;font-size:12px;color:#8a7a6a;">Ingrésalo al pagar en el checkout.</p>
      </div>`
    : "";

  const html = `<!doctype html>
  <html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tu carrito</title></head><body style="margin:0;padding:0;background:#faf6f0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf6f0;padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
      <tr><td style="background:${COLOR};padding:22px 28px;">
        <span style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#ffffff;letter-spacing:.5px;">G&amp;M Mueblería</span>
      </td></tr>
      <tr><td style="padding:28px;">
        <h1 style="margin:0 0 8px;font-family:Georgia,'Times New Roman',serif;font-size:24px;color:#2b2118;">${titulo}</h1>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#4a3b2d;">${esc(intro)}</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${items.slice(0, 5).map(fila).join("")}</table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;">
          <tr>
            <td style="padding:10px 0 0;font-size:17px;font-weight:700;color:#2b2118;border-top:2px solid ${COLOR};">Total</td>
            <td style="padding:10px 0 0;font-size:17px;font-weight:700;color:#2b2118;text-align:right;border-top:2px solid ${COLOR};">${soles(total)}</td>
          </tr>
        </table>
        ${cupon}
        <p style="margin:24px 0 8px;text-align:center;"><a href="${esc(url)}" style="display:inline-block;background:${COLOR};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 28px;border-radius:999px;">Completar mi pedido</a></p>
        <p style="margin:20px 0 0;font-size:13px;line-height:1.5;color:#8a7a6a;">Tu mueble tiene 2 años de garantía en la estructura. Entregamos a domicilio en Lima y enviamos a provincias.</p>
      </td></tr>
      <tr><td style="background:#faf6f0;padding:16px 28px;font-size:12px;line-height:1.5;color:#8a7a6a;text-align:center;">G&amp;M Mueblería · Lima, Perú<br>Recibes este correo porque dejaste productos en tu carrito. Si no quieres más recordatorios, responde «NO».</td></tr>
    </table>
  </td></tr></table>
  </body></html>`;

  const texto = [
    nombre ? `Hola ${nombre},` : "Hola,",
    intro,
    "",
    ...items.slice(0, 5).map((i) => `- ${sinSaltos(i.title)} x${i.qty}: ${soles(Number(i.price || 0) * Number(i.qty || 1))}`),
    `Total: ${soles(total)}`,
    cuponCodigo && paso === 2 ? `\nCupón ${CUPON_PORCENTAJE}% (${CUPON_HORAS} h, un solo uso): ${cuponCodigo}` : "",
    `\nCompletar mi pedido: ${url}`,
    "\nG&M Mueblería · Si no quieres más recordatorios, responde NO.",
  ].join("\n");

  return {
    from: `${REMITENTE_NOMBRE} <${REMITENTE_EMAIL}>`,
    subject: paso === 1
      ? `${nombre ? nombre + ", tu" : "Tu"} carrito te está esperando — G&M Mueblería`
      : `${nombre ? nombre + ", un" : "Un"} ${CUPON_PORCENTAJE}% de descuento para tu carrito — G&M Mueblería`,
    html,
    text: texto,
  };
}

const salida = [];
for (const fila of $input.all()) {
  const c = fila.json;
  const iso = new Date(ahora).toISOString();
  const t = (v) => (v ? new Date(v).getTime() : null);
  const ultima = t(c.last_activity_at);
  const r1 = t(c.recordatorio_1_at);
  const r2 = t(c.recordatorio_2_at);

  // ¿Qué paso toca? (null = todavía no)
  let paso = null;
  if (!r1 && ultima && ahora - ultima >= 1 * H) paso = 1;
  else if (r1 && !r2 && ultima && ahora - ultima >= HORAS_PASO_2 * H && ahora - r1 >= HORAS_ENTRE_PASOS * H) paso = 2;
  if (!paso) continue;

  const items = Array.isArray(c.items) ? c.items.filter((i) => i && i.title) : [];
  const to = String(c.email ?? "").trim();

  // Sin correo válido o sin productos: se cierra el seguimiento para no reintentarlo siempre.
  if (!EMAIL_RE.test(to) || items.length === 0) {
    salida.push({ json: { carrito_id: c.id, enviar: false, paso, marca: { recordatorio_1_at: iso, recordatorio_2_at: iso } } });
    continue;
  }

  const cuponCodigo = paso === 2 ? "VUELVE-" + String(c.id).replace(/-/g, "").slice(0, 8).toUpperCase() : null;
  const correo = construir({ ...c, items }, paso, cuponCodigo);

  const marca = paso === 1
    ? { recordatorio_1_at: iso, recordatorio_enviado: true, estado: "contactado" }
    : { recordatorio_2_at: iso, recordatorio_enviado: true, estado: "contactado" };

  const cupon = cuponCodigo
    ? {
        codigo: cuponCodigo,
        descripcion: `Recuperación de carrito abandonado (${CUPON_PORCENTAJE}%)`,
        tipo_descuento: "porcentaje",
        valor: CUPON_PORCENTAJE,
        monto_minimo_compra: 0,
        aplica_a: "todo",
        solo_primera_compra: false,
        uso_maximo_total: 1,
        uso_maximo_por_cliente: 1,
        vigente_desde: iso,
        vence_el: new Date(ahora + CUPON_HORAS * H).toISOString(),
        activo: true,
        origen: "carrito_abandonado",
        notas: `Generado por n8n para el carrito ${c.id}`,
      }
    : null;

  salida.push({ json: { carrito_id: c.id, enviar: true, paso, to, ...correo, marca, cupon } });
}
return salida;
