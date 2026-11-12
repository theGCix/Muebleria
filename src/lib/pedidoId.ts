// src/lib/pedidoId.ts
// Número de pedido que ve el cliente: siempre "GM-" + 12 dígitos (el mismo que guarda el servidor en orders.order_number).
// Niubiz solo recibe los dígitos (purchaseNumber); esta función solo cambia cómo se muestra.
export function numeroPedido(valor: string | null | undefined): string {
  const v = String(valor ?? "").trim();
  return /^\d{1,12}$/.test(v) ? `GM-${v}` : v;
}
