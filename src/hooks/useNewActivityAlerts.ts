import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/hooks/useAuth";
import { uniqueChannelName } from "@/hooks/useSidebarCounts";

const money = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n);

// Avisos emergentes cuando entra actividad nueva (pedido, pago o lead) mientras el panel está abierto.
// Solo para admin y vendedor. Requiere que las tablas estén publicadas en Supabase Realtime
// (ver la migración 20261024_realtime_sidebar_counts.sql).
export function useNewActivityAlerts(roles: AppRole[]) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const enabled = roles.includes("admin") || roles.includes("vendedor");

  useEffect(() => {
    if (!enabled) return;

    // Evita avisar dos veces del mismo pago (el pedido se actualiza varias veces).
    const paidNotified = new Set<string>();

    const verPedido = (numero: string) => () =>
      navigate({ to: "/pedidos", search: { q: numero } } as never);

    const channel = supabase
      .channel(uniqueChannelName("new-activity-alerts"))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (payload) => {
        const o = payload.new as {
          id: string; order_number?: string; nombre?: string; total?: number; status?: string;
        };
        qc.invalidateQueries({ queryKey: ["orders"] });
        const numero = o.order_number ?? "";
        const detalle = [o.nombre, o.total != null ? money(Number(o.total)) : null].filter(Boolean).join(" · ");
        if (o.status === "pagado") paidNotified.add(o.id);
        toast.success(o.status === "pagado" ? "Nuevo pedido pagado" : "Nuevo pedido", {
          description: `${numero ? `${numero} — ` : ""}${detalle}${o.status === "pendiente" ? " · pendiente de pago" : ""}`,
          action: numero ? { label: "Ver", onClick: verPedido(numero) } : undefined,
          duration: 10000,
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, (payload) => {
        const o = payload.new as {
          id: string; order_number?: string; nombre?: string; total?: number; status?: string; paid_at?: string | null;
        };
        qc.invalidateQueries({ queryKey: ["orders"] });
        // Pago confirmado hace poco (se descartan ediciones posteriores de un pedido ya pagado).
        const pagoReciente = o.paid_at && Date.now() - new Date(o.paid_at).getTime() < 2 * 60 * 1000;
        if (o.status === "pagado" && pagoReciente && !paidNotified.has(o.id)) {
          paidNotified.add(o.id);
          const numero = o.order_number ?? "";
          toast.success("Pedido pagado", {
            description: `${numero ? `${numero} — ` : ""}${[o.nombre, o.total != null ? money(Number(o.total)) : null].filter(Boolean).join(" · ")}`,
            action: numero ? { label: "Ver", onClick: verPedido(numero) } : undefined,
            duration: 10000,
          });
        }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "leads" }, (payload) => {
        const l = payload.new as { nombre?: string; producto_nombre?: string | null };
        qc.invalidateQueries({ queryKey: ["leads"] });
        toast.info("Nuevo lead", {
          description: [l.nombre, l.producto_nombre].filter(Boolean).join(" · ") || undefined,
          action: { label: "Ver", onClick: () => navigate({ to: "/leads" } as never) },
          duration: 10000,
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, navigate, qc]);
}
