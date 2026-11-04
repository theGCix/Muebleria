// Validaciones de órdenes de compra (Fase 3).
// Una sola fuente de verdad: la usan el formulario, las funciones del servidor
// y — con los mismos números — la migración 20261104c_oc_validaciones_fase3.sql.
// Si cambias un límite aquí, cámbialo también en la función SQL oc_limite_cantidad().

/** Tope de cantidad por línea según la unidad de medida. */
export const LIMITE_CANTIDAD: Record<string, number> = {
  unidades: 100,
  piezas: 500,
  paquetes: 50,
  bolsas: 100,
  planchas: 50,
  kg: 200,
  metros: 300,
  litros: 100,
  pies: 1000,
  palos: 200,
};
export const LIMITE_CANTIDAD_DEFECTO = 100;

/** Tope de precio unitario (S/) y de total de una OC sin IGV (S/). */
export const MAX_PRECIO_UNIT = 2000;
export const MAX_TOTAL_OC = 20000;

export type ItemOC = { descripcion?: string; unidad: string; cantidad: number; precio_unit: number };

export const limiteCantidad = (unidad: string) => LIMITE_CANTIDAD[unidad] ?? LIMITE_CANTIDAD_DEFECTO;

export const totalItems = (items: ItemOC[]) =>
  items.reduce((s, it) => s + it.cantidad * it.precio_unit, 0);

/** Errores que bloquean guardar el borrador. */
export function validarItemsOC(items: ItemOC[]): string[] {
  const errores: string[] = [];
  items.forEach((it, i) => {
    const n = `Ítem ${i + 1}`;
    const max = limiteCantidad(it.unidad);
    if (!(it.cantidad > 0)) errores.push(`${n}: la cantidad debe ser mayor a 0.`);
    else if (it.cantidad > max)
      errores.push(`${n}: máximo ${max} ${it.unidad} por línea (pusiste ${it.cantidad}).`);
    if (it.precio_unit < 0) errores.push(`${n}: el precio no puede ser negativo.`);
    else if (it.precio_unit > MAX_PRECIO_UNIT)
      errores.push(`${n}: precio unitario inusual (máx. S/ ${MAX_PRECIO_UNIT}).`);
  });
  if (totalItems(items) > MAX_TOTAL_OC)
    errores.push(`El total supera S/ ${MAX_TOTAL_OC.toLocaleString("es-PE")} sin IGV; divide la orden o pide autorización.`);
  return errores;
}

/** Errores adicionales que bloquean ENVIAR la OC al proveedor. */
export function validarOCParaEnvio(items: ItemOC[]): string[] {
  const errores = validarItemsOC(items);
  if (items.length === 0) errores.push("La orden no tiene ítems.");
  items.forEach((it, i) => {
    if (!(it.precio_unit > 0)) errores.push(`Ítem ${i + 1}: falta el precio (está en S/ 0).`);
  });
  if (items.length > 0 && !(totalItems(items) > 0)) errores.push("El total de la orden es S/ 0.");
  return errores;
}
