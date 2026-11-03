// src/lib/pos.functions.additions.ts
// Funciones adicionales para la vista del carpintero

// Antes había aquí una segunda copia de getMaterialesOrden que leía insumos, bom_items e
// insumo_movimientos directamente. Esas tablas ahora son solo de administrador: los
// materiales se piden a la función materiales_orden del servidor (ver pos.functions.ts).
export { getMaterialesOrden } from "@/lib/pos.functions";
