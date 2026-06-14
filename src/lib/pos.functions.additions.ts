// ─────────────────────────────────────────────────────────────
// AGREGAR en src/lib/pos.functions.ts
// Funciones nuevas para la vista detallada del carpintero
// ─────────────────────────────────────────────────────────────

import type { MaterialNecesario } from "@/types/produccion";

/**
 * Obtiene los materiales BOM necesarios para todos los ítems
 * de una orden, calculando la cantidad total por insumo
 * y comparando contra stock actual.
 *
 * Usa la tabla bom_items con join a insumos.
 * Si un ítem no tiene SKU o no existe en BOM, lo omite sin error.
 *
 * Agregar junto a getDetalleProduccion en pos.functions.ts
 */
export async function getMaterialesOrden(input: {
  order_id: string;
}): Promise<{ materiales: MaterialNecesario[] }> {
  const { order_id } = z.object({ order_id: z.string().uuid() }).parse(input);
  const { supabase } = await getAuthenticatedClient();

  // 1. Traer ítems del pedido (necesitamos modelo = título normalizado y talla)
  const { data: items, error: itemsErr } = await supabase
    .from("order_items")
    .select("id, sku, title, qty, personalizacion")
    .eq("order_id", order_id);

  if (itemsErr) throw new Error(itemsErr.message);
  if (!items?.length) return { materiales: [] };

  // 2. Para cada ítem, extraer modelo + talla del SKU o title
  //    Convención: SKU formato "MOD-TALLA-XXX" → modelo=MOD, talla=TALLA
  //    Si no hay SKU, intentamos extraer modelo del title directamente.
  const pedidos: Array<{ modelo: string; talla: string; cantidad: number }> = [];

  for (const item of items) {
    let modelo = "";
    let talla = "";

    if (item.sku) {
      // "SOF-LON-3C" → modelo="London", talla="3 cuerpos"  (depende de tu nomenclatura)
      // Ajusta esta lógica según tu sistema de SKU
      const parts = item.sku.split("-");
      if (parts.length >= 2) {
        modelo = parts[1] ?? "";
        talla = parts[2] ?? "";
      }
    }

    // Fallback: usar personalizacion JSONB si existe
    if (!modelo && item.personalizacion) {
      const p = item.personalizacion as Record<string, string>;
      modelo = p.modelo ?? "";
      talla = p.talla ?? "";
    }

    if (modelo && talla) {
      pedidos.push({ modelo, talla, cantidad: item.qty });
    }
  }

  if (!pedidos.length) return { materiales: [] };

  // 3. Traer BOM items para los modelos/tallas identificados
  //    Hacemos una query con OR filters
  const { data: boms, error: bomErr } = await supabase
    .from("bom_items")
    .select("modelo, talla, cantidad, insumos(id, nombre, unidad, stock_actual)")
    .or(
      pedidos
        .map((p) => `and(modelo.eq.${p.modelo},talla.eq.${p.talla})`)
        .join(",")
    );

  if (bomErr) throw new Error(bomErr.message);

  // 4. Agregar necesidad total por insumo
  const mapa = new Map<
    string,
    { nombre: string; unidad: string; necesario: number; stock_actual: number }
  >();

  for (const pedido of pedidos) {
    const bomsDelPedido = (boms ?? []).filter(
      (b) => b.modelo === pedido.modelo && b.talla === pedido.talla
    );
    for (const bom of bomsDelPedido) {
      const ins = bom.insumos as {
        id: string;
        nombre: string;
        unidad: string;
        stock_actual: number;
      };
      const existing = mapa.get(ins.id);
      if (existing) {
        existing.necesario += bom.cantidad * pedido.cantidad;
      } else {
        mapa.set(ins.id, {
          nombre: ins.nombre,
          unidad: ins.unidad,
          necesario: bom.cantidad * pedido.cantidad,
          stock_actual: ins.stock_actual,
        });
      }
    }
  }

  const materiales: MaterialNecesario[] = Array.from(mapa.entries()).map(
    ([insumo_id, v]) => ({
      insumo_id,
      nombre: v.nombre,
      unidad: v.unidad,
      necesario: v.necesario,
      stock_actual: v.stock_actual,
      stockOk: v.stock_actual >= v.necesario,
    })
  );

  return { materiales };
}
