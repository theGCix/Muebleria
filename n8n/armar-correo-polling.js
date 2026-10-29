// ═══ CONFIGURA AQUÍ ═══════════════════════════════════════════
const REMITENTE_NOMBRE = "G&M Mueblería";
const REMITENTE_EMAIL = "proyectomuebleria1@gmail.com"; // la MISMA cuenta Gmail de la credencial SMTP (Gmail reescribe el remitente si no coincide)
const SITE_URL = "https://TU-TIENDA.com";        // dirección de tu tienda (sin / al final): para el botón "Ver mi pedido"
const COLOR = "#6B4226";                         // color de marca del correo
// ══════════════════════════════════════════════════════════════

function construir(body) {
  const p = body.pedido ?? {};
  const items = body.items ?? [];
  const enlaces = body.enlaces ?? {};

  // Sin correo válido no hay a quién escribir: el flujo termina sin error.
  const to = String(p.email ?? "").trim();
  if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]{2,}$/.test(to)) return null;

  // Todo lo que viene del cliente se escapa antes de meterlo en el HTML.
  const esc = (s) =>
    String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const sinSaltos = (s) => String(s ?? "").replace(/[\r\n]+/g, " ").trim();
  const soles = (n) => "S/ " + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fecha = (iso) =>
    iso ? new Date(iso).toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Lima" }) : null;

  const numero = sinSaltos(p.numero);
  const nombre = sinSaltos(p.nombre).split(" ")[0] || "";
  const recojo = p.metodo_entrega === "recojo_tienda";
  const entrega = fecha(p.entrega_estimada);

  // ── Qué pasa con la entrega ──
  let entregaTitulo, entregaTexto;
  if (recojo) {
    entregaTitulo = "Recojo en tienda";
    entregaTexto = "Te avisaremos cuando tu pedido esté listo para recoger.";
  } else if (p.requiere_cotizar_flete) {
    entregaTitulo = "Envío a provincia";
    entregaTexto = `Te escribiremos para confirmar el costo y la agencia de envío a ${sinSaltos(p.provincia || p.departamento) || "tu ciudad"}.`;
  } else {
    entregaTitulo = "Entrega a domicilio";
    const lugar = [sinSaltos(p.direccion), sinSaltos(p.distrito)].filter(Boolean).join(", ");
    entregaTexto = `${lugar ? lugar + ". " : ""}${entrega ? "Entrega estimada: " + entrega + "." : "Te contactaremos para coordinar la entrega."}`;
  }

  // ── Montos ──
  const lineasMontos = [["Subtotal", soles(p.subtotal)]];
  if (Number(p.descuento) > 0) lineasMontos.push([`Descuento${p.cupon ? " (" + sinSaltos(p.cupon) + ")" : ""}`, "− " + soles(p.descuento)]);
  lineasMontos.push([
    "Envío",
    recojo ? "Recojo sin costo" : p.requiere_cotizar_flete ? "Por confirmar" : soles(p.envio),
  ]);

  const filaItem = (i) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #eadfd2;font-size:14px;color:#2b2118;">${esc(i.titulo)}<br><span style="color:#8a7a6a;font-size:12px;">Cantidad: ${esc(i.cantidad)}</span></td>
      <td style="padding:10px 0;border-bottom:1px solid #eadfd2;font-size:14px;color:#2b2118;text-align:right;white-space:nowrap;">${soles(i.total)}</td>
    </tr>`;
  const filaMonto = ([k, v]) => `
    <tr>
      <td style="padding:4px 0;font-size:14px;color:#6b5a49;">${esc(k)}</td>
      <td style="padding:4px 0;font-size:14px;color:#6b5a49;text-align:right;">${esc(v)}</td>
    </tr>`;

  const boton = enlaces.cliente_pedidos
    ? `<p style="margin:24px 0 8px;text-align:center;"><a href="${esc(enlaces.cliente_pedidos)}" style="display:inline-block;background:${COLOR};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 28px;border-radius:999px;">Ver mi pedido</a></p>`
    : "";

  const html = `<!doctype html>
  <html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pedido ${esc(numero)}</title></head><body style="margin:0;padding:0;background:#faf6f0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf6f0;padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
      <tr><td style="background:${COLOR};padding:22px 28px;">
        <span style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#ffffff;letter-spacing:.5px;">G&amp;M Mueblería</span>
      </td></tr>
      <tr><td style="padding:28px;">
        <h1 style="margin:0 0 8px;font-family:Georgia,'Times New Roman',serif;font-size:24px;color:#2b2118;">¡Gracias por tu compra${nombre ? ", " + esc(nombre) : ""}!</h1>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#4a3b2d;">Recibimos el pago de tu pedido <strong>${esc(numero)}</strong>. Este es el resumen:</p>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${items.map(filaItem).join("")}</table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;">
          ${lineasMontos.map(filaMonto).join("")}
          <tr>
            <td style="padding:10px 0 0;font-size:17px;font-weight:700;color:#2b2118;border-top:2px solid ${COLOR};">Total pagado</td>
            <td style="padding:10px 0 0;font-size:17px;font-weight:700;color:#2b2118;text-align:right;border-top:2px solid ${COLOR};">${soles(p.total)}</td>
          </tr>
        </table>

        <div style="margin-top:24px;padding:16px 18px;background:#faf6f0;border-radius:12px;">
          <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:${COLOR};text-transform:uppercase;letter-spacing:.8px;">${esc(entregaTitulo)}</p>
          <p style="margin:0;font-size:14px;line-height:1.5;color:#4a3b2d;">${esc(entregaTexto)}</p>
        </div>

        ${boton}
        <p style="margin:20px 0 0;font-size:13px;line-height:1.5;color:#8a7a6a;">Tu mueble tiene 2 años de garantía en la estructura. Si tienes alguna duda, responde este correo o escríbenos por WhatsApp.</p>
      </td></tr>
      <tr><td style="background:#faf6f0;padding:16px 28px;font-size:12px;color:#8a7a6a;text-align:center;">G&amp;M Mueblería · Lima, Perú</td></tr>
    </table>
  </td></tr></table>
  </body></html>`;

  // Versión en texto plano (para clientes de correo que no muestran HTML)
  const texto = [
    `¡Gracias por tu compra${nombre ? ", " + nombre : ""}!`,
    `Recibimos el pago de tu pedido ${numero}.`,
    "",
    ...items.map((i) => `- ${sinSaltos(i.titulo)} x${i.cantidad}: ${soles(i.total)}`),
    "",
    ...lineasMontos.map(([k, v]) => `${k}: ${v}`),
    `Total pagado: ${soles(p.total)}`,
    "",
    `${entregaTitulo}: ${entregaTexto}`,
    enlaces.cliente_pedidos ? `\nVer mi pedido: ${enlaces.cliente_pedidos}` : "",
    "\nTu mueble tiene 2 años de garantía en la estructura.",
    "G&M Mueblería",
  ].join("\n");

  return {
    from: `${REMITENTE_NOMBRE} <${REMITENTE_EMAIL}>`,
    to,
    subject: `Recibimos tu pago · Pedido ${numero} — G&M Mueblería`,
    html,
    text: texto,
  };
}

// Cada elemento de entrada es un pedido de Supabase (con sus productos en order_items).
const FLETE_POR_COTIZAR = ["por_cotizar", "por_confirmar"];
const salida = [];
for (const item of $input.all()) {
  const o = item.json;
  const productos = Array.isArray(o.order_items) ? o.order_items : [];
  // Si aún no se guardaron los productos, se deja pendiente y se reintenta en la próxima vuelta.
  if (productos.length === 0) continue;

  const correo = construir({
    pedido: {
      numero: o.order_number,
      nombre: o.nombre,
      email: o.email,
      subtotal: o.subtotal,
      envio: o.envio,
      descuento: o.descuento_cupon,
      cupon: o.cupon_codigo,
      total: o.total,
      metodo_entrega: o.metodo_entrega,
      direccion: o.direccion,
      distrito: o.distrito,
      departamento: o.departamento,
      provincia: o.provincia,
      entrega_estimada: o.estimated_delivery,
      requiere_cotizar_flete: FLETE_POR_COTIZAR.includes(o.envio_estado),
    },
    items: productos.map((i) => ({ titulo: i.title, cantidad: i.qty, total: i.total })),
    enlaces: { cliente_pedidos: SITE_URL ? SITE_URL.replace(/\/$/, "") + "/perfil/pedidos" : "" },
  });

  // enviar:false = pedido sin correo válido: solo se marca como atendido para no reintentarlo siempre.
  salida.push({ json: correo ? { order_id: o.id, enviar: true, ...correo } : { order_id: o.id, enviar: false } });
}
return salida;
