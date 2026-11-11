import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/hooks/useAuth";
import { evaluarCaja } from "@/lib/cajaAlerta";
import { useAhora } from "@/hooks/useAhora";

/** Turno de caja abierto (como máximo uno: índice único uq_caja_turno_abierto). */
export async function getCajaAbiertaLigera(): Promise<{ id: string; abierta_at: string } | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("caja_turnos").select("id, abierta_at").eq("estado", "abierta").maybeSingle();
  if (error) throw error;
  return data ?? null;
}

/** Estado de alerta de la caja para el personal (admin / vendedor). No cierra nada. */
export function useCajaAlerta(roles: AppRole[]) {
  const enabled = roles.includes("admin") || roles.includes("vendedor");
  const { data: turno } = useQuery({
    queryKey: ["caja-alerta"],
    queryFn: getCajaAbiertaLigera,
    enabled,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: true,
    staleTime: 60_000,
  });
  const ahora = useAhora(60_000);
  const alerta = useMemo(() => evaluarCaja(turno?.abierta_at, ahora), [turno, ahora]);
  return { turno: turno ?? null, alerta, ahora };
}
