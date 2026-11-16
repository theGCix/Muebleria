// src/lib/avisoLimiteCompra.ts
// Aviso único cuando se alcanza el tope de unidades por compra (lo llama cartStore).
import { toast } from "sonner";
import { CANTIDAD_MAX_POR_COMPRA } from "./limiteCompra";

export function avisoLimiteCompra(max: number = CANTIDAD_MAX_POR_COMPRA) {
  toast.info(`Máximo ${max} unidades por producto en cada compra`, {
    description: "Para pedidos mayores escríbenos por WhatsApp o pregúntale al asistente.",
    id: "limite-compra",
  });
}
