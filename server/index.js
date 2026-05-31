import express from "express";
import cors from "cors";
import "dotenv/config";

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import { createClient } from "@supabase/supabase-js";


const __dirname = fileURLToPath(new URL(".", import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = express();
app.use(express.json());
app.use(cors());

function getNiubizUrls() {
  return {
    security: process.env.NIUBIZ_URL_SECURITY ?? "https://apitestenv.vnforapps.com/api.security/v1/security",
    session:  process.env.NIUBIZ_URL_SESSION  ?? "https://apitestenv.vnforapps.com/api.ecommerce/v2/ecommerce/token/session",
    js:       process.env.NIUBIZ_URL_JS       ?? "https://static-content-qas.vnforapps.com/v2/js/checkout.js",
  };


}


const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY  // service_role key
);

async function getSecurityToken() {
  const user     = process.env.NIUBIZ_USER;
  const password = process.env.NIUBIZ_PASSWORD;
  const creds    = Buffer.from(`${user}:${password}`).toString("base64");
  const res = await fetch(getNiubizUrls().security, {
    headers: { Authorization: `Basic ${creds}` },
  });
  if (!res.ok) throw new Error(`Niubiz security error: ${res.status}`);
  return res.text();
}

app.get("/api/niubiz/config", (_req, res) => {
  res.json({
    merchantId: process.env.NIUBIZ_MERCHANT_ID,
    jsUrl:      getNiubizUrls().js,
    currency:   "PEN",
  });
});

app.post("/api/niubiz/session", async (req, res) => {
  try {
    const { amount, orderId, email } = req.body;
    const merchantId = process.env.NIUBIZ_MERCHANT_ID;
    const token      = await getSecurityToken();
    const { session } = getNiubizUrls();

    const r = await fetch(`${session}/${merchantId}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: token },
      body: JSON.stringify({
        amount: Number(amount).toFixed(2),
        antifraud: {
          clientIp: "127.0.0.1",
          merchantDefineData: { MDD4: email ?? "", MDD32: merchantId, MDD75: "Ecommerce", MDD77: "0" },
        },
        channel: "web", currency: "PEN", orderId,
      }),
    });

    if (!r.ok) throw new Error(`Niubiz session: ${r.status} ${await r.text()}`);
    const json = await r.json();
    res.json({ sessionKey: json.sessionKey, merchantId, jsUrl: getNiubizUrls().js, currency: "PEN" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Nuevo endpoint — agregar antes del app.listen:
app.post("/api/orders", async (req, res) => {
  try {
    const { order, items } = req.body;

    // Generar order_number único si viene vacío
    const orderNumber = (order.orderNumber && order.orderNumber.trim())
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
        user_id:            order.userId ?? null, // opcional, si quieres relacionar con usuarios registrados
        nombre:             order.nombre || "—",
        email:              order.email || "—",
        telefono:           order.telefono,
        dni:                order.dni,
        direccion:          order.direccion,
        distrito:           order.distrito,
        ciudad:             order.ciudad,
        notas:              order.notas,
        subtotal:           order.subtotal || 0,
        envio:              order.envio ?? 0,
        total:              order.total || 0,
        currency:           "PEN",
        niubiz_session_key: order.sessionKey,
        niubiz_token:       order.transactionToken,
        status:             "pagado",
        paid_at:            new Date().toISOString(),
      })
      .select("id")
      .single();

    if (orderError) throw new Error(orderError.message);

    const orderItems = (items ?? []).map((item) => ({
      order_id:   newOrder.id,
      product_id: item.product_id ?? null,
      sku:        item.sku ?? null,
      title:      item.title,
      qty:        item.qty,
      unit_price: item.price,
      total:      item.price * item.qty,
      image_url:  item.image ?? null,
    }));

    // if (orderItems.length > 0) {
    //   const { error: itemsError } = await supabaseAdmin
    //     .from("order_items")
    //     .insert(orderItems);
    //   if (itemsError) throw new Error(itemsError.message);
    // }
    if (orderItems.length > 0) {
        const { error: itemsError } = await supabaseAdmin
          .from("order_items")
          .insert(orderItems);
        if (itemsError) throw new Error(itemsError.message);

        //reducir stock por cada producto
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Niubiz proxy corriendo en http://localhost:${PORT}`));

import { URLSearchParams } from "url";

app.post("/niubiz-return.html", express.urlencoded({ extended: true }), (req, res) => {
  console.log("Niubiz POST body:", req.body);
  const qs = new URLSearchParams(req.body).toString();
  // Redirigir directo al checkout en Vite
  res.redirect(`http://localhost:5173/checkout?${qs}`);
});

app.post("/api/orders", async (req, res) => {
  console.log("📦 Orden recibida:", JSON.stringify(req.body, null, 2)); 
  try {
    const { order, items } = req.body;

    // Generar order_number desde transactionToken si viene vacío
    const orderNumber = order.orderNumber || 
      `GM-${Date.now()}-${order.transactionToken?.slice(-6).toUpperCase() ?? "XXXXX"}`;

    // Verificar si ya existe este transactionToken
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
        order_number:       order.orderNumber,
        nombre:             order.nombre,
        email:              order.email,
        telefono:           order.telefono,
        dni:                order.dni,
        direccion:          order.direccion,
        distrito:           order.distrito,
        ciudad:             order.ciudad,
        notas:              order.notas,
        subtotal:           order.subtotal,
        envio:              order.envio ?? 0,
        total:              order.total,
        currency:           "PEN",
        niubiz_session_key: order.sessionKey,
        niubiz_token:       order.transactionToken,
        status:             "pagado",
        paid_at:            new Date().toISOString(),
      })
      .select("id")
      .single();

    if (orderError) throw new Error(orderError.message);

    const orderItems = items.map((item) => ({
      order_id:   newOrder.id,
      product_id: item.product_id ?? null,
      sku:        item.sku ?? null,
      title:      item.title,
      qty:        item.qty,
      unit_price: item.price,
      total:      item.price * item.qty,
      image_url:  item.image ?? null,
    }));

    const { error: itemsError } = await supabaseAdmin
      .from("order_items")
      .insert(orderItems);

    if (itemsError) throw new Error(itemsError.message);

    res.json({ success: true, orderId: newOrder.id });
  } catch (err) {
    console.error("Error guardando orden:", err.message);
    res.status(500).json({ error: err.message });
  }
});

