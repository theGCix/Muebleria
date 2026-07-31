// src/lib/carrito.functions.ts
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { getAuthenticatedClient } from "@/integrations/supabase/auth-middleware";
import type { CartItem } from "@/stores/cartStore";

export interface CarritoAbandonado {
  id: string;
  session_id: string;
  user_id: string | null;
  nombre: string | null;
  email: string | null;
  telefono: string | null;
  distrito: string | null;
  items: CartItem[];
  subtotal: number;
  estado: "activo" | "contactado" | "recuperado" | "perdido";
  order_id: string | null;
  recordatorio_enviado: boolean;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
}

// ── Sincronización pública (sin login) ──────────────────────
// Se llama cada vez que cambia el carrito o los datos de contacto
// del checkout. Es un upsert por session_id: siempre refleja el
// último estado conocido de ese carrito en el navegador.
const SyncCartSchema = z.object({
  session_id: z.string().min(10).max(100),
  items: z.array(z.object({
    id: z.string(),
    title: z.string(),
    price: z.number(),
    qty: z.number(),
    image: z.string().optional().nullable(),
    sku: z.string().optional().nullable(),
  })),
  subtotal: z.number().min(0),
  nombre: z.string().max(255).optional().nullable(),
  email: z.string().email().max(255).optional().nullable().or(z.literal("")),
  telefono: z.string().max(30).optional().nullable(),
  distrito: z.string().max(100).optional().nullable(),
  user_id: z.string().uuid().optional().nullable(),
});

export async function syncCartSnapshot(input: z.infer<typeof SyncCartSchema>) {
  const data = SyncCartSchema.parse(input);
  try {
    await supabase.from("carritos").upsert(
      {
        session_id: data.session_id,
        items: data.items,
        subtotal: data.subtotal,
        nombre: data.nombre || null,
        email: data.email || null,
        telefono: data.telefono || null,
        distrito: data.distrito || null,
        user_id: data.user_id || null,
        estado: "activo",
        last_activity_at: new Date().toISOString(),
      },
      { onConflict: "session_id" }
    );
  } catch {
    // el tracking de carrito nunca debe romper la UX de compra
  }
}

// Se llama cuando el pedido se completa con éxito: cierra el
// carrito abandonado como "recuperado" y lo vincula al pedido.
export async function markCartRecovered(input: { session_id: string; order_id: string }) {
  try {
    await supabase
      .from("carritos")
      .update({ estado: "recuperado", order_id: input.order_id })
      .eq("session_id", input.session_id);
  } catch {
    // idem: nunca debe romper el flujo de compra
  }
}

// ── Gestión de staff ─────────────────────────────────────────
export async function listCarritosAbandonados(input?: { horasMin?: number }) {
  const horasMin = input?.horasMin ?? 1;
  const { supabase } = await getAuthenticatedClient();
  const limite = new Date(Date.now() - horasMin * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("carritos")
    .select("*")
    .in("estado", ["activo", "contactado"])
    .lte("last_activity_at", limite)
    .order("last_activity_at", { ascending: true })
    .limit(200);

  if (error) throw new Error(error.message);
  // jsonb_array_length no es filtrable fácil desde el cliente; filtramos vacíos aquí.
  const carritos = ((data ?? []) as CarritoAbandonado[]).filter((c) => (c.items?.length ?? 0) > 0);
  return { carritos };
}

const UpdateCarritoSchema = z.object({
  id: z.string().uuid(),
  estado: z.enum(["activo", "contactado", "recuperado", "perdido"]).optional(),
  recordatorio_enviado: z.boolean().optional(),
});

export async function updateCarritoEstado(input: z.infer<typeof UpdateCarritoSchema>) {
  const data = UpdateCarritoSchema.parse(input);
  const { supabase } = await getAuthenticatedClient();
  const patch: Record<string, unknown> = {};
  if (data.estado !== undefined) patch.estado = data.estado;
  if (data.recordatorio_enviado !== undefined) patch.recordatorio_enviado = data.recordatorio_enviado;

  const { error } = await supabase.from("carritos").update(patch).eq("id", data.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}