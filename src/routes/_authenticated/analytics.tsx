import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getMarketingAnalytics } from "@/lib/pos.functions";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, LineChart, Line, Cell, FunnelChart, Funnel, LabelList,
} from "recharts";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, TrendingUp, Users, MapPin, ShoppingCart, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useMemo } from "react";
import { format, startOfMonth, subMonths } from "date-fns";
import { es } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Analytics — G&M" }] }),
  component: AnalyticsPage,
});

const fmt = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", maximumFractionDigits: 0 }).format(n);
const fmtShort = (n: number) =>
  n >= 1000 ? `S/ ${(n / 1000).toFixed(1)}k` : fmt(n);
const pct = (a: number, b: number) => b > 0 ? Math.round((a / b) * 100) : 0;

const PERIOD_OPTIONS = [
  { key: "mes",       label: "Este mes",        desde: () => format(startOfMonth(new Date()), "yyyy-MM-dd"),        hasta: () => format(new Date(), "yyyy-MM-dd") },
  { key: "mes_ant",   label: "Mes anterior",    desde: () => format(startOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd"), hasta: () => format(new Date(new Date().getFullYear(), new Date().getMonth(), 0), "yyyy-MM-dd") },
  { key: "trimestre", label: "Este trimestre",  desde: () => format(new Date(new Date().getFullYear(), Math.floor(new Date().getMonth() / 3) * 3, 1), "yyyy-MM-dd"), hasta: () => format(new Date(), "yyyy-MM-dd") },
  { key: "anio",      label: "Este año",        desde: () => `${new Date().getFullYear()}-01-01`, hasta: () => format(new Date(), "yyyy-MM-dd") },
] as const;

const CANAL_COLORS:  Record<string, string> = { POS: "#378ADD", Ecommerce: "#1D9E75" };
const SEGMENTO_COLORS: Record<string, string> = { vip: "#854F0B", recurrente: "#1D9E75", nuevo: "#378ADD", inactivo: "#888780" };
const BAR_COLORS = ["#378ADD", "#185FA5", "#1D9E75", "#7F77DD", "#854F0B", "#E24B4A", "#0C447C", "#0F6E56", "#534AB7", "#993C1D"];

function SectionCard({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <h3 className="font-semibold text-sm flex items-center gap-2 mb-4">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {title}
      </h3>
      {children}
    </Card>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl shadow-lg p-3 text-sm">
      <p className="font-medium text-xs text-muted-foreground mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span>{p.name}:</span>
          <span className="font-semibold">{typeof p.value === "number" && p.value > 100 ? fmtShort(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Funnel de conversión visual ───────────────────────────────
function ConversionFunnel({ funnel }: {
  funnel: { vistas: number; productos_vistos: number; carritos: number; checkouts: number; compras: number } | null;
}) {
  if (!funnel) return <p className="text-sm text-muted-foreground text-center py-6">Sin datos de tracking</p>;

  const steps = [
    { label: "Visitas",             value: funnel.vistas,          color: "#E6F1FB", text: "#185FA5" },
    { label: "Productos vistos",    value: funnel.productos_vistos, color: "#EEEDFE", text: "#534AB7" },
    { label: "Carrito iniciado",    value: funnel.carritos,         color: "#FAEEDA", text: "#854F0B" },
    { label: "Checkout iniciado",   value: funnel.checkouts,        color: "#F0997B", text: "#993C1D" },
    { label: "Compra completada",   value: funnel.compras,          color: "#5DCAA5", text: "#085041" },
  ];
  const maxVal = Math.max(funnel.vistas, 1);

  return (
    <div className="space-y-2">
      {steps.map((step, i) => {
        const prev = i > 0 ? steps[i - 1].value : step.value;
        const dropPct = prev > 0 ? Math.round((1 - step.value / prev) * 100) : 0;
        const barPct = Math.round((step.value / maxVal) * 100);
        return (
          <div key={step.label}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span style={{ color: "var(--foreground)" }}>{step.label}</span>
              <div className="flex items-center gap-3">
                {i > 0 && dropPct > 0 && (
                  <span className="text-[11px]" style={{ color: "#A32D2D" }}>↓ {dropPct}% drop</span>
                )}
                <span className="font-semibold tabular-nums" style={{ color: "var(--foreground)" }}>
                  {step.value.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="h-7 rounded-md overflow-hidden" style={{ background: "var(--muted)" }}>
              <div
                className="h-full rounded-md flex items-center px-2 transition-all duration-500"
                style={{ width: `${barPct}%`, background: step.color, minWidth: step.value > 0 ? "2%" : "0" }}
              >
                {barPct > 12 && (
                  <span className="text-[10px] font-medium" style={{ color: step.text }}>
                    {pct(step.value, maxVal)}%
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
      <div className="pt-2 border-t text-xs" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
        Tasa de conversión total:{" "}
        <strong style={{ color: "var(--foreground)" }}>
          {funnel.vistas > 0 ? `${((funnel.compras / funnel.vistas) * 100).toFixed(2)}%` : "—"}
        </strong>
      </div>
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────
function AnalyticsPage() {
  const [period, setPeriod] = useState<"mes" | "mes_ant" | "trimestre" | "anio">("mes");
  const periodOpt = PERIOD_OPTIONS.find((p) => p.key === period)!;

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["marketing-analytics", period],
    queryFn: () => getMarketingAnalytics({ desde: periodOpt.desde(), hasta: periodOpt.hasta() }),
    staleTime: 120_000,
  });

  const totalIngresos = useMemo(() =>
    (data?.canales ?? []).reduce((s, c) => s + Number(c.ingresos), 0), [data]);

  const tasaRetencion = useMemo(() => {
    if (!data?.retencion) return null;
    const { clientes_recurrentes, clientes_periodo } = data.retencion;
    return clientes_periodo > 0 ? Math.round((clientes_recurrentes / clientes_periodo) * 100) : 0;
  }, [data]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-semibold">Analytics</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Datos de marketing y comportamiento de compra</p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((p) => (
                <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : data ? (
        <>
          {/* ── Fila 1: KPIs de canales ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {(data.canales ?? []).map((c) => (
              <Card key={c.canal} className="p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{c.canal}</p>
                <p className="font-display text-2xl font-semibold">{fmt(Number(c.ingresos))}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {c.transacciones} transacciones · ticket {fmt(Math.round(Number(c.ticket_promedio)))}
                </p>
                <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${totalIngresos > 0 ? pct(Number(c.ingresos), totalIngresos) : 0}%`,
                      background: CANAL_COLORS[c.canal] ?? "#888",
                    }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {totalIngresos > 0 ? pct(Number(c.ingresos), totalIngresos) : 0}% del total
                </p>
              </Card>
            ))}
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Retención</p>
              <p className="font-display text-2xl font-semibold">
                {tasaRetencion !== null ? `${tasaRetencion}%` : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {data.retencion
                  ? `${data.retencion.clientes_recurrentes} de ${data.retencion.clientes_periodo} repiten`
                  : "Sin datos"}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Conversión web</p>
              <p className="font-display text-2xl font-semibold">
                {data.funnel && data.funnel.vistas > 0
                  ? `${((data.funnel.compras / data.funnel.vistas) * 100).toFixed(2)}%`
                  : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {data.funnel ? `${data.funnel.vistas.toLocaleString()} visitas registradas` : "Activa el tracking"}
              </p>
            </Card>
          </div>

          {/* ── Fila 2: Fuentes UTM + Funnel ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SectionCard title="Origen de tráfico web" icon={TrendingUp}>
              {!data.utm_fuentes?.length ? (
                <div className="py-6 text-center text-sm text-muted-foreground space-y-2">
                  <p>Sin datos UTM aún.</p>
                  <p className="text-xs">Añade <code className="bg-muted px-1 rounded">?utm_source=google</code> a tus URLs de campaña para ver el origen aquí.</p>
                </div>
              ) : (
                <div className="h-52">
                  <ResponsiveContainer>
                    <BarChart data={data.utm_fuentes} layout="vertical" margin={{ left: 0, right: 16 }}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="fuente" width={70} fontSize={11}
                        stroke="hsl(var(--muted-foreground))" />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="ingresos" name="Ingresos" radius={[0, 4, 4, 0]}>
                        {data.utm_fuentes.map((_, i) => (
                          <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </SectionCard>

            <SectionCard title="Funnel de conversión web" icon={ShoppingCart}>
              <ConversionFunnel funnel={data.funnel ?? null} />
            </SectionCard>
          </div>

          {/* ── Fila 3: Geo + Segmentos ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SectionCard title="Pedidos por distrito (Lima)" icon={MapPin}>
              {!data.geo_distritos?.length ? (
                <p className="text-sm text-muted-foreground text-center py-6">Sin pedidos con distrito registrado</p>
              ) : (
                <div className="h-60">
                  <ResponsiveContainer>
                    <BarChart data={data.geo_distritos} layout="vertical" margin={{ left: 0, right: 16 }}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="distrito" width={110} fontSize={11}
                        stroke="hsl(var(--muted-foreground))" />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="pedidos" name="Pedidos" radius={[0, 4, 4, 0]}>
                        {data.geo_distritos.map((_, i) => (
                          <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </SectionCard>

            <SectionCard title="Segmentación de clientes" icon={Users}>
              {!data.segmentos?.length ? (
                <p className="text-sm text-muted-foreground text-center py-6">Sin clientes segmentados</p>
              ) : (
                <div className="space-y-3">
                  {data.segmentos.map((s) => {
                    const totalClientes = data.segmentos!.reduce((acc, x) => acc + x.clientes, 0);
                    const barPct = totalClientes > 0 ? pct(s.clientes, totalClientes) : 0;
                    const color = SEGMENTO_COLORS[s.segmento] ?? "#888";
                    return (
                      <div key={s.segmento}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="capitalize font-medium" style={{ color: "var(--foreground)" }}>{s.segmento}</span>
                          <span style={{ color: "var(--muted-foreground)" }}>{s.clientes} clientes · {barPct}%</span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
                          <div className="h-full rounded-full" style={{ width: `${barPct}%`, background: color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          </div>

          {/* ── Fila 4: Mix categorías + Top productos ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SectionCard title="Mix por categoría" icon={ShoppingCart}>
              {!data.categorias?.length ? (
                <p className="text-sm text-muted-foreground text-center py-6">Sin categorías</p>
              ) : (
                <div className="h-52">
                  <ResponsiveContainer>
                    <BarChart data={data.categorias} margin={{ left: 0, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="categoria" fontSize={11} stroke="hsl(var(--muted-foreground))"
                        tickFormatter={(v) => v.length > 12 ? v.slice(0, 12) + "…" : v} />
                      <YAxis hide />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="ingresos" name="Ingresos" radius={[4, 4, 0, 0]}>
                        {data.categorias.map((_, i) => (
                          <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </SectionCard>

            <SectionCard title="Top 10 productos (POS + web)" icon={TrendingUp}>
              {!data.top_productos?.length ? (
                <p className="text-sm text-muted-foreground text-center py-6">Sin ventas</p>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {data.top_productos.map((p, i) => {
                    const maxVal = Number(data.top_productos![0].ingresos);
                    return (
                      <div key={p.title} className="flex items-center gap-2.5">
                        <span className="text-[11px] w-4 text-right text-muted-foreground flex-shrink-0">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between text-xs mb-0.5">
                            <span className="truncate font-medium" style={{ color: "var(--foreground)" }}>{p.title}</span>
                            <span className="flex-shrink-0 ml-2" style={{ color: "var(--muted-foreground)" }}>{p.unidades} u.</span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
                            <div className="h-full rounded-full"
                              style={{ width: `${pct(Number(p.ingresos), maxVal)}%`, background: BAR_COLORS[i % BAR_COLORS.length] }} />
                          </div>
                        </div>
                        <span className="text-xs font-medium flex-shrink-0 min-w-[52px] text-right"
                          style={{ color: "var(--foreground)" }}>
                          {fmtShort(Number(p.ingresos))}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          </div>

          {/* ── Fila 5: Serie diaria ecommerce ── */}
          {(data.serie_ec ?? []).length > 0 && (
            <Card className="p-5">
              <h3 className="font-semibold text-sm mb-4">Evolución de pedidos online</h3>
              <div className="h-48">
                <ResponsiveContainer>
                  <LineChart data={data.serie_ec!}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="fecha" fontSize={11} stroke="hsl(var(--muted-foreground))"
                      tickFormatter={(v) => format(new Date(v + "T12:00:00"), "d MMM", { locale: es })} />
                    <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" tickFormatter={fmtShort} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="ingresos" name="Ingresos" stroke="#1D9E75"
                      strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}