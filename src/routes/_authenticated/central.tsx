import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getDashboardKpis, getDashboardSeries } from "@/lib/pos.functions";
import { useEffect, useRef, useState } from "react";
import { format, startOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import {
  Clock, Hammer, Package, CheckCircle2, Truck,
  AlertTriangle, Box, ShoppingCart, Globe,
} from "lucide-react";

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
      {/* línea conectora */}
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

// ── Barra de ranking ──────────────────────────────────────────
function RankRow({ pos, name, total, maxTotal, color }: {
  pos: number; name: string; total: number; maxTotal: number; color: string;
}) {
  const pct = Math.round((total / maxTotal) * 100);
  return (
    <div className="flex items-center gap-2.5 py-1.5 border-b last:border-0"
      style={{ borderColor: "var(--border)" }}>
      <span className="text-[11px] w-4 text-right flex-shrink-0"
        style={{ color: "var(--muted-foreground)" }}>{pos}</span>
      <span className="text-xs flex-[0_0_82px] truncate" style={{ color: "var(--foreground)" }}>{name}</span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden"
        style={{ background: "var(--muted)" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-medium flex-shrink-0 min-w-[52px] text-right"
        style={{ color: "var(--foreground)" }}>
        {fmtShort(total)}
      </span>
    </div>
  );
}

// ── KPI Card grande ────────────────────────────────────────────
function KpiCard({
  label, value, sub, trend, alert,
}: {
  label: string; value: string; sub?: string;
  trend?: { pct: number } | null; alert?: boolean;
}) {
  return (
    <div
      className="rounded-xl p-4 border"
      style={{
        background: "var(--card)",
        borderColor: alert ? "#FAC775" : "var(--border)",
        backgroundColor: alert ? "oklch(0.985 0.025 80)" : undefined,
      }}
    >
      <p className="text-[10px] uppercase tracking-widest mb-1"
        style={{ color: "var(--muted-foreground)" }}>{label}</p>
      <p className="font-display text-3xl font-semibold leading-none"
        style={{ color: "var(--foreground)" }}>{value}</p>
      {sub && <p className="text-xs mt-1.5" style={{ color: "var(--muted-foreground)" }}>{sub}</p>}
      {trend && (
        <span
          className="inline-block mt-2 text-[11px] px-2 py-0.5 rounded-full"
          style={trend.pct >= 0
            ? { background: "#EAF3DE", color: "#3B6D11" }
            : { background: "#FAECE7", color: "#993C1D" }
          }
        >
          {trend.pct >= 0 ? "↑" : "↓"} {Math.abs(trend.pct)}% vs mes ant.
        </span>
      )}
    </div>
  );
}

// ── Alert pill ────────────────────────────────────────────────
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
  const [refreshKey, setRefreshKey] = useState(0);
  const desde = inicioMes();
  const hasta = hoy();

  const kpisQ = useQuery({
    queryKey: ["central-kpis", desde, hasta, refreshKey],
    queryFn: () => getDashboardKpis({ desde, hasta }),
    staleTime: 0,
  });

  const seriesQ = useQuery({
    queryKey: ["central-series", desde, hasta, refreshKey],
    queryFn: () => getDashboardSeries({ desde, hasta, agrupacion: "dia" }),
    staleTime: 0,
  });

  const kpis = kpisQ.data;
  const series = seriesQ.data;

  // Alertas operacionales derivadas de los KPIs
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

  const topProductos = series?.top_productos_pos?.slice(0, 5) ?? [];
  const topVendedores = series?.top_vendedores?.slice(0, 3) ?? [];
  const maxProducto = Math.max(...topProductos.map((p) => p.total), 1);
  const maxVendedor = Math.max(...topVendedores.map((v) => v.total), 1);

  const PRODUCT_COLORS = ["#378ADD", "#185FA5", "#0C447C", "#1D9E75", "#0F6E56"];
  const VENDOR_COLORS  = ["#378ADD", "#1D9E75", "#7F77DD"];

  return (
    <div className="space-y-3 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-baseline justify-between pb-3 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-baseline gap-3">
          <h1 className="font-display text-xl font-semibold" style={{ color: "var(--foreground)" }}>
            G&M Mueblería
          </h1>
          <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>Central de KPIs</span>
          <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            · {format(new Date(), "MMMM yyyy", { locale: es })}
          </span>
        </div>
        <LiveClock onRefresh={() => setRefreshKey((k) => k + 1)} />
      </div>

      {/* Fila 1: KPIs financieros */}
      <div className="grid grid-cols-4 gap-3">
        <div className="col-span-2">
          <KpiCard
            label="Ingresos del mes"
            value={kpis ? fmt(kpis.ingresos_totales) : "—"}
            sub={kpis
              ? `POS ${fmt(kpis.ventas_pos)} · Web ${fmt(kpis.ventas_ecommerce)}`
              : undefined}
            trend={kpis?.ingresos_var_pct != null ? { pct: kpis.ingresos_var_pct } : null}
          />
        </div>
        <KpiCard
          label="Ticket promedio POS"
          value={kpis ? fmt(kpis.ticket_promedio_pos) : "—"}
          sub={kpis ? `${kpis.ventas_pos_count} transacciones` : undefined}
        />
        <KpiCard
          label="Pedidos online pagados"
          value={kpis ? String(kpis.pedidos_ec_count) : "—"}
          sub={kpis ? `${kpis.clientes_nuevos} clientes nuevos` : undefined}
        />
      </div>

      {/* Fila 2: Pipeline de producción */}
      <div className="rounded-xl border p-4" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <p className="text-[10px] uppercase tracking-widest mb-4"
          style={{ color: "var(--muted-foreground)" }}>
          Pipeline de producción · órdenes activas
        </p>
        <div className="flex items-start px-4">
          <PipelineNode icon={Clock}        label="Pendiente"    count={kpis?.prod_pendientes ?? 0}  color="#854F0B" bg="#FAEEDA" />
          <PipelineNode icon={Hammer}       label="En proceso"   count={kpis?.prod_en_proceso ?? 0}  color="#185FA5" bg="#E6F1FB" />
          <PipelineNode icon={CheckCircle2} label="Control calidad" count={0}                        color="#534AB7" bg="#EEEDFE" />
          <PipelineNode icon={Package}      label="Listo despacho"  count={0}                        color="#0F6E56" bg="#E1F5EE" />
          <PipelineNode icon={Truck}        label="Enviado"      count={0}                           color="#3B6D11" bg="#EAF3DE" isLast />
        </div>
        <div className="flex gap-4 mt-3 pt-3 border-t text-xs" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
          <span>Tiempo promedio: <strong style={{ color: "var(--foreground)" }}>
            {kpis?.tiempo_prod_promedio_dias
              ? `${kpis.tiempo_prod_promedio_dias} días`
              : "—"}
          </strong></span>
          <span>Terminadas este mes: <strong style={{ color: "var(--foreground)" }}>
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

      {/* Fila 3: Rankings + alertas */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border p-4" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <p className="text-[10px] uppercase tracking-widest mb-3"
            style={{ color: "var(--muted-foreground)" }}>Top productos (mes)</p>
          {topProductos.length === 0 ? (
            <p className="text-xs text-center py-4" style={{ color: "var(--muted-foreground)" }}>Sin ventas</p>
          ) : topProductos.map((p, i) => (
            <RankRow
              key={p.title}
              pos={i + 1}
              name={p.title}
              total={p.total}
              maxTotal={maxProducto}
              color={PRODUCT_COLORS[i % PRODUCT_COLORS.length]}
            />
          ))}
        </div>

        <div className="rounded-xl border p-4" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <p className="text-[10px] uppercase tracking-widest mb-3"
            style={{ color: "var(--muted-foreground)" }}>Top vendedores</p>
          {topVendedores.length === 0 ? (
            <p className="text-xs text-center py-4" style={{ color: "var(--muted-foreground)" }}>Sin datos</p>
          ) : topVendedores.map((v, i) => (
            <RankRow
              key={v.vendedor_id}
              pos={i + 1}
              name={v.full_name}
              total={v.total}
              maxTotal={maxVendedor}
              color={VENDOR_COLORS[i % VENDOR_COLORS.length]}
            />
          ))}
        </div>

        <div className="rounded-xl border p-4" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <p className="text-[10px] uppercase tracking-widest mb-3"
            style={{ color: "var(--muted-foreground)" }}>Alertas operacionales</p>
          {alertas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-4 gap-1.5">
              <CheckCircle2 className="h-6 w-6" style={{ color: "#3B6D11" }} />
              <p className="text-xs" style={{ color: "#3B6D11" }}>Todo en orden</p>
            </div>
          ) : alertas.map((a, i) => (
            <AlertPill key={i} {...a} />
          ))}
        </div>
      </div>

      {/* Fila 4: KPIs operacionales */}
      <div className="grid grid-cols-4 gap-3">
        <KpiCard
          label="Insumos bajo mínimo"
          value={kpis ? String(kpis.insumos_stock_bajo) : "—"}
          sub={kpis?.insumos_stock_bajo > 0 ? "Requiere reposición" : "Stock OK"}
          alert={kpis ? kpis.insumos_stock_bajo > 0 : false}
        />
        <KpiCard
          label="OC pendientes"
          value={kpis ? String(kpis.oc_pendientes) : "—"}
          sub={kpis?.oc_pendientes > 0 ? fmt(kpis.oc_monto_pendiente) + " comprometido" : "Al día"}
        />
        <KpiCard
          label="Clientes totales"
          value={kpis ? String(kpis.clientes_total) : "—"}
          sub={kpis ? `${kpis.clientes_nuevos} nuevos este mes` : undefined}
        />
        <KpiCard
          label="Órdenes terminadas"
          value={kpis ? String(kpis.prod_terminadas) : "—"}
          sub="este mes"
        />
      </div>
    </div>
  );
}