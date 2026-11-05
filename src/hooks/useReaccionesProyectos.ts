// src/hooks/useReaccionesProyectos.ts
// Reacciones a los proyectos (/proyectos). Solo con sesión: sin sesión se abre el login y la reacción
// elegida se aplica al volver. Una reacción por persona y proyecto: tocar la misma la quita; otra la cambia.
// Conteos: vista pública `v_proyecto_reacciones_conteo`; la reacción propia: tabla `proyecto_reacciones` (RLS).
import { useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAuthModalStore } from "@/stores/authModalStore";

export const REACCIONES = [
  { tipo: "me_gusta", emoji: "👍", etiqueta: "Me gusta" },
  { tipo: "me_encanta", emoji: "❤️", etiqueta: "Me encanta" },
  { tipo: "impresionante", emoji: "😮", etiqueta: "Impresionante" },
  { tipo: "lo_quiero", emoji: "🙌", etiqueta: "Lo quiero" },
] as const;

export type TipoReaccion = (typeof REACCIONES)[number]["tipo"];
export type ConteoProyecto = Partial<Record<TipoReaccion, number>>;

interface Datos {
  conteos: Record<string, ConteoProyecto>;
  mias: Record<string, TipoReaccion>;
}

const VACIO: Datos = { conteos: {}, mias: {} };
const PENDIENTE_KEY = "gm_reaccion_pendiente";
const TIPOS = new Set<string>(REACCIONES.map((r) => r.tipo));

export function totalReacciones(c?: ConteoProyecto): number {
  return c ? Object.values(c).reduce((a, n) => a + (n ?? 0), 0) : 0;
}

async function cargar(userId: string | null): Promise<Datos> {
  // Si la migración aún no se ejecutó, las consultas fallan y simplemente no hay reacciones que mostrar.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: filas, error } = await sb.from("v_proyecto_reacciones_conteo").select("proyecto_id, tipo, total");
  if (error) return VACIO;
  const conteos: Datos["conteos"] = {};
  for (const f of (filas ?? []) as { proyecto_id: string; tipo: string; total: number }[]) {
    if (!TIPOS.has(f.tipo)) continue;
    (conteos[f.proyecto_id] ??= {})[f.tipo as TipoReaccion] = f.total;
  }
  const mias: Datos["mias"] = {};
  if (userId) {
    const { data } = await sb.from("proyecto_reacciones").select("proyecto_id, tipo").eq("user_id", userId);
    for (const f of (data ?? []) as { proyecto_id: string; tipo: string }[]) {
      if (TIPOS.has(f.tipo)) mias[f.proyecto_id] = f.tipo as TipoReaccion;
    }
  }
  return { conteos, mias };
}

export function useReaccionesProyectos() {
  const { user, loading: cargandoSesion } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id ?? null;
  const key = ["proyecto-reacciones", userId ?? "anon"] as const;
  const { data = VACIO, isSuccess } = useQuery({ queryKey: key, queryFn: () => cargar(userId), staleTime: 60_000, retry: 1 });

  const reaccionar = useCallback(
    async (proyectoId: string, tipo: TipoReaccion) => {
      if (!userId) {
        try {
          sessionStorage.setItem(PENDIENTE_KEY, JSON.stringify({ proyectoId, tipo }));
        } catch {
          /* sin almacenamiento: tendrá que reaccionar de nuevo tras iniciar sesión */
        }
        useAuthModalStore.getState().openLogin();
        return;
      }
      const antes = qc.getQueryData<Datos>(key) ?? VACIO;
      const previa = antes.mias[proyectoId];
      const quitar = previa === tipo;

      // Actualización inmediata en pantalla (se revierte si falla)
      const conteo = { ...(antes.conteos[proyectoId] ?? {}) };
      if (previa) conteo[previa] = Math.max(0, (conteo[previa] ?? 1) - 1);
      if (!quitar) conteo[tipo] = (conteo[tipo] ?? 0) + 1;
      const mias = { ...antes.mias };
      if (quitar) delete mias[proyectoId];
      else mias[proyectoId] = tipo;
      qc.setQueryData<Datos>(key, { conteos: { ...antes.conteos, [proyectoId]: conteo }, mias });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const { error } = quitar
        ? await sb.from("proyecto_reacciones").delete().eq("proyecto_id", proyectoId).eq("user_id", userId)
        : await sb.from("proyecto_reacciones").upsert({ proyecto_id: proyectoId, user_id: userId, tipo }, { onConflict: "proyecto_id,user_id" });
      if (error) {
        qc.setQueryData<Datos>(key, antes);
        toast.error("No pudimos guardar tu reacción. Intenta de nuevo.");
        return;
      }
      void qc.invalidateQueries({ queryKey: ["proyecto-reacciones"] });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, qc],
  );

  // Tras iniciar sesión: aplica la reacción que la persona eligió antes de entrar (solo si aún no la tiene)
  useEffect(() => {
    if (!userId || cargandoSesion || !isSuccess) return;
    let crudo: string | null = null;
    try {
      crudo = sessionStorage.getItem(PENDIENTE_KEY);
      if (crudo) sessionStorage.removeItem(PENDIENTE_KEY);
    } catch {
      return;
    }
    if (!crudo) return;
    try {
      const p = JSON.parse(crudo) as { proyectoId?: string; tipo?: string };
      if (p.proyectoId && p.tipo && TIPOS.has(p.tipo) && data.mias[p.proyectoId] !== p.tipo) {
        void reaccionar(p.proyectoId, p.tipo as TipoReaccion);
      }
    } catch {
      /* dato corrupto: se ignora */
    }
  }, [userId, cargandoSesion, isSuccess, data.mias, reaccionar]);

  return { conteos: data.conteos, mias: data.mias, reaccionar, haySesion: !!userId };
}
