// server/pagosHuerfanos.js
// Registra cobros que Niubiz aprobó pero que no quedaron bien guardados en la BD.
// NUNCA lanza: si ni siquiera esto se puede guardar, el detalle completo queda en el log de Render
// (línea que empieza con 🚨 PAGO HUÉRFANO) para regularizarlo a mano.

export async function registrarPagoHuerfano({
  supabase, motivo, order = {}, items = [], orderNumber = null, purchaseNumber = null,
  monto = null, authCode = null, orderId = null, error = null,
}) {
  const fila = {
    motivo,
    order_number:     orderNumber,
    purchase_number:  purchaseNumber,
    niubiz_token:     order?.transactionToken ?? null,
    niubiz_auth_code: authCode,
    monto,
    order_id:         orderId,
    nombre:           order?.nombre   ?? null,
    email:            order?.email    ?? null,
    telefono:         order?.telefono ?? null,
    error:            error ? String(error).slice(0, 500) : null,
    detalle:          { order, items },
  };
  console.error("🚨 PAGO HUÉRFANO:", JSON.stringify({ ...fila, detalle: undefined }));
  try {
    const { error: dbErr } = await supabase.from("pagos_huerfanos").insert(fila);
    if (dbErr) {
      // 23505 = ya estaba registrado (mismo token y motivo): está bien.
      if (dbErr.code !== "23505") console.error("🚨 No se pudo guardar en pagos_huerfanos:", dbErr.message, JSON.stringify(fila.detalle));
    }
  } catch (e) {
    console.error("🚨 No se pudo guardar en pagos_huerfanos:", e?.message, JSON.stringify(fila.detalle));
  }
}
