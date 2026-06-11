import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getDashboardKpis, getDashboardSeries } from "@/lib/pos.functions";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell,
} from "recharts";
import {
  Loader2, TrendingUp, TrendingDown, ShoppingCart, Globe,
  Users, Hammer, AlertTriangle, Truck, Package,
  Calendar, ChevronDown, RefreshCw,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useState, useMemo } from "react";
import { format, subDays, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { es } from "date-fns/locale";



export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — G&M" }] }),
  component: DashboardPage,
});

// ── Helpers ──────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", maximumFractionDigits: 0 }).format(n);

const fmtShort = (n: number) =>
  n >= 1000 ? `S/ ${(n / 1000).toFixed(1)}k` : fmt(n);

const PERIOD_OPTIONS = [
  { key: "hoy",         label: "Hoy" },
  { key: "7d",          label: "Últimos 7 días" },
  { key: "mes",         label: "Este mes" },
  { key: "mes_ant",     label: "Mes anterior" },
  { key: "trimestre",   label: "Este trimestre" },
  { key: "anio",        label: "Este año" },
] as const;

type PeriodKey = typeof PERIOD_OPTIONS[number]["key"];

function getRange(key: PeriodKey): { desde: string; hasta: string; agrupacion: "dia" | "semana" | "mes" } {
  const today = new Date();
  const iso = (d: Date) => format(d, "yyyy-MM-dd");
  switch (key) {
    case "hoy":
      return { desde: iso(today), hasta: iso(today), agrupacion: "dia" };
    case "7d":
      return { desde: iso(subDays(today, 6)), hasta: iso(today), agrupacion: "dia" };
    case "mes":
      return { desde: iso(startOfMonth(today)), hasta: iso(today), agrupacion: "dia" };
    case "mes_ant": {
      const ant = subMonths(today, 1);
      return { desde: iso(startOfMonth(ant)), hasta: iso(new Date(ant.getFullYear(), ant.getMonth() + 1, 0)), agrupacion: "dia" };
    }
    case "trimestre":
      return { desde: iso(new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1)), hasta: iso(today), agrupacion: "semana" };
    case "anio":
      return { desde: `${today.getFullYear()}-01-01`, hasta: iso(today), agrupacion: "mes" };
  }
}

// ── KPI Card ─────────────────────────────────────────────────
function KpiCard({
  label, value, sub, icon: Icon, trend, alert, onClick,
}: {
  label: string; value: string; sub?: string;
  icon: any; trend?: number | null;
  alert?: boolean; onClick?: () => void;
}) {
  return (
    <Card
      className={`p-5 cursor-default ${alert ? "border-amber-300 bg-amber-50/60" : ""} ${onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
          <p className="text-2xl font-display font-semibold truncate">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          {trend !== undefined && trend !== null && (
            <div className={`flex items-center gap-0.5 text-xs mt-1 font-medium ${trend >= 0 ? "text-green-600" : "text-red-500"}`}>
              {trend >= 0
                ? <TrendingUp className="h-3 w-3" />
                : <TrendingDown className="h-3 w-3" />}
              {trend >= 0 ? "+" : ""}{trend}% vs período anterior
            </div>
          )}
        </div>
        <div className={`ml-3 p-2.5 rounded-xl flex-shrink-0 ${alert ? "bg-amber-100" : "bg-primary/8"}`}>
          <Icon className={`h-5 w-5 ${alert ? "text-amber-600" : "text-primary/60"}`} />
        </div>
      </div>
    </Card>
  );
}

// ── Tooltip customizado ───────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl shadow-lg p-3 text-sm">
      <p className="font-medium mb-1.5 text-xs text-muted-foreground">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span>{p.name}:</span>
          <span className="font-semibold">{fmtShort(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────
function DashboardPage() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<PeriodKey>("mes");
  const range = useMemo(() => getRange(period), [period]);

  const kpisQuery = useQuery({
    queryKey: ["dashboard-kpis", range.desde, range.hasta],
    queryFn: () => getDashboardKpis({ desde: range.desde, hasta: range.hasta }),
    staleTime: 60_000,
  });

  const seriesQuery = useQuery({
    queryKey: ["dashboard-series", range.desde, range.hasta, range.agrupacion],
    queryFn: () => getDashboardSeries({ desde: range.desde, hasta: range.hasta, agrupacion: range.agrupacion }),
    staleTime: 60_000,
  });

  const kpis = kpisQuery.data;
  const series = seriesQuery.data;
  const loading = kpisQuery.isLoading;
  const hasError = kpisQuery.isError;


  // Colores del design system usando CSS variables directamente
  const COLOR_POS = "hsl(var(--primary))";
  const COLOR_EC  = "hsl(var(--accent))";
  const COLOR_PIE = ["hsl(var(--primary))", "hsl(var(--accent))", "#6d28d9", "#0e7490", "#78350f"];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-semibold">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {kpis
              ? `${format(new Date(kpis.periodo_desde), "d MMM", { locale: es })} — ${format(new Date(kpis.periodo_hasta), "d MMM yyyy", { locale: es })}`
              : "Cargando período..."}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
            <SelectTrigger className="w-44">
              <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map(({ key, label }) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline" size="sm"
            onClick={() => { kpisQuery.refetch(); seriesQuery.refetch(); }}
          >
            <RefreshCw className={`h-4 w-4 ${kpisQuery.isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {loading ? (
        <Loader2 ... />
          ) : hasError ? (
            <div className="text-center py-20 text-destructive">
              <p className="font-medium">Error al cargar el dashboard</p>
              <p className="text-sm text-muted-foreground mt-1">
                {kpisQuery.error?.message}
              </p>
              <Button className="mt-4" onClick={() => kpisQuery.refetch()}>
                Reintentar
              </Button>
            </div>
      ) : kpis ? (
        <>
          {/* ── Alertas operacionales ── */}
          {(kpis.prod_vencidas > 0 || kpis.insumos_stock_bajo > 0 || kpis.oc_pendientes > 0) && (
            <div className="flex gap-3 flex-wrap">
              {kpis.prod_vencidas > 0 && (
                <button
                  onClick={() => navigate({ to: "/produccion" })}
                  className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 hover:bg-red-100 transition-colors"
                >
                  <AlertTriangle className="h-4 w-4" />
                  <strong>{kpis.prod_vencidas}</strong> orden{kpis.prod_vencidas > 1 ? "es" : ""} de producción vencida{kpis.prod_vencidas > 1 ? "s" : ""}
                </button>
              )}
              {kpis.insumos_stock_bajo > 0 && (
                <button
                  onClick={() => navigate({ to: "/insumos" })}
                  className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 hover:bg-amber-100 transition-colors"
                >
                  <Package className="h-4 w-4" />
                  <strong>{kpis.insumos_stock_bajo}</strong> insumo{kpis.insumos_stock_bajo > 1 ? "s" : ""} bajo mínimo
                </button>
              )}
              {kpis.oc_pendientes > 0 && (
                <button
                  onClick={() => navigate({ to: "/proveedores" })}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  <Truck className="h-4 w-4" />
                  <strong>{kpis.oc_pendientes}</strong> OC pendiente{kpis.oc_pendientes > 1 ? "s" : ""} — {fmt(kpis.oc_monto_pendiente)}
                </button>
              )}
            </div>
          )}

          {/* ── KPIs principales ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Ingresos totales"
              value={fmt(kpis.ingresos_totales)}
              sub={`POS ${fmt(kpis.ventas_pos)} + Web ${fmt(kpis.ventas_ecommerce)}`}
              icon={TrendingUp}
              trend={kpis.ingresos_var_pct}
            />
            <KpiCard
              label="Ventas POS"
              value={fmt(kpis.ventas_pos)}
              sub={`${kpis.ventas_pos_count} transacciones · ticket S/ ${kpis.ticket_promedio_pos}`}
              icon={ShoppingCart}
              onClick={() => navigate({ to: "/ventas" })}
            />
            <KpiCard
              label="Pedidos online"
              value={fmt(kpis.ventas_ecommerce)}
              sub={`${kpis.pedidos_ec_count} pedidos pagados`}
              icon={Globe}
              onClick={() => navigate({ to: "/pedidos" })}
            />
            <KpiCard
              label="Clientes nuevos"
              value={String(kpis.clientes_nuevos)}
              sub={`${kpis.clientes_total} clientes en total`}
              icon={Users}
              onClick={() => navigate({ to: "/clientes" })}
            />
          </div>

          {/* ── KPIs operacionales ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="En producción"
              value={String(kpis.prod_en_proceso)}
              sub={`${kpis.prod_pendientes} pendientes`}
              icon={Hammer}
              onClick={() => navigate({ to: "/produccion" })}
            />
            <KpiCard
              label="Terminadas (período)"
              value={String(kpis.prod_terminadas)}
              sub={kpis.tiempo_prod_promedio_dias > 0 ? `Promedio ${kpis.tiempo_prod_promedio_dias} días` : undefined}
              icon={Hammer}
            />
            <KpiCard
              label="Insumos bajo mínimo"
              value={String(kpis.insumos_stock_bajo)}
              icon={Package}
              alert={kpis.insumos_stock_bajo > 0}
              onClick={() => navigate({ to: "/insumos" })}
            />
            <KpiCard
              label="OC pendientes"
              value={String(kpis.oc_pendientes)}
              sub={kpis.oc_pendientes > 0 ? fmt(kpis.oc_monto_pendiente) : "Todo al día"}
              icon={Truck}
              alert={kpis.oc_pendientes > 0}
              onClick={() => navigate({ to: "/proveedores" })}
            />
          </div>

          {/* ── Gráfico de ingresos combinados ── */}
          <Card className="p-6">
            <h3 className="font-semibold mb-5">Ingresos por canal</h3>
            {seriesQuery.isLoading ? (
              <div className="flex justify-center h-64 items-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer>
                  <AreaChart data={series?.ingresos_serie ?? []}>
                    <defs>
                      <linearGradient id="posGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLOR_POS} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={COLOR_POS} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="ecGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLOR_EC} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={COLOR_EC} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="fecha"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickFormatter={(v) => {
                        const d = new Date(v + "T12:00:00");
                        return range.agrupacion === "mes"
                          ? format(d, "MMM", { locale: es })
                          : format(d, "d MMM", { locale: es });
                      }}
                    />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={fmtShort} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Area type="monotone" dataKey="pos" name="POS"
                      stroke={COLOR_POS} fill="url(#posGrad)" strokeWidth={2} dot={false} />
                    <Area type="monotone" dataKey="ec" name="Ecommerce"
                      stroke={COLOR_EC} fill="url(#ecGrad)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {/* ── Fila de gráficos secundarios ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Top productos POS */}
            <Card className="p-5">
              <h3 className="font-semibold mb-4 text-sm">Top productos POS</h3>
              {seriesQuery.isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-4 w-4 animate-spin" /></div>
              ) : (series?.top_productos_pos ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sin ventas en el período</p>
              ) : (
                <div className="space-y-2.5">
                  {series!.top_productos_pos.map((p, i) => (
                    <div key={p.title} className="flex items-center gap-2.5">
                      <span className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate font-medium">{p.title}</p>
                        <p className="text-xs text-muted-foreground">{p.unidades} u. · {fmt(p.total)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Métodos de pago */}
            <Card className="p-5">
              <h3 className="font-semibold mb-4 text-sm">Métodos de pago</h3>
              {seriesQuery.isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-4 w-4 animate-spin" /></div>
              ) : (series?.metodos_pago ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sin datos</p>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="h-36">
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={series!.metodos_pago}
                          dataKey="total"
                          nameKey="metodo"
                          cx="50%" cy="50%"
                          outerRadius={60}
                          innerRadius={30}
                        >
                          {series!.metodos_pago.map((_, i) => (
                            <Cell key={i} fill={COLOR_PIE[i % COLOR_PIE.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => fmt(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-1.5">
                    {series!.metodos_pago.map((m, i) => (
                      <div key={m.metodo} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLOR_PIE[i % COLOR_PIE.length] }} />
                          <span className="capitalize">{m.metodo.replace("_", " ")}</span>
                        </div>
                        <span className="font-medium">{fmt(m.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {/* Top vendedores */}
            <Card className="p-5">
              <h3 className="font-semibold mb-4 text-sm">Top vendedores</h3>
              {seriesQuery.isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-4 w-4 animate-spin" /></div>
              ) : (series?.top_vendedores ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sin datos</p>
              ) : (
                <div className="h-52">
                  <ResponsiveContainer>
                    <BarChart
                      data={series!.top_vendedores}
                      layout="vertical"
                      margin={{ left: 8, right: 16 }}
                    >
                      <XAxis type="number" hide />
                      <YAxis
                        type="category" dataKey="full_name"
                        width={80} fontSize={11}
                        stroke="hsl(var(--muted-foreground))"
                        tickFormatter={(v) => v.split(" ")[0]}
                      />
                      <Tooltip formatter={(v: number) => fmt(v)} />
                      <Bar dataKey="total" fill={COLOR_POS} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </div>

          {/* ── Canal web: top productos ecommerce ── */}
          {(series?.top_productos_ec ?? []).length > 0 && (
            <Card className="p-5">
              <h3 className="font-semibold mb-4 text-sm">Top productos ecommerce</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {series!.top_productos_ec.map((p, i) => (
                  <div key={p.title} className="bg-muted/30 rounded-xl p-3">
                    <p className="text-xs text-muted-foreground mb-0.5">#{i + 1}</p>
                    <p className="font-medium text-sm truncate">{p.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{p.unidades} u.</p>
                    <p className="font-semibold text-sm">{fmt(p.total)}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}