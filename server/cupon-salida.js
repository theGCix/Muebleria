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

      res.json({
        codigo: creado.codigo,
        vence_el: creado.vence_el,
        porcentaje: Number(creado.valor),
        minimo: Number(creado.monto_minimo_compra),
      });
    } catch (err) {
      console.error("cupon-salida:", err.message);
      res.status(500).json({ error: "No pudimos generar tu cupón. Inténtalo de nuevo." });
    }
  });
}
