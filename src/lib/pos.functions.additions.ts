// src/lib/pos.functions.additions.ts
// Funciones adicionales para la vista del carpintero

import { z } from "zod";
import { getAuthenticatedClient } from "@/integrations/supabase/auth-middleware";
import type { MaterialNecesario } from "@/types/produccion";

/**
 * Obtiene los materiales necesarios para una orden de producción.
 *
 * ESTRATEGIA:
 * Para órdenes creadas desde el MRP (enviarAProduccion), los insumos
 * ya fueron descontados y registrados en insumo_movimientos con
 * referencia = order_number. Los leemos desde ahí.
 *
 * Para órdenes de ecommerce (order_items con sku/modelo), intentamos
 * calcular desde el BOM.
 */
export async function getMaterialesOrden(input: {
  order_id: string;
}): Promise<{ materiales: MaterialNecesario[] }> {
  const { order_id } = z.object({ order_id: z.string().uuid() }).parse(input);
  const { supabase } = await getAuthenticatedClient();

  // 1. Obtener el order_number para buscar en movimientos
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("order_number")
    .eq("id", order_id)
    .single();

  if (orderErr || !order) return { materiales: [] };

  // 2. Buscar movimientos de salida registrados para esta orden
  //    (referencia = order_number, tipo = "salida")
  const { data: movs, error: movsErr } = await supabase
    .from("insumo_movimientos")
    .select("cantidad, motivo, insumos(id, nombre, unidad, stock_actual)")
    .eq("referencia", order.order_number)
    .eq("tipo", "salida");

  if (movsErr) throw new Error(movsErr.message);

  if (movs && movs.length > 0) {
    // Agregar por insumo (puede haber varios movimientos del mismo)
    const mapa = new Map<string, { nombre: string; unidad: string; necesario: number; stock_actual: number }>();
    for (const mov of movs) {
      const ins = mov.insumos as { id: string; nombre: string; unidad: string; stock_actual: number };
      if (!ins) continue;
      const existing = mapa.get(ins.id);
      if (existing) {
        existing.necesario += Number(mov.cantidad);
      } else {
        mapa.set(ins.id, {
          nombre: ins.nombre,
          unidad: ins.unidad,
          necesario: Number(mov.cantidad),
          stock_actual: Number(ins.stock_actual),
        });
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

  // 3. Fallback: intentar calcular desde BOM si los order_items tienen sku con modelo/talla
  const { data: items, error: itemsErr } = await supabase
    .from("order_items")
    .select("sku, title, qty")
    .eq("order_id", order_id);

  if (itemsErr || !items?.length) return { materiales: [] };

  const pedidos: Array<{ modelo: string; talla: string; cantidad: number }> = [];

  for (const item of items) {
    if (item.sku) {
      const parts = item.sku.split("-");
      if (parts.length >= 3) {
        pedidos.push({
          modelo: parts[1] ?? "",
          talla: parts[2] ?? "",
          cantidad: Number(item.qty),
        });
      }
    }
  }

  if (!pedidos.length) return { materiales: [] };

  const { data: boms, error: bomErr } = await supabase
    .from("bom_items")
    .select("modelo, talla, cantidad, insumos(id, nombre, unidad, stock_actual)")
    .or(
      pedidos
        .map((p) => `and(modelo.eq.${p.modelo},talla.eq.${p.talla})`)
        .join(",")
    );

  if (bomErr) throw new Error(bomErr.message);

  const mapa = new Map<string, { nombre: string; unidad: string; necesario: number; stock_actual: number }>();

  for (const pedido of pedidos) {
    const bomsDelPedido = (boms ?? []).filter(
      (b) => b.modelo === pedido.modelo && b.talla === pedido.talla
    );
    for (const bom of bomsDelPedido) {
      const ins = bom.insumos as { id: string; nombre: string; unidad: string; stock_actual: number };
      const existing = mapa.get(ins.id);
      if (existing) {
        existing.necesario += Number(bom.cantidad) * pedido.cantidad;
      } else {
        mapa.set(ins.id, {
          nombre: ins.nombre,
          unidad: ins.unidad,
          necesario: Number(bom.cantidad) * pedido.cantidad,
          stock_actual: Number(ins.stock_actual),
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