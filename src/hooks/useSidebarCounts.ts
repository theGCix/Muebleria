import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/hooks/useAuth";

export type CountKey = "pedidos" | "leads" | "carritos" | "resenas" | "insumos";
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