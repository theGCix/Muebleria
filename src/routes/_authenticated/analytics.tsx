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
import { Loader2, TrendingUp, MapPin, ShoppingCart, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useMemo } from "react";
import { format, startOfMonth, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { PeriodFilter, usePeriodo } from "@/components/admin/PeriodFilter";
import { rangoParaSql } from "@/lib/periodo";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Analytics — G&M" }] }),
  component: AnalyticsPage,
});

const fmt = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", maximumFractionDigits: 0 }).format(n);
const fmtShort = (n: number) =>
  n >= 1000 ? `S/ ${(n / 1000).toFixed(1)}k` : fmt(n);
const pct = (a: number, b: number) => b > 0 ? Math.round((a / b) * 100) : 0;

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
// Etapas por SESIONES únicas (DISTINCT session_id). El último paso son los pedidos pagados (tabla orders).
function ConversionFunnel({ funnel }: {
  funnel: {
    sesiones?: number; pedidos_pagados?: number;
    vistas: number; productos_vistos: number; carritos: number; checkouts: number; compras: number;
  } | null;
}) {
  if (!funnel) return <p className="text-sm text-muted-foreground text-center py-6">Sin datos de tracking</p>;

  const sesiones = funnel.sesiones ?? funnel.vistas;
  // «Carrito iniciado» nunca se registra en el sitio (no hay evento): se muestra como «sin registrar»
  // en vez de un 0 engañoso mientras haya etapas posteriores con datos.
  const carritoSinRegistrar = funnel.carritos === 0 && funnel.checkouts > 0;
  const steps: Array<{ label: string; value: number; color: string; text: string; sinRegistrar?: boolean }> = [
    { label: "Sesiones únicas",     value: sesiones,                        color: "#E6F1FB", text: "#185FA5" },
    { label: "Productos vistos",    value: funnel.productos_vistos,         color: "#EEEDFE", text: "#534AB7" },
    { label: "Carrito iniciado",    value: funnel.carritos,                 color: "#FAEEDA", text: "#854F0B", sinRegistrar: carritoSinRegistrar },
    { label: "Checkout iniciado",   value: funnel.checkouts,                color: "#F0997B", text: "#993C1D" },
    { label: "Pedidos pagados",     value: funnel.pedidos_pagados ?? funnel.compras, color: "#5DCAA5", text: "#085041" },
  ];
  const maxVal = Math.max(sesiones, 1);

  return (
    <div className="space-y-2">
      {steps.map((step, i) => {
        const prevStep = i > 0 ? steps[i - 1] : null;
        const prev = prevStep && !prevStep.sinRegistrar ? prevStep.value : 0;
        const dropPct = i > 0 && !step.sinRegistrar && prev > 0 ? Math.round((1 - step.value / prev) * 100) : 0;
        const barPct = step.sinRegistrar ? 0 : Math.round((step.value / maxVal) * 100);
        return (
          <div key={step.label}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span style={{ color: "var(--foreground)" }}>{step.label}</span>
              <div className="flex items-center gap-3">
                {dropPct > 0 && (
                  <span className="text-[11px]" style={{ color: "#A32D2D" }}>↓ {dropPct}% drop</span>
                )}
                {step.sinRegistrar ? (
                  <span className="text-[11px] text-muted-foreground">sin registrar</span>
                ) : (
                  <span className="font-semibold tabular-nums" style={{ color: "var(--foreground)" }}>
                    {step.value.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
            <div className="h-7 rounded-md overflow-hidden" style={{ background: "var(--muted)" }}>
              <div
                className="h-full rounded-md flex items-center px-2 transition-all duration-500"
                style={{ width: `${Math.min(barPct, 100)}%`, background: step.color, minWidth: step.value > 0 && !step.sinRegistrar ? "2%" : "0" }}
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
      <div className="pt-2 border-t text-[11px]" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
        Etapas por sesiones únicas del período; «Pedidos pagados» viene de los pedidos web (no de eventos del navegador).
      </div>
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────
function AnalyticsPage() {
  const { valor: periodo, setValor: setPeriodo, rango } =
    usePeriodo({ granularidad: "mes", offset: 0 });
  const { desde, hasta } = rangoParaSql(rango);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["marketing-analytics", desde, hasta],
    queryFn: () => getMarketingAnalytics({ desde, hasta }),
    staleTime: 120_000,
  });

  // Conversión web = pedidos pagados ÷ sesiones únicas × 100.
  //  · pedidos pagados: pedidos web con estado distinto de «pendiente» y «cancelado» (tabla orders).
  //  · sesiones únicas: session_id distintos con cualquier evento en el período (≠ visitas ni páginas vistas;
  //    session_id vive en sessionStorage: una persona que vuelve en otra sesión cuenta de nuevo).
  const sesiones = data?.funnel?.sesiones ?? null;
  const pedidosPagados = data?.funnel?.pedidos_pagados ?? null;
  const conversion = sesiones !== null && pedidosPagados !== null && sesiones > 0
    ? (pedidosPagados / sesiones) * 100
    : null;

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
          <PeriodFilter valor={periodo} onChange={setPeriodo} viendo={false} />
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
          {/* ── Métrica clave: Conversión web (+ complementarias) ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-5 col-span-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Conversión web</p>
              <p className="font-display text-4xl font-semibold">
                {conversion !== null ? `${conversion.toFixed(2)}%` : "—"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {conversion !== null
                  ? `${pedidosPagados} ${pedidosPagados === 1 ? "pedido pagado" : "pedidos pagados"} de ${sesiones!.toLocaleString()} sesiones únicas`
                  : data.funnel ? "Sin sesiones registradas en el período" : "Activa el tracking"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-2">
                Fórmula: pedidos pagados ÷ sesiones únicas × 100
                {conversion !== null && pedidosPagados! > sesiones! && " · hay más pedidos que sesiones registradas (pedidos sin tracking)"}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Sesiones únicas</p>
              <p className="font-display text-2xl font-semibold">{sesiones !== null ? sesiones.toLocaleString() : "—"}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {data.funnel ? `${data.funnel.vistas.toLocaleString()} con página vista` : "Sin datos"}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Clientes que repiten (POS)</p>
              <p className="font-display text-2xl font-semibold">
                {tasaRetencion !== null ? `${tasaRetencion}%` : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {data.retencion
                  ? `${data.retencion.clientes_recurrentes} de ${data.retencion.clientes_periodo} repiten`
                  : "Sin datos"}
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

          {/* ── Fila 3: Geo + Mix por categoría ── */}
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
          </div>

          {/* ── Fila 4: Serie diaria ecommerce ── */}
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