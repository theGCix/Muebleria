import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { URLSearchParams } from "url";
import rateLimit from "express-rate-limit";

// ── Cargar .env desde la raíz del proyecto ────────────────────
const __dirname = fileURLToPath(new URL(".", import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = express();
app.use(express.json());

// ── CORS ──────────────────────────────────────────────────────
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowed = [
    "https://muebleria-q74c.onrender.com",
    "http://localhost:5173"
  ];
  if (allowed.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  }
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// ── Supabase admin ────────────────────────────────────────────
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

// ── URLs de Niubiz según ambiente ─────────────────────────────
// En .env pon: NIUBIZ_AMBIENTE=integracion  o  NIUBIZ_AMBIENTE=produccion
function getNiubizUrls() {
  const amb = process.env.NIUBIZ_AMBIENTE ?? "integracion";
  const defaults = {
    integracion: {
      security: "https://apitestenv.vnforapps.com/api.security/v1/security",
      session:  "https://apitestenv.vnforapps.com/api.ecommerce/v2/ecommerce/token/session",
      js:       "https://static-content-qas.vnforapps.com/v2/js/checkout.js",
    },
    produccion: {
      security: "https://apiprod.vnforapps.com/api.security/v1/security",
      session:  "https://apiprod.vnforapps.com/api.ecommerce/v2/ecommerce/token/session",
      js:       "https://static-content.vnforapps.com/v2/js/checkout.js",
    },
  };
  const base = defaults[amb] ?? defaults.integracion;
  return {
    security: process.env.NIUBIZ_URL_SECURITY ?? base.security,
    session:  process.env.NIUBIZ_URL_SESSION  ?? base.session,
    js:       process.env.NIUBIZ_URL_JS       ?? base.js,
  };
}

async function getSecurityToken() {
  const creds = Buffer.from(
    `${process.env.NIUBIZ_USER}:${process.env.NIUBIZ_PASSWORD}`
  ).toString("base64");
  const res = await fetch(getNiubizUrls().security, {
    headers: { Authorization: `Basic ${creds}` },
  });
  if (!res.ok) throw new Error(`Niubiz security error: ${res.status}`);
  return res.text();
}

// ── GET /api/niubiz/config ────────────────────────────────────
app.get("/api/niubiz/config", (_req, res) => {
  res.json({
    merchantId: process.env.NIUBIZ_MERCHANT_ID,
    jsUrl:      getNiubizUrls().js,
    currency:   "PEN",
  });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", ts: new Date().toISOString() });
});

app.get("/", (_req, res) => {
  res.json({ service: "G&M Mueblería API", version: "1.0" });
});

// server/index.js o Supabase Edge Function
async function sendWhatsApp(to, message) {
  const res = await fetch(
    `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to.replace(/\D/g, ""),  // solo dígitos
        type: "text",
        text: { body: message },
      }),
    }
  );
  return res.json();
}



const niubizLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minuto
  max: 10,              // máx 10 sesiones de pago por IP por minuto
  message: { error: "Demasiadas solicitudes. Espera un momento." },
});
// ── POST /api/niubiz/session ──────────────────────────────────
app.post("/api/niubiz/session", async (req, res) => {
  try {
    const { amount, orderId, email } = req.body;
    const merchantId = process.env.NIUBIZ_MERCHANT_ID;
    const token      = await getSecurityToken();

    const r = await fetch(`${getNiubizUrls().session}/${merchantId}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: token },
      body: JSON.stringify({
        amount: Number(amount).toFixed(2),
        antifraud: {
          clientIp: "127.0.0.1",
          merchantDefineData: {
            MDD4: email ?? "", MDD32: merchantId, MDD75: "Ecommerce", MDD77: "0",
          },
        },
        channel: "web", currency: "PEN", orderId,
      }),
    });

    if (!r.ok) throw new Error(`Niubiz session: ${r.status} ${await r.text()}`);
    const json = await r.json();
    res.json({
      sessionKey: json.sessionKey,
      merchantId,
      jsUrl:      getNiubizUrls().js,
      currency:   "PEN",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /niubiz-return.html — recibe el POST de Niubiz ───────
app.post("/niubiz-return.html", express.urlencoded({ extended: true }), (req, res) => {
  console.log("Niubiz POST body:", req.body);
  const qs          = new URLSearchParams(req.body).toString();
  const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
  res.redirect(`${frontendUrl}/checkout?${qs}`);
});

// ── POST /api/orders — guarda el pedido en Supabase ───────────
app.post("/api/orders", async (req, res) => {
  try {
    const { order, items } = req.body;
    console.log("📦 Orden recibida:", order?.orderNumber);

    const orderNumber = (order.orderNumber?.trim())
      ? order.orderNumber
      : `GM-${Date.now()}-${(order.transactionToken ?? "").slice(-6).toUpperCase()}`;

    // Evitar duplicados por transactionToken
    const { data: existing } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("niubiz_token", order.transactionToken)
      .maybeSingle();

    if (existing) {
      return res.json({ success: true, orderId: existing.id, alreadyExists: true });
    }

    const { data: newOrder, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
        order_number:       orderNumber,
        user_id:            order.userId ?? null,
        nombre:             order.nombre || "—",
        email:              order.email  || "—",
        telefono:           order.telefono  ?? null,
        dni:                order.dni       ?? null,
        direccion:          order.direccion ?? null,
        distrito:           order.distrito  ?? null,
        ciudad:             order.ciudad    ?? null,
        notas:              order.notas     ?? null,
        subtotal:           order.subtotal  ?? 0,
        envio:              order.envio     ?? 0,
        total:              order.total     ?? 0,
        currency:           "PEN",
        niubiz_session_key: order.sessionKey       ?? null,
        niubiz_token:       order.transactionToken ?? null,
        status:             "pagado",
        paid_at:            new Date().toISOString(),
      })
      .select("id")
      .single();

    if (orderError) throw new Error(orderError.message);

    const orderItems = (items ?? []).map((item) => ({
      order_id:   newOrder.id,
      product_id: item.product_id ?? null,
      sku:        item.sku        ?? null,
      title:      item.title,
      qty:        item.qty,
      unit_price: item.price,
      total:      item.price * item.qty,
      image_url:  item.image ?? null,
    }));

    if (orderItems.length > 0) {
      const { error: itemsError } = await supabaseAdmin
        .from("order_items")
        .insert(orderItems);
      if (itemsError) throw new Error(itemsError.message);

      // Reducir stock
      for (const item of orderItems) {
        if (!item.product_id) continue;
        const { data: product } = await supabaseAdmin
          .from("products")
          .select("stock")
          .eq("id", item.product_id)
          .single();
        if (product) {
          await supabaseAdmin
            .from("products")
            .update({ stock: Math.max(0, (product.stock ?? 0) - item.qty) })
            .eq("id", item.product_id);
        }
      }
    }

    res.json({ success: true, orderId: newOrder.id });
  } catch (err) {
    console.error("Error guardando orden:", err.message);
    res.status(500).json({ error: err.message });
  }
});







// ════════════════════════════════════════════════════════════════
// NUBEFACT — Rutas Express para server/index.js
// Pega este bloque al final de server/index.js, antes del app.listen()
// ════════════════════════════════════════════════════════════════

// ── URLs Nubefact según ambiente ─────────────────────────────────
function getNubefactBase() {
  const amb = process.env.NUBEFACT_AMBIENTE ?? "demo";
  return amb === "produccion"
    ? "https://api.nubefact.com/api/v1"
    : "https://demo-api.nubefact.com/api/v1";
}

// ── Middleware: verificar sesión Supabase ─────────────────────────
async function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "Sin token" });
  const token = auth.slice(7);
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: "Token inválido" });
  req.user = user;
  next();
}

// ── POST /api/nubefact/emitir ─────────────────────────────────────
// Body: { sale_id: string }
// El servidor lee la venta de Supabase, construye el payload y llama a Nubefact
app.post("/api/nubefact/emitir", requireAuth, async (req, res) => {
  const { sale_id } = req.body;
  if (!sale_id) return res.status(400).json({ error: "sale_id requerido" });

  // 1. Leer la venta + items + cliente desde Supabase
  const { data: sale, error: saleErr } = await supabaseAdmin
    .from("sales")
    .select(`
      id, numero, tipo, subtotal, igv, total, notas, created_at,
      customers ( doc_tipo, doc_numero, nombre, email, direccion ),
      sale_items ( sku, title, qty, unit_price, total )
    `)
    .eq("id", sale_id)
    .single();

  if (saleErr || !sale) return res.status(404).json({ error: "Venta no encontrada" });
  if (sale.nubefact_estado === "aceptado") {
    return res.status(409).json({ error: "Comprobante ya fue emitido a SUNAT" });
  }

  const cliente = sale.customers;

  // 2. Mapear tipo_doc al código numérico que usa Nubefact
  const tipoDocMap = { DNI: 1, RUC: 6, CE: 4, PASAPORTE: 7 };
  const tipoDocNum = tipoDocMap[cliente?.doc_tipo] ?? 1;

  // 3. Extraer serie y correlativo del numero (ej: "B001-00000042")
  const [serie, corrStr] = sale.numero.split("-");
  const correlativo = parseInt(corrStr, 10);
  const tipoCpe = sale.tipo === "factura" ? 1 : 2;

  // 4. Construir ítems
  const items = (sale.sale_items ?? []).map((it) => {
    const valorUnit = parseFloat((it.unit_price / 1.18).toFixed(6));
    const subtotal  = parseFloat((valorUnit * it.qty).toFixed(2));
    const igvLinea  = parseFloat((subtotal * 0.18).toFixed(2));
    const total     = parseFloat((subtotal + igvLinea).toFixed(2));
    return {
      unidad_de_medida: "NIU",
      codigo: it.sku ?? "PROD",
      descripcion: it.title,
      cantidad: it.qty,
      valor_unitario: valorUnit,
      precio_unitario: parseFloat(it.unit_price.toFixed(6)),
      descuento: 0,
      subtotal,
      tipo_de_igv: 1,
      igv: igvLinea,
      total,
      anticipo_regularizacion: false,
      anticipo_documento_serie: "",
      anticipo_documento_numero: 0,
    };
  });

  // 5. Formatear fecha dd-mm-yyyy
  const d = new Date(sale.created_at);
  const fecha = `${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}`;

  // 6. Payload Nubefact
  const payload = {
    operacion:                         "generar_comprobante",
    tipo_de_comprobante:               tipoCpe,
    serie,
    numero:                            correlativo,
    sunat_transaction:                 1,
    cliente_tipo_de_documento:         tipoDocNum,
    cliente_numero_de_documento:       cliente?.doc_numero ?? "00000000",
    cliente_denominacion:              cliente?.nombre ?? "Cliente varios",
    cliente_direccion:                 cliente?.direccion ?? "",
    cliente_email:                     cliente?.email ?? "",
    fecha_de_emision:                  fecha,
    moneda:                            1,  // PEN
    tipo_de_cambio:                    0,
    porcentaje_de_igv:                 18,
    descuento_global:                  0,
    total_descuento:                   0,
    total_anticipo:                    0,
    total_gravada:                     parseFloat(sale.subtotal),
    total_inafecta:                    0,
    total_exonerada:                   0,
    total_igv:                         parseFloat(sale.igv),
    total_gratuita:                    0,
    total_otros_cargos:                0,
    total:                             parseFloat(sale.total),
    observaciones:                     sale.notas ?? "",
    enviar_automaticamente_a_la_sunat: true,
    enviar_automaticamente_al_cliente: !!(cliente?.email),
    items,
  };

  // 7. Llamar a Nubefact
  let nubefactResp;
  try {
    const nfRes = await fetch(
      `${getNubefactBase()}/${process.env.NUBEFACT_RUC}/comprobantes/`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Token ${process.env.NUBEFACT_TOKEN}`,
        },
        body: JSON.stringify(payload),
      }
    );
    nubefactResp = await nfRes.json();

    if (!nfRes.ok) {
      const msg = nubefactResp.errors
        ? Object.entries(nubefactResp.errors).map(([k,v]) => `${k}: ${v.join(", ")}`).join(" | ")
        : `HTTP ${nfRes.status}`;
      // Guardar error en Supabase
      await supabaseAdmin.from("sales").update({
        nubefact_estado: "error",
        nubefact_error:  msg,
      }).eq("id", sale_id);
      return res.status(502).json({ error: msg });
    }
  } catch (err) {
    await supabaseAdmin.from("sales").update({
      nubefact_estado: "error",
      nubefact_error:  err.message,
    }).eq("id", sale_id);
    return res.status(502).json({ error: err.message });
  }

  // 8. Guardar resultado en Supabase
  await supabaseAdmin.from("sales").update({
    nubefact_estado: nubefactResp.aceptado_por_sunat ? "aceptado" : "rechazado",
    nubefact_enlace: nubefactResp.enlace_del_pdf,
    nubefact_xml:    nubefactResp.enlace_del_xml,
    nubefact_cdr:    nubefactResp.enlace_del_cdr,
    nubefact_hash:   nubefactResp.codigo_hash,
    nubefact_error:  nubefactResp.aceptado_por_sunat ? null : nubefactResp.sunat_description,
  }).eq("id", sale_id);

  return res.json({
    aceptado:   nubefactResp.aceptado_por_sunat,
    enlace_pdf: nubefactResp.enlace_del_pdf,
    enlace_xml: nubefactResp.enlace_del_xml,
    hash:       nubefactResp.codigo_hash,
    descripcion: nubefactResp.sunat_description,
  });
});

// ── POST /api/nubefact/anular ────────────────────────────────────
// Body: { sale_id: string, motivo: string }
app.post("/api/nubefact/anular", requireAuth, async (req, res) => {
  const { sale_id, motivo } = req.body;
  if (!sale_id || !motivo) return res.status(400).json({ error: "sale_id y motivo requeridos" });

  const { data: sale } = await supabaseAdmin
    .from("sales")
    .select("numero, tipo, nubefact_estado")
    .eq("id", sale_id)
    .single();

  if (!sale) return res.status(404).json({ error: "Venta no encontrada" });
  if (sale.nubefact_estado !== "aceptado") {
    return res.status(409).json({ error: "Solo se pueden anular comprobantes aceptados por SUNAT" });
  }

  const [serie, corrStr] = sale.numero.split("-");
  const tipoCpe = sale.tipo === "factura" ? 1 : 2;

  const payload = {
    operacion: "generar_anulacion",
    tipo_de_comprobante: tipoCpe,
    serie,
    numero: parseInt(corrStr, 10),
    motivo,
  };

  const nfRes = await fetch(
    `${getNubefactBase()}/${process.env.NUBEFACT_RUC}/comprobantes/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Token ${process.env.NUBEFACT_TOKEN}`,
      },
      body: JSON.stringify(payload),
    }
  );
  const json = await nfRes.json();

  if (!nfRes.ok) return res.status(502).json({ error: JSON.stringify(json) });

  await supabaseAdmin.from("sales")
    .update({ nubefact_estado: "anulado", estado: "anulada" })
    .eq("id", sale_id);

  return res.json({ aceptado: json.aceptado_por_sunat, descripcion: json.sunat_description });
});

// ── GET /api/nubefact/pdf/:sale_id ───────────────────────────────
// Devuelve el enlace del PDF (para el botón "Ver comprobante")
app.get("/api/nubefact/pdf/:sale_id", requireAuth, async (req, res) => {
  const { data: sale } = await supabaseAdmin
    .from("sales")
    .select("nubefact_enlace, nubefact_estado")
    .eq("id", req.params.sale_id)
    .single();

  if (!sale?.nubefact_enlace) {
    return res.status(404).json({ error: "Comprobante aún no emitido a SUNAT" });
  }
  return res.json({ enlace_pdf: sale.nubefact_enlace, estado: sale.nubefact_estado });
});




















// ── Iniciar servidor ──────────────────────────────────────────
const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => {
  console.log(`✅ Niubiz proxy en puerto ${PORT}`);
  console.log(`   Ambiente Niubiz: ${process.env.NIUBIZ_AMBIENTE ?? "integracion"}`);
  console.log(`   Frontend URL:    ${process.env.FRONTEND_URL ?? "http://localhost:5173"}`);
});



// POST /api/staff/create-user
app.post("/api/staff/create-user", async (req, res) => {
  // Verificar que quien llama es admin (via JWT de Supabase)
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Sin autorización" });
  }
  const token = authHeader.slice(7);
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: "Token inválido" });

  // Verificar rol admin
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!roles) return res.status(403).json({ error: "Solo admins pueden crear usuarios" });

  const { email, password, fullName, role } = req.body;
  try {
    const { data: newUser, error } = await supabaseAdmin.auth.admin.createUser({
      email, password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error) throw error;

    await supabaseAdmin.from("user_roles").insert({ user_id: newUser.user.id, role });
    await supabaseAdmin.from("profiles").upsert({ id: newUser.user.id, full_name: fullName });

    res.json({ success: true, userId: newUser.user.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});












// server/index.js — añadir función de verificación

async function verificarTransaccionNiubiz(transactionToken, purchaseNumber) {
  const token = await getSecurityToken();
  const merchantId = process.env.NIUBIZ_MERCHANT_ID;

  // URL de autorización/consulta de Niubiz
  const baseUrl = process.env.NIUBIZ_AMBIENTE === "produccion"
    ? "https://apiprod.vnforapps.com"
    : "https://apitestenv.vnforapps.com";

  const url = `${baseUrl}/api.authorization/v3/authorization/ecommerce/${merchantId}`;

  const res = await fetch(url, {
    method:  "POST",
    headers: { "Content-Type": "application/json", Authorization: token },
    body: JSON.stringify({
      channel:           "web",
      captureType:       "manual",
      countable:         true,
      order: {
        purchaseNumber,
        tokenId:  transactionToken,
        currency: "PEN",
      },
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Verificación Niubiz fallida: ${res.status} ${txt}`);
  }

  const data = await res.json();
  // data.order.status: "Authorized" | "Denied" | etc.
  // data.dataMap.ACTION_CODE: "000" = aprobado
  return {
    aprobado:       data.dataMap?.ACTION_CODE === "000",
    actionCode:     data.dataMap?.ACTION_CODE,
    actionDesc:     data.dataMap?.ACTION_DESCRIPTION,
    authCode:       data.dataMap?.AUTHORIZATION_CODE,
    amount:         data.order?.amount,
    purchaseNumber: data.order?.purchaseNumber,
  };
}

// ── Actualizar POST /api/orders para verificar antes de guardar ──
app.post("/api/orders", async (req, res) => {
  try {
    const { order, items } = req.body;

    // ✅ VERIFICAR con Niubiz antes de guardar
    if (order.transactionToken) {
      const verificacion = await verificarTransaccionNiubiz(
        order.transactionToken,
        order.orderNumber
      );

      if (!verificacion.aprobado) {
        console.warn("⚠️  Transacción no aprobada:", verificacion.actionDesc);
        // Guardar la orden como cancelada para trazabilidad
        await supabaseAdmin.from("orders").insert({
          order_number:  order.orderNumber ?? `GM-FAIL-${Date.now()}`,
          nombre:        order.nombre || "—",
          email:         order.email  || "—",
          subtotal:      order.subtotal ?? 0,
          envio:         order.envio ?? 0,
          total:         order.total ?? 0,
          currency:      "PEN",
          niubiz_token:  order.transactionToken,
          niubiz_auth_code: order.authCode ?? null,
          status:        "cancelado",
        });
        return res.status(402).json({
          error: "Pago no aprobado",
          actionCode: verificacion.actionCode,
          actionDesc: verificacion.actionDesc,
        });
      }

      // Guardar el código de autorización
      order.authCode = verificacion.authCode;
    }

    // ... resto del código de guardado (igual que antes) ...
  } catch (err) {
    console.error("Error guardando orden:", err.message);
    res.status(500).json({ error: err.message });
  }
});


// server/index.js — añadir
app.post("/api/chat", async (req, res) => {
  const { messages, catalogo } = req.body;

  const catalogoTexto = (catalogo ?? [])
    .map((p) => `- ${p.nombre}: S/ ${p.precio}`)
    .join("\n");

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "x-api-key":     process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      "claude-haiku-4-5-20251001",  // haiku es más barato para chat
        max_tokens: 500,
        system: `Eres asistente de G&M Mueblería. Catálogo:\n${catalogoTexto}\nResponde en español, máx 3 oraciones.`,
        messages,
      }),
    });
    const data = await response.json();
    res.json({ reply: data.content?.[0]?.text ?? "" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});