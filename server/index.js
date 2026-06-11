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