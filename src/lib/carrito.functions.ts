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
  // Marcas del seguimiento automático (n8n): fecha del aviso 1 / aviso 2. OJO: la migración de n8n marcó
  // carritos antiguos SIN enviar nada; solo `recordatorio_enviado = true` significa que n8n envió un correo.
  recordatorio_1_at?: string | null;
  recordatorio_2_at?: string | null;
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
    const { error } = await supabase.rpc("sync_cart_snapshot" as never, {
      p_session_id: data.session_id,
      p_items: data.items,
      p_subtotal: data.subtotal,
      p_nombre: data.nombre || null,
      p_email: data.email || null,
      p_telefono: data.telefono || null,
      p_distrito: data.distrito || null,
    } as never);
    if (error) console.warn("[carrito] no se pudo guardar:", error.message);
  } catch (e) {
    console.warn("[carrito] no se pudo guardar:", e);
  }
}

export async function markCartRecovered(input: { session_id: string; order_id: string }) {
  try {
    const { error } = await supabase.rpc("mark_cart_recovered" as never, {
      p_session_id: input.session_id,
      p_order_id: input.order_id,
    } as never);
    if (error) console.warn("[carrito] no se pudo cerrar:", error.message);
  } catch (e) {
    console.warn("[carrito] no se pudo cerrar:", e);
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
  estado: z.enum(["activo", "contactado", "recuperado", "perdido"]),
});

// `carritos` no tiene política de UPDATE para el personal: un .update() directo se descartaba sin error.
// El cambio de estado pasa por la función cambiar_estado_carrito (guard de admin / vendedor).
export async function updateCarritoEstado(input: z.infer<typeof UpdateCarritoSchema>) {
  const data = UpdateCarritoSchema.parse(input);
  const { supabase } = await getAuthenticatedClient();
  const { error } = await supabase.rpc("cambiar_estado_carrito" as never, {
    _carrito_id: data.id,
    _estado: data.estado,
  } as never);
  if (error) throw new Error(error.message);
  return { ok: true };
}

/**
 * Registra que el personal contactó al cliente (WhatsApp o correo). Pasa el carrito a «contactado» y, por
 * defecto, pausa los avisos automáticos de n8n para que no se duplique el contacto.
 */
export async function registrarContactoCarrito(input: { id: string; pausarAvisos?: boolean }) {
  const data = z.object({ id: z.string().uuid(), pausarAvisos: z.boolean().optional() }).parse(input);
  const { supabase } = await getAuthenticatedClient();
  const { data: res, error } = await supabase.rpc("registrar_contacto_carrito" as never, {
    _carrito_id: data.id,
    _pausar_avisos: data.pausarAvisos ?? true,
  } as never);
  if (error) throw new Error(error.message);
  return res as unknown as { ok: boolean; ya_contactado: boolean; avisos_pausados: boolean };
}

export interface CuponRecuperacion {
  estado: "creado" | "existente" | "no_disponible";
  motivo: "desactivado" | "vencido" | "usado" | null;
  codigo: string;
  valor: number;
  tipo_descuento: string;
  vence_el: string | null;
}

/** Obtiene (o crea una sola vez) el cupón de recuperación del carrito. Solo administrador. */
export async function obtenerCuponRecuperacion(input: { id: string }) {
  const data = z.object({ id: z.string().uuid() }).parse(input);
  const { supabase } = await getAuthenticatedClient();
  const { data: res, error } = await supabase.rpc("cupon_recuperacion_carrito" as never, {
    _carrito_id: data.id,
  } as never);
  if (error) throw new Error(error.message);
  return res as unknown as CuponRecuperacion;
}