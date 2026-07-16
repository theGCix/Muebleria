// src/lib/perfil.functions.ts
// G&M Mueblería — Acceso a datos del perfil del cliente
// (datos personales, direcciones y datos de facturación)
import { supabase } from "@/integrations/supabase/client";

// ── Tipos ───────────────────────────────────────────────────
export type DocTipo = "DNI" | "RUC" | "CE" | "PASAPORTE";

export interface Profile {
  id: string;
  nombre: string | null;
  apellido: string | null;
  doc_tipo: DocTipo | null;
  doc_numero: string | null;
  telefono_principal: string | null;
  telefono_alternativo: string | null;
}

export interface Address {
  id: string;
  user_id: string;
  etiqueta: string;
  direccion: string;
  distrito: string | null;
  ciudad: string;
  referencia: string | null;
  predeterminada: boolean;
  created_at?: string;
}

export interface BillingInfo {
  id: string;
  tipo_comprobante: "boleta" | "factura";
  ruc: string | null;
  razon_social: string | null;
  direccion_fiscal: string | null;
}

// ── Datos personales ────────────────────────────────────────
export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles" as any)
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Profile | null;
}

export async function saveProfile(profile: Profile): Promise<void> {
  const { error } = await supabase
    .from("profiles" as any)
    .upsert(profile, { onConflict: "id" });
  if (error) throw new Error(error.message);
}

// ── Direcciones ─────────────────────────────────────────────
export async function fetchAddresses(userId: string): Promise<Address[]> {
  const { data, error } = await supabase
    .from("addresses" as any)
    .select("*")
    .eq("user_id", userId)
    .order("predeterminada", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Address[];
}

export async function saveAddress(
  address: Partial<Address> & { user_id: string; direccion: string; ciudad: string }
): Promise<void> {
  const { error } = await supabase.from("addresses" as any).upsert(address);
  if (error) throw new Error(error.message);
}

export async function deleteAddress(id: string): Promise<void> {
  const { error } = await supabase.from("addresses" as any).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setDefaultAddress(userId: string, id: string): Promise<void> {
  // El trigger addresses_single_default desmarca automáticamente las demás
  const { error } = await supabase
    .from("addresses" as any)
    .update({ predeterminada: true })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

// ── Datos de facturación ────────────────────────────────────
export async function fetchBillingInfo(userId: string): Promise<BillingInfo | null> {
  const { data, error } = await supabase
    .from("billing_info" as any)
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as BillingInfo | null;
}

export async function saveBillingInfo(info: BillingInfo): Promise<void> {
  const { error } = await supabase
    .from("billing_info" as any)
    .upsert(info, { onConflict: "id" });
  if (error) throw new Error(error.message);
}