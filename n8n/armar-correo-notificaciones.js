// ═══ CONFIGURA AQUÍ ═══════════════════════════════════════════
const REMITENTE_NOMBRE = "G&M Mueblería";
const REMITENTE_EMAIL = "proyectomuebleria1@gmail.com"; // la MISMA cuenta Gmail de la credencial SMTP (Gmail reescribe el remitente si no coincide)
const SITE_URL = "https://muebleria-q74c.onrender.com"; // dirección de tu tienda (sin / al final)
const COLOR = "#6B4226"; // color de marca del correo
// ══════════════════════════════════════════════════════════════

// Lo que recibe n8n desde Supabase: filas de `notificaciones` (enviado = false, canal = email).
// Devuelve una fila por notificación:
//   enviar: true  → correo listo (to, from, subject, html, text)
//   enviar: false → no se puede enviar (sin correo válido): el flujo la deja marcada con error y no la reintenta.

const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]{2,}$/;
const MAX_INTENTOS = 5; // mismo valor que el filtro `intentos=lt.5` del nodo de consulta

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const sinSaltos = (s) => String(s ?? "").replace(/[\r\n]+/g, " ").trim();
const base = SITE_URL.replace(/\/$/, "");

// Las notificaciones de cambio de estado (cambiar_estado_pedido) se encolan SIN mensaje y a veces sin asunto.
const TEXTOS = {
  en_produccion: {
    asunto: "Tu mueble está en producción",
    mensaje: "Buenas noticias: tu pedido ya está en producción. Nuestros carpinteros están trabajando en él y te avisaremos en cada avance.",
  },
  control_calidad: {
    asunto: "Estamos revisando la calidad de tu pedido",
    mensaje: "Tu pedido está en control de calidad. Revisamos cada detalle antes de despacharlo.",
  },
  listo_despacho: {
    asunto: "Tu pedido está listo para despacho",
    mensaje: "Tu pedido ya está terminado y listo para despacho. Pronto nos pondremos en contacto contigo para coordinar la entrega.",
  },
  entregado: {
    asunto: "¡Tu pedido fue entregado!",
    mensaje: "Tu pedido fue entregado. ¡Esperamos que lo disfrutes mucho!",
  },
  cancelado: {
    asunto: "Pedido cancelado",
    mensaje: "Tu pedido fue cancelado. Si tienes dudas o no esperabas este aviso, respóndenos y te ayudamos.",
  },
};

// Botón opcional según el tipo (solo si hay a dónde llevar al cliente).
function boton(n) {
  const pedidos = `${base}/perfil/pedidos`;
  switch (n.tipo) {
    case "en_produccion":
    case "control_calidad":
    case "listo_despacho":
    case "entregado":
    case "evidencia_pedido":
      return { texto: "Ver mi pedido", url: pedidos };
    case "solicitud_resena":
      return n.order_id ? { texto: "Dejar mi reseña", url: `${base}/resena/${encodeURIComponent(n.order_id)}` } : null;
    case "cupon_bienvenida":
      return { texto: "Ir a la tienda", url: base };
    default:
      return null;
  }
}

// Convierte el texto plano en HTML: escapa todo y vuelve clicables los enlaces.
function textoAHtml(texto) {
  return esc(texto).replace(/(https?:\/\/[^\s<]+)/g, (m) => {
    const fin = (m.match(/[.,;:!?)]+$/) ?? [""])[0];
    const url = fin ? m.slice(0, -fin.length) : m;
    return `<a href="${url}" style="color:${COLOR};">${url}</a>${fin}`;
  });
}

function construir(n) {
  const to = String(n.destinatario_email ?? "").trim();
  if (!EMAIL_RE.test(to)) return { enviar: false, motivo: "sin correo válido" };

  const plantilla = TEXTOS[n.tipo] ?? {};
  const nombre = sinSaltos(n.destinatario_nombre).split(" ")[0];
  const subject = sinSaltos(n.asunto) || plantilla.asunto || "Novedades de tu pedido — G&M Mueblería";
  const cuerpo = String(n.mensaje ?? "").trim()
    ? String(n.mensaje).trim()
    : `Hola${nombre ? " " + nombre : ""},\n\n${plantilla.mensaje ?? "tu pedido ha cambiado de estado."}\n\nGracias por confiar en G&M Mueblería.`;

  const b = boton(n);
  const html = `<!doctype html>
<html lang="es"><body style="margin:0;padding:0;background:#f6f1ea;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f1ea;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:10px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
        <tr><td style="background:${COLOR};padding:18px 24px;color:#ffffff;font-size:18px;font-weight:bold;">${esc(REMITENTE_NOMBRE)}</td></tr>
        <tr><td style="padding:24px;font-size:15px;line-height:1.6;color:#2b2118;white-space:pre-line;">${textoAHtml(cuerpo)}</td></tr>
        ${
          b
            ? `<tr><td style="padding:0 24px 28px;"><a href="${esc(b.url)}" style="display:inline-block;background:${COLOR};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:6px;font-size:15px;font-weight:bold;">${esc(b.texto)}</a></td></tr>`
            : ""
        }
        <tr><td style="padding:14px 24px;background:#faf6f1;color:#8a7a6a;font-size:12px;">${esc(REMITENTE_NOMBRE)} · Lima, Perú</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return {
    enviar: true,
    to,
    from: `${REMITENTE_NOMBRE} <${REMITENTE_EMAIL}>`,
    subject,
    html,
    text: cuerpo,
  };
}

const salida = [];
for (const item of $input.all()) {
  const n = item.json;
  const r = construir(n);
  // `intentos_siguiente` lo usa el nodo que registra el error; `motivo_final` corta los reintentos si no hay remedio.
  salida.push({
    json: {
      id: n.id,
      intentos_siguiente: (Number(n.intentos) || 0) + 1,
      ...(r.enviar ? r : { ...r, intentos_siguiente: MAX_INTENTOS }),
    },
  });
}
return salida;
