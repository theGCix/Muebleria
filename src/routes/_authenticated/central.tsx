import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getDashboardKpis } from "@/lib/pos.functions";
import { useEffect, useRef, useState } from "react";
import { format, startOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { PeriodFilter, usePeriodo } from "@/components/admin/PeriodFilter";
import { rangoParaSql } from "@/lib/periodo";
import {
  Clock, Hammer, Package, CheckCircle2, Truck,
  AlertTriangle, Box,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/central")({
  head: () => ({ meta: [{ title: "G&M · Central KPIs" }] }),
  component: CentralPage,
});

// ── Helpers ──────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat("es-PE", {
    style: "currency", currency: "PEN", maximumFractionDigits: 0,
  }).format(n);

const fmtShort = (n: number) =>
  n >= 1000 ? `S/ ${(n / 1000).toFixed(1)}k` : fmt(n);

const hoy = () => format(new Date(), "yyyy-MM-dd");
const inicioMes = () => format(startOfMonth(new Date()), "yyyy-MM-dd");

// ── Pipeline node ─────────────────────────────────────────────
function PipelineNode({
  icon: Icon, label, count, color, bg, isLast, alert,
}: {
  icon: React.ElementType; label: string; count: number;
  color: string; bg: string; isLast?: boolean; alert?: boolean;
}) {
  return (
    <div className="flex flex-col items-center flex-1 relative">
      {!isLast && (
        <div className="absolute top-[21px] z-0"
          style={{ left: "calc(50% + 21px)", right: "calc(-50% + 21px)", height: 1, background: "var(--border)" }} />
      )}
      <div
        className="w-11 h-11 rounded-full flex items-center justify-center relative z-10 flex-shrink-0"
        style={{ background: bg, color }}
      >
        <Icon className="h-4.5 w-4.5" />
      </div>
      <p className="font-display text-2xl font-semibold mt-1.5 leading-none" style={{ color: "var(--foreground)" }}>
        {count}
        {alert && <span className="text-sm ml-1" style={{ color: "#A32D2D" }}>⚠</span>}
      </p>
      <p className="text-[10px] uppercase tracking-wider text-center mt-1 max-w-[70px] leading-tight"
        style={{ color: "var(--muted-foreground)" }}>
        {label}
      </p>
    </div>
  );
}

// ── Alerta operacional ───────────────────────────────────────
function AlertPill({ icon: Icon, text, tipo }: {
  icon: React.ElementType; text: string; tipo: "warn" | "info" | "danger";
}) {
  const styles = {
    warn:   { bg: "#FAEEDA", color: "#854F0B" },
    info:   { bg: "#E6F1FB", color: "#185FA5" },
    danger: { bg: "#FCEBEB", color: "#A32D2D" },
  }[tipo];
  return (
    <div className="flex items-center gap-2 py-1.5 border-b last:border-0"
      style={{ borderColor: "var(--border)" }}>
      <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
        style={{ background: styles.bg }}>
        <Icon className="h-3.5 w-3.5" style={{ color: styles.color }} />
      </div>
      <span className="text-xs leading-tight" style={{ color: "var(--foreground)" }}>{text}</span>
    </div>
  );
}

// ── Reloj + countdown ─────────────────────────────────────────
function LiveClock({ onRefresh }: { onRefresh: () => void }) {
  const [time, setTime] = useState(new Date());
  const [countdown, setCountdown] = useState(90);
  const cdRef = useRef(90);

  useEffect(() => {
    const id = setInterval(() => {
      setTime(new Date());
      cdRef.current -= 1;
      if (cdRef.current <= 0) {
        cdRef.current = 90;
        onRefresh();
      }
      setCountdown(cdRef.current);
    }, 1000);
    return () => clearInterval(id);
  }, [onRefresh]);

  const urgent = countdown <= 10;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm tabular-nums" style={{ color: "var(--muted-foreground)" }}>
        {format(time, "HH:mm:ss")}
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className="w-2 h-2 rounded-full"
          style={{
            background: urgent ? "#E24B4A" : "#3B6D11",
            transition: "background 0.3s",
          }}
        />
        <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          {urgent ? `Actualizando en ${countdown}s...` : `En vivo · ${countdown}s`}
        </span>
      </span>
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────
function CentralPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const { valor: periodo, setValor: setPeriodo, rango } =
    usePeriodo({ granularidad: "mes", offset: 0 });
  const { desde, hasta } = rangoParaSql(rango);

  useEffect(() => {
    const channel = supabase
      .channel("central-live")
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        () => setRefreshKey((k) => k + 1)
      )
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "produccion" },
        () => setRefreshKey((k) => k + 1)
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const kpisQ = useQuery({
    queryKey: ["central-kpis", desde, hasta, refreshKey],
    queryFn: () => getDashboardKpis({ desde, hasta }),
    staleTime: 0,
  });

  const kpis = kpisQ.data;
  // Órdenes activas = suma de las cinco etapas que muestra el pipeline.
  const ordenesActivas = kpis
    ? (kpis.prod_pendientes ?? 0) + (kpis.prod_en_proceso ?? 0) + (kpis.ord_control_calidad ?? 0)
      + (kpis.ord_listo_despacho ?? 0) + (kpis.ord_enviado ?? 0)
    : null;

  const alertas = kpis ? [
    kpis.prod_vencidas > 0 && {
      icon: AlertTriangle,
      text: `${kpis.prod_vencidas} orden${kpis.prod_vencidas > 1 ? "es" : ""} de producción vencida${kpis.prod_vencidas > 1 ? "s" : ""}`,
      tipo: "danger" as const,
    },
    kpis.insumos_stock_bajo > 0 && {
      icon: Box,
      text: `${kpis.insumos_stock_bajo} insumo${kpis.insumos_stock_bajo > 1 ? "s" : ""} bajo stock mínimo`,
      tipo: "warn" as const,
    },
    kpis.oc_pendientes > 0 && {
      icon: Truck,
      text: `${kpis.oc_pendientes} OC pendiente${kpis.oc_pendientes > 1 ? "s" : ""} — ${fmt(kpis.oc_monto_pendiente)}`,
      tipo: "info" as const,
    },
  ].filter(Boolean) as Array<{ icon: React.ElementType; text: string; tipo: "warn" | "info" | "danger" }>
  : [];

  return (
    <div className="space-y-3 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between pb-3 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <h1 className="font-display text-xl font-semibold" style={{ color: "var(--foreground)" }}>
            G&M Mueblería
          </h1>
          <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>Central de KPIs</span>
          <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            · {rango.etiqueta}
          </span>
        </div>
        <LiveClock onRefresh={() => setRefreshKey((k) => k + 1)} />
      </div>

      {/* Periodo */}
      <PeriodFilter valor={periodo} onChange={setPeriodo} />

      {/* Métrica clave: órdenes activas en el pipeline de producción */}
      <div className="rounded-xl border p-4" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex items-end justify-between gap-3 mb-4">
          <p className="text-[10px] uppercase tracking-widest"
            style={{ color: "var(--muted-foreground)" }}>
            Órdenes en producción · pipeline
          </p>
          <p className="leading-none text-right" style={{ color: "var(--foreground)" }}>
            <span className="font-display text-4xl font-semibold tabular-nums">{ordenesActivas ?? "—"}</span>
            <span className="text-xs ml-1.5" style={{ color: "var(--muted-foreground)" }}>órdenes activas</span>
          </p>
        </div>
        <div className="flex items-start sm:px-4">
          <PipelineNode icon={Clock}        label="Pendiente"       count={kpis?.prod_pendientes ?? 0} color="#854F0B" bg="#FAEEDA" />
          <PipelineNode icon={Hammer}       label="En proceso"      count={kpis?.prod_en_proceso ?? 0} color="#185FA5" bg="#E6F1FB" />
          <PipelineNode icon={CheckCircle2} label="Control calidad" count={kpis?.ord_control_calidad ?? 0} color="#534AB7" bg="#EEEDFE" />
          <PipelineNode icon={Package}      label="Listo despacho"  count={kpis?.ord_listo_despacho ?? 0}  color="#0F6E56" bg="#E1F5EE" />
          <PipelineNode icon={Truck}        label="Enviado"         count={kpis?.ord_enviado ?? 0}         color="#3B6D11" bg="#EAF3DE" isLast />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 pt-3 border-t text-xs" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
          <span>Tiempo promedio: <strong style={{ color: "var(--foreground)" }}>
            {kpis?.tiempo_prod_promedio_dias
              ? `${kpis.tiempo_prod_promedio_dias} días`
              : "—"}
          </strong></span>
          <span>Terminadas ({rango.etiqueta}): <strong style={{ color: "var(--foreground)" }}>
            {kpis?.prod_terminadas ?? "—"}
          </strong></span>
          {(kpis?.prod_vencidas ?? 0) > 0 && (
            <span style={{ color: "#A32D2D", background: "#FCEBEB" }}
              className="px-2 rounded-full">
              ⚠ {kpis!.prod_vencidas} vencida{kpis!.prod_vencidas > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Información complementaria: alertas operacionales */}
      <div className="rounded-xl border p-4" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <p className="text-[10px] uppercase tracking-widest mb-3"
          style={{ color: "var(--muted-foreground)" }}>Alertas operacionales</p>
        {alertas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-4 gap-1.5">
            <CheckCircle2 className="h-6 w-6" style={{ color: "#3B6D11" }} />
            <p className="text-xs" style={{ color: "#3B6D11" }}>Todo en orden</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {alertas.map((a, i) => (
              <AlertPill key={i} {...a} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
