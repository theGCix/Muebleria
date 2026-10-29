// server/notificaciones.js
// ─────────────────────────────────────────────────────────────
// Avisos a n8n cuando ocurre algo en la tienda. Hoy: pedido pagado.
//
// Flujo: el servidor termina de guardar el pedido (con sus productos) → llama al webhook de n8n →
// n8n avisa al cliente y al equipo (ver n8n/CORREO.md).
//
// Variables de entorno (Render → muebleria-api):
//   N8N_PEDIDO_PAGADO_URL   URL de producción del webhook, p. ej. https://TU-N8N/webhook/gm-pedido-pagado
//   N8N_WEBHOOK_SECRET      contraseña compartida: se envía en la cabecera x-webhook-secret
//   FRONTEND_URL            ya existe; se usa para armar los enlaces
//
// Garantías: NUNCA lanza ni retrasa la compra (el cliente ya pagó). Si n8n está caído o la variable
// no existe, solo deja un aviso en el log.
// ─────────────────────────────────────────────────────────────

const TIMEOUT_MS = 5000;
const FLETE_POR_COTIZAR = ["por_cotizar", "por_confirmar"];

export function armarPayloadPedido(order, items, { siteUrl = "" } = {}) {
  const base = String(siteUrl).replace(/\/$/, "");
  return {
    evento: "pedido_pagado",
    pedido: {
      id: order.id,
      numero: order.order_number,
      fecha_pago: order.paid_at ?? null,
      nombre: order.nombre ?? "",
      email: order.email ?? "",
      telefono: order.telefono ?? "",
      subtotal: Number(order.subtotal ?? 0),
      envio: Number(order.envio ?? 0),
      descuento: Number(order.descuento_cupon ?? 0),
      cupon: order.cupon_codigo ?? null,
      total: Number(order.total ?? 0),
      metodo_entrega: order.metodo_entrega ?? "domicilio",
      direccion: order.direccion ?? "",
      distrito: order.distrito ?? "",
      departamento: order.departamento ?? "",
      provincia: order.provincia ?? "",
      envio_estado: order.envio_estado ?? null,
      // Pedidos a provincia: ventas debe cotizar/confirmar el flete con el cliente.
      requiere_cotizar_flete: FLETE_POR_COTIZAR.includes(order.envio_estado),
      entrega_estimada: order.estimated_delivery ?? null,
      notas: order.notas ?? "",
    },
    items: (items ?? []).map((i) => ({ titulo: i.title, cantidad: i.qty, total: Number(i.total ?? 0) })),
    enlaces: {
      admin_pedidos: base ? `${base}/pedidos` : "",
      cliente_pedidos: base ? `${base}/perfil/pedidos` : "",
    },
  };
}

/**
 * Lee el pedido ya guardado y avisa a n8n. Pensado para llamarse SIN await después de responder al cliente.
 * Devuelve { ok, motivo? } solo para pruebas; nunca lanza.
 */
export async function notificarPedidoPagado({ supabaseAdmin, orderId, fetchImpl = fetch, env = process.env }) {
  const url = env.N8N_PEDIDO_PAGADO_URL;
  if (!url) return { ok: false, motivo: "sin N8N_PEDIDO_PAGADO_URL" };
  try {
    const { data: order, error } = await supabaseAdmin.from("orders").select("*").eq("id", orderId).single();
    if (error || !order) throw new Error(error?.message ?? "pedido no encontrado");
    const { data: items } = await supabaseAdmin
      .from("order_items")
      .select("title, qty, total")
      .eq("order_id", orderId);

    const payload = armarPayloadPedido(order, items, { siteUrl: env.FRONTEND_URL });
    const res = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-webhook-secret": env.N8N_WEBHOOK_SECRET ?? "" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`n8n respondió ${res.status}`);
    return { ok: true };
  } catch (err) {
    console.error(`⚠️ No se pudo avisar a n8n del pedido ${orderId}:`, err.message);
    return { ok: false, motivo: err.message };
  }
}
