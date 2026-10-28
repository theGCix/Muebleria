import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/hooks/useAuth";

export type CountKey = "pedidos" | "leads" | "carritos" | "resenas" | "testimonios" | "insumos";
export type SidebarCounts = Partial<Record<CountKey, number>>;

// Cuenta filas sin traer datos (head + count exact).
async function countRows(run: () => PromiseLike<{ count: number | null; error: unknown }>) {
  const { count, error } = await run();
  if (error) throw error;
  return count ?? 0;
}

async function fetchCounts(): Promise<SidebarCounts> {
  const haceUnaHora = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const jobs: Record<CountKey, () => Promise<number>> = {
    // Pedidos por atender: mismo criterio que "pendientes" en /pedidos
    pedidos: () =>
      countRows(() =>
        supabase.from("orders").select("id", { count: "exact", head: true })
          .in("status", ["pendiente", "pagado"]),
      ),
    // Leads sin contactar
    leads: () =>
      countRows(() =>
        supabase.from("leads").select("id", { count: "exact", head: true })
          .eq("estado", "nuevo"),
      ),
    // Carritos abandonados (>1 h) que nadie ha contactado todavía
    carritos: () =>
      countRows(() =>
        supabase.from("carritos").select("id", { count: "exact", head: true })
          .eq("estado", "activo").lte("last_activity_at", haceUnaHora),
      ),
    // Reseñas por moderar
    resenas: () =>
      countRows(() =>
        supabase.from("resenas").select("id", { count: "exact", head: true })
          .eq("aprobada", false).is("motivo_rechazo", null),
      ),
    // Fotos de clientes por aprobar (testimonios)
    testimonios: () =>
      countRows(() =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from("galeria_clientes").select("id", { count: "exact", head: true }).eq("estado", "pendiente"),
      ),
    // Insumos bajo el stock mínimo
    insumos: () =>
      countRows(() =>
        supabase.from("v_insumos_stock_bajo").select("*", { count: "exact", head: true }),
      ),
  };

  // allSettled: si una consulta falla (ej. permisos), las demás siguen funcionando.
  const keys = Object.keys(jobs) as CountKey[];
  const results = await Promise.allSettled(keys.map((k) => jobs[k]()));
  const out: SidebarCounts = {};
  results.forEach((r, i) => {
    if (r.status === "fulfilled") out[keys[i]] = r.value;
  });
  return out;
}

export function useSidebarCounts(roles: AppRole[]) {
  // El carpintero no ve estos módulos: no hace falta consultar nada.
  const enabled = roles.includes("admin") || roles.includes("vendedor");
  const { data } = useQuery({
    queryKey: ["sidebar-counts"],
    queryFn: fetchCounts,
    enabled,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
  return data ?? {};
}

// Nombre único por suscripción: supabase.channel(nombre) devuelve el canal existente si el nombre se repite,
// y añadir listeners a un canal ya suscrito lanza un error que tumba la página.
let channelSeq = 0;
export const uniqueChannelName = (base: string) => `${base}-${++channelSeq}`;

// Tiempo real de los contadores. Debe montarse UNA sola vez (en el layout del panel),
// no en cada componente que lee los conteos.
// Los carritos abandonados no se escuchan: "abandonado" depende del tiempo sin actividad,
// no de un evento, y los clientes los actualizan constantemente; ese conteo lo cubre el refresco periódico.
export function useSidebarCountsRealtime(roles: AppRole[]) {
  const enabled = roles.includes("admin") || roles.includes("vendedor");
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Un pequeño retardo agrupa ráfagas de cambios en una sola consulta.
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => qc.invalidateQueries({ queryKey: ["sidebar-counts"] }), 1500);
    };

    let channel = supabase.channel(uniqueChannelName("sidebar-counts-live"));
    for (const table of ["orders", "leads", "resenas", "galeria_clientes", "insumos"]) {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, refresh);
    }
    channel.subscribe();

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [enabled, qc]);
}