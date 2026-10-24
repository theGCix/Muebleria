// server/cupon-salida.js
// ════════════════════════════════════════════════════════════════
// CUPÓN DE SALIDA (exit intent): el visitante deja su correo y recibe un
// cupón personal de un solo uso, con vencimiento real.
//
// Conexión en server/index.js (ya aplicada en este paquete):
//   import { registerCuponSalida } from "./cupon-salida.js";
//   registerCuponSalida({ app, supabaseAdmin, rateLimit });   // antes de app.listen()
//
// Se configura sin tocar código, con filas en `config_general` (clave, valor):
//   cupon_salida_activo   'false' lo apaga (por defecto activo)
//   cupon_salida_pct      porcentaje de descuento           (por defecto 10)
//   cupon_salida_horas    horas de vigencia desde que lo pide (por defecto 48)
//   cupon_salida_minimo   compra mínima en S/               (por defecto 300)
//   cupon_salida_tope     descuento máximo en S/ (opcional, sin tope por defecto)
//
// Correo con el cupón (opcional pero recomendado). Variables de entorno del servidor:
//   RESEND_API_KEY   la misma clave que ya usa la función send-notifications
//   RESEND_FROM      remitente con dominio verificado en Resend, p. ej. "G&M Mueblería <hola@tudominio.com>"
//   FRONTEND_URL     ya existe; se usa para el botón "Ir a la tienda"
// Con ambas variables el correo sale al instante. Sin ellas (o si Resend falla) se encola en
// `notificaciones` (tipo 'cupon_bienvenida') y lo despacha el worker send-notifications.
// ════════════════════════════════════════════════════════════════
import crypto from "crypto";

const DEFAULTS = { pct: 10, horas: 48, minimo: 300, tope: null };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Sin 0/O/1/I para que el código se pueda dictar o copiar sin errores
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generarCodigo() {
  const bytes = crypto.randomBytes(8);
  let s = "";
  for (let i = 0; i < 8; i++) s += ALFABETO[bytes[i] % ALFABETO.length];
  return `GM${s}`;
}

const escapeHtml = (v) =>
  String(v).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

const soles = (n) => `S/ ${Number.isInteger(n) ? n : n.toFixed(2)}`;

function armarCorreo({ codigo, porcentaje, minimo, venceEl, tiendaUrl }) {
  const vence = new Date(venceEl).toLocaleString("es-PE", {
    timeZone: "America/Lima",
    dateStyle: "full",
    timeStyle: "short",
  });
  const asunto = `Tu cupón del ${porcentaje}% en G&M Mueblería`;
  const texto = [
    "¡Hola!",
    "",
    `Aquí está tu cupón de ${porcentaje}% de descuento en tu primera compra:`,
    "",
    `  Código: ${codigo}`,
    "",
    `Válido hasta el ${vence} (hora de Lima), en compras desde ${soles(minimo)}.`,
    "Un solo uso. Ingrésalo en el checkout, en el campo “¿Tienes un cupón?”.",
    "",
    `Ir a la tienda: ${tiendaUrl}`,
    "",
    "G&M Mueblería",
  ].join("\n");

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f1ea;font-family:Arial,Helvetica,sans-serif;color:#2b211a">
<div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e6dccf">
<div style="background:#6b4a2f;color:#fbf7f1;text-align:center;padding:28px 24px">
<div style="font-size:12px;letter-spacing:3px;text-transform:uppercase;opacity:.8">Tu cupón está listo</div>
<div style="font-family:Georgia,serif;font-size:56px;line-height:1.1;margin:6px 0">-${escapeHtml(porcentaje)}%</div>
<div style="font-size:14px;opacity:.9">en tu primera compra</div></div>
<div style="padding:24px;text-align:center">
<div style="font-size:14px;color:#6f6256;margin-bottom:10px">Tu código</div>
<div style="display:inline-block;border:2px dashed #b99a7d;border-radius:8px;padding:12px 20px;font-family:Courier New,monospace;font-size:26px;font-weight:bold;letter-spacing:4px">${escapeHtml(codigo)}</div>
<p style="font-size:14px;line-height:1.6;color:#4a3d32;margin:18px 0 6px">Válido hasta el <b>${escapeHtml(vence)}</b> (hora de Lima), en compras desde <b>${escapeHtml(soles(minimo))}</b>.</p>
<p style="font-size:13px;line-height:1.6;color:#6f6256;margin:0 0 20px">Un solo uso. Ingrésalo en el checkout, en el campo “¿Tienes un cupón?”.</p>
<a href="${escapeHtml(tiendaUrl)}" style="display:inline-block;background:#6b4a2f;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:999px;font-size:14px;font-weight:bold">Ir a la tienda</a>
</div></div>
<p style="text-align:center;font-size:12px;color:#8a7d70;margin:16px 0 0">G&amp;M Mueblería · Recibes este correo porque pediste un cupón en nuestra tienda.</p>
</body></html>`;
  return { asunto, texto, html };
}

/** Envía por Resend si hay credenciales. Devuelve { ok, motivo? }; nunca lanza. */
async function enviarPorResend({ to, asunto, html, texto }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!key || !from)
    return { ok: false, motivo: "Resend sin configurar (RESEND_API_KEY / RESEND_FROM)" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject: asunto, html, text: texto }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok)
      return { ok: false, motivo: `Resend ${res.status}: ${(await res.text()).slice(0, 200)}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, motivo: String(err?.message ?? err) };
  }
}

export function registerCuponSalida({ app, supabaseAdmin, rateLimit }) {
  async function leerConfig() {
    const { data, error } = await supabaseAdmin
      .from("config_general")
      .select("clave, valor")
      .in("clave", [
        "cupon_salida_activo",
        "cupon_salida_pct",
        "cupon_salida_horas",
        "cupon_salida_minimo",
        "cupon_salida_tope",
      ]);
    const m = Object.fromEntries(
      (error ? [] : (data ?? [])).map((r) => [r.clave, String(r.valor ?? "").trim()]),
    );
    const num = (v, def, min, max) => {
      const n = Number(v);
      return Number.isFinite(n) && n >= min && n <= max ? n : def;
    };
    return {
      activo: m.cupon_salida_activo !== "false",
      pct: num(m.cupon_salida_pct, DEFAULTS.pct, 1, 50), // tope duro de seguridad: 50 %
      horas: num(m.cupon_salida_horas, DEFAULTS.horas, 1, 24 * 14),
      minimo: num(m.cupon_salida_minimo, DEFAULTS.minimo, 0, 100000),
      tope: m.cupon_salida_tope ? num(m.cupon_salida_tope, null, 1, 100000) : null,
    };
  }

  // GET /api/cupones/salida/oferta → qué ofrecer en el modal (o { activo:false })
  app.get("/api/cupones/salida/oferta", async (_req, res) => {
    try {
      const c = await leerConfig();
      res.json({ activo: c.activo, porcentaje: c.pct, horas: c.horas, minimo: c.minimo });
    } catch (err) {
      console.error("cupon-salida oferta:", err.message);
      res.json({ activo: false });
    }
  });

  const limiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5, // máx 5 cupones por IP por hora: frena a quien genere correos falsos en bucle
    message: { error: "Demasiadas solicitudes. Inténtalo más tarde." },
  });

  // POST /api/cupones/salida   body: { email }
  app.post("/api/cupones/salida", limiter, async (req, res) => {
    try {
      const email = String(req.body?.email ?? "")
        .trim()
        .toLowerCase();
      if (!EMAIL_RE.test(email) || email.length > 120) {
        return res.status(400).json({ error: "Ingresa un correo válido." });
      }

      const c = await leerConfig();
      if (!c.activo) return res.status(404).json({ error: "Promoción no disponible." });

      // Un cupón de bienvenida por correo
      const marca = `exit-intent:${email}`;
      const { data: previo, error: errPrevio } = await supabaseAdmin
        .from("cupones")
        .select("id")
        .eq("origen", "bienvenida")
        .eq("notas", marca)
        .maybeSingle();
      if (errPrevio) throw new Error(errPrevio.message);
      if (previo) {
        return res.status(409).json({ error: "Este correo ya recibió su cupón de bienvenida." });
      }

      // ¿Ya compró antes? El cupón es solo para primera compra.
      const { count: compras } = await supabaseAdmin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("email", email)
        .not("paid_at", "is", null);
      if ((compras ?? 0) > 0) {
        return res.status(409).json({ error: "Este cupón es solo para primeras compras." });
      }

      const venceEl = new Date(Date.now() + c.horas * 3600 * 1000).toISOString();

      // Reintenta si el código aleatorio chocara con uno existente (UNIQUE)
      let creado = null;
      for (let intento = 0; intento < 4 && !creado; intento++) {
        const codigo = generarCodigo();
        const { data, error } = await supabaseAdmin
          .from("cupones")
          .insert({
            codigo,
            descripcion: `Cupón de salida ${c.pct}%`,
            tipo_descuento: "porcentaje",
            valor: c.pct,
            descuento_maximo: c.tope,
            monto_minimo_compra: c.minimo,
            aplica_a: "todo",
            solo_primera_compra: true,
            uso_maximo_total: 1,
            uso_maximo_por_cliente: 1,
            vence_el: venceEl,
            activo: true,
            origen: "bienvenida",
            notas: marca,
          })
          .select("codigo, vence_el, valor, monto_minimo_compra")
          .single();
        if (!error) creado = data;
        else if (error.code !== "23505") throw new Error(error.message);
      }
      if (!creado) throw new Error("No se pudo generar un código único");

      const porcentaje = Number(creado.valor);
      const minimo = Number(creado.monto_minimo_compra);

      // Correo: directo si hay Resend; si no, o si falla, queda en cola para el worker.
      // Un fallo aquí nunca debe impedir que el visitante reciba su cupón en pantalla.
      let correo = "no";
      try {
        const tiendaUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
        const msg = armarCorreo({
          codigo: creado.codigo,
          porcentaje,
          minimo,
          venceEl: creado.vence_el,
          tiendaUrl,
        });
        const envio = await enviarPorResend({ to: email, ...msg });
        const { error: errCola } = await supabaseAdmin.from("notificaciones").insert({
          tipo: "cupon_bienvenida",
          canal: "email",
          destinatario_email: email,
          asunto: msg.asunto,
          mensaje: msg.texto,
          enviado: envio.ok,
          enviado_at: envio.ok ? new Date().toISOString() : null,
          error: envio.ok ? null : envio.motivo,
        });
        if (envio.ok) correo = "enviado";
        else if (!errCola) correo = "en_cola";
        if (errCola)
          console.error("cupon-salida: no se pudo registrar la notificación:", errCola.message);
        if (!envio.ok) console.warn("cupon-salida: correo no enviado directo:", envio.motivo);
      } catch (err) {
        console.error("cupon-salida correo:", err.message);
      }

      res.json({
        codigo: creado.codigo,
        vence_el: creado.vence_el,
        porcentaje,
        minimo,
        correo,
      });
    } catch (err) {
      console.error("cupon-salida:", err.message);
      res.status(500).json({ error: "No pudimos generar tu cupón. Inténtalo de nuevo." });
    }
  });
}
