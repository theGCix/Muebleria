// src/lib/leads.functions.ts
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { getAuthenticatedClient } from "@/integrations/supabase/auth-middleware";
import { getSessionId } from "@/hooks/useEventTracking";
import { getStoredUtm } from "@/hooks/useUtm";

export const LEAD_ESTADOS = [
  "nuevo", "contactado", "interesado", "cotizacion_enviada",
  "negociacion", "ganado", "perdido",
] as const;

export const LEAD_ORIGENES = [
  "web", "whatsapp", "facebook", "instagram", "tienda", "referido", "otro",
] as const;

export type LeadEstado = typeof LEAD_ESTADOS[number];
export type LeadOrigen = typeof LEAD_ORIGENES[number];

export interface Lead {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  producto_id: string | null;
  producto_nombre: string | null;
  mensaje: string | null;
  origen: LeadOrigen;
  estado: LeadEstado;
  asesor_id: string | null;
  customer_id: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

// ── Captura pública (sin login) ─────────────────────────────
const CreateLeadSchema = z.object({
  nombre: z.string().min(2).max(255),
  telefono: z.string().min(6).max(20).optional().nullable(),
  email: z.string().email().max(255).optional().nullable().or(z.literal("")),
  producto_id: z.string().uuid().optional().nullable(),
  producto_nombre: z.string().max(255).optional().nullable(),
  mensaje: z.string().max(2000).optional().nullable(),
  origen: z.enum(LEAD_ORIGENES).default("web"),
});

export async function createLead(input: z.infer<typeof CreateLeadSchema>) {
  const data = CreateLeadSchema.parse(input);
  const utm = getStoredUtm();

  const { error } = await supabase.from("leads").insert({
    nombre: data.nombre,
    telefono: data.telefono || null,
    email: data.email || null,
    producto_id: data.producto_id || null,
    producto_nombre: data.producto_nombre || null,
    mensaje: data.mensaje || null,
    origen: data.origen,
    session_id: getSessionId(),
    utm_source: utm.utm_source ?? null,
    utm_medium: utm.utm_medium ?? null,
    utm_campaign: utm.utm_campaign ?? null,
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

// ── Gestión de staff (requiere sesión admin/vendedor) ───────
export async function listLeads(input?: { q?: string; estado?: LeadEstado | "todos" }) {
  const { supabase } = await getAuthenticatedClient();
  let query = supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);

  if (input?.estado && input.estado !== "todos") {
    query = query.eq("estado", input.estado);
  }
  const q = input?.q?.trim();
  if (q) {
    query = query.or(`nombre.ilike.%${q}%,telefono.ilike.%${q}%,email.ilike.%${q}%,producto_nombre.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return { leads: (data ?? []) as Lead[] };
}

const UpdateLeadSchema = z.object({
  id: z.string().uuid(),
  estado: z.enum(LEAD_ESTADOS).optional(),
  asesor_id: z.string().uuid().nullable().optional(),
  notas: z.string().max(2000).nullable().optional(),
});

export async function updateLead(input: z.infer<typeof UpdateLeadSchema>) {
  const data = UpdateLeadSchema.parse(input);
  const { supabase } = await getAuthenticatedClient();

  const patch: Record<string, unknown> = {};
  if (data.estado !== undefined) patch.estado = data.estado;
  if (data.asesor_id !== undefined) patch.asesor_id = data.asesor_id;
  if (data.notas !== undefined) patch.notas = data.notas;

  const { error } = await supabase.from("leads").update(patch).eq("id", data.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

// Convierte un lead ganado en un customer real (o lo vincula a uno existente)
export async function convertLeadToCustomer(input: { lead_id: string; customer_id: string }) {
  const data = z.object({
    lead_id: z.string().uuid(),
    customer_id: z.string().uuid(),
  }).parse(input);

  const { supabase } = await getAuthenticatedClient();
  const { error } = await supabase
    .from("leads")
    .update({ customer_id: data.customer_id, estado: "ganado" })
    .eq("id", data.lead_id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

// Lista de staff (admin/vendedor) para el selector de "asesor asignado"
export async function listAsesores() {
  const { supabase } = await getAuthenticatedClient();
  const { data: roles, error: rolesErr } = await supabase
    .from("user_roles")
    .select("user_id")
    .in("role", ["admin", "vendedor"]);
  if (rolesErr) throw new Error(rolesErr.message);

  const ids = [...new Set((roles ?? []).map((r) => r.user_id))];
  if (ids.length === 0) return { asesores: [] };

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", ids);
  if (error) throw new Error(error.message);
  return { asesores: profiles ?? [] };
}