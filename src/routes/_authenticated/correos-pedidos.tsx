// src/routes/_authenticated/correos-pedidos.tsx
// G&M Mueblería — Seguimiento de los correos de confirmación de pago (los envía n8n)
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AlertTriangle, Clock, Mail, MailCheck, MailX, RefreshCw, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { EmptyState, TableSkeleton } from "@/components/states";
import { PeriodFilter, usePeriodo } from "@/components/admin/PeriodFilter";

export const Route = createFileRoute("/_authenticated/correos-pedidos")({
  head: () => ({ meta: [{ title: "Correos de pedidos — G&M" }] }),
  component: CorreosPedidosPage,
});

// ── Tipos y reglas ───────────────────────────────────────────
type Estado = "enviado" | "pendiente" | "atrasado" | "sin_correo";
type Filtro = "todos" | "enviado" | "pendiente" | "sin_correo";

interface Fila {
  id: string;
  order_number: string;
  nombre: string | null;
  email: string | null;
  status: string;
  total: number | null;
  created_at: string;
  correo_confirmacion_enviado_at: string | null;
}

// Misma validación que usa el flujo de n8n (nodo "Armar correos").
const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]{2,}$/;
// n8n revisa cada minuto y espera 2: pasados 10 minutos sin correo, algo falló.
const ATRASO_MIN = 10;

function clasificar(o: Fila, ahora: number): Estado {
  // Sin correo válido, n8n lo marca como atendido sin enviar nada.
  if (!EMAIL_RE.test((o.email ?? "").trim())) return "sin_correo";
  if (o.correo_confirmacion_enviado_at) return "enviado";
  const minutos = (ahora - new Date(o.created_at).getTime()) / 60000;
  return minutos > ATRASO_MIN ? "atrasado" : "pendiente";
}

const ESTADO_CONFIG: Record<Estado, { label: string; color: string; bg: string }> = {
  enviado:    { label: "Enviado",           color: "#065f46", bg: "#d1fae5" },
  pendiente:  { label: "En cola",           color: "#92400e", bg: "#fef3c7" },
  atrasado:   { label: "Atrasado",          color: "#7f1d1d", bg: "#fee2e2" },
  sin_correo: { label: "Sin correo válido", color: "#6b7280", bg: "#f3f4f6" },
};

// ── Formato ──────────────────────────────────────────────────
const fmtSoles = (n: number | null) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n ?? 0);

const fmtFechaHora = (iso: string) =>
  new Intl.DateTimeFormat("es-PE", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));

function demora(creado: string, enviado: string) {
  const m = Math.max(0, Math.round((new Date(enviado).getTime() - new Date(creado).getTime()) / 60000));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ${m % 60} min`;
  return `${Math.floor(h / 24)} d ${h % 24} h`;
}

// ── Consulta ─────────────────────────────────────────────────
async function fetchCorreos(desde: string | null, hasta: string | null): Promise<Fila[]> {
  let query = supabase
    .from("orders")
    .select("id, order_number, nombre, email, status, total, created_at, correo_confirmacion_enviado_at")
    .not("status", "in", "(pendiente,cancelado)") // solo pedidos con pago confirmado
    .order("created_at", { ascending: false })
    .limit(1000);
  if (desde) query = query.gte("created_at", desde);
  if (hasta) query = query.lte("created_at", hasta);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Fila[];
}

// ── Página ───────────────────────────────────────────────────
function CorreosPedidosPage() {
  const { valor, setValor, rango } = usePeriodo({ granularidad: "dia", offset: 0 });
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [q, setQ] = useState("");

  const { data = [], isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["correos-pedidos", rango.granularidad, rango.desdeISO, rango.hastaISO],
    queryFn: () => fetchCorreos(rango.desdeISO, rango.hastaISO),
    refetchInterval: 60_000, // n8n corre cada minuto
  });

  const filas = useMemo(() => {
    const ahora = Date.now();
    return data.map((o) => ({ ...o, estado: clasificar(o, ahora) }));
  }, [data]);

  const conteo = useMemo(() => {
    const c = { total: filas.length, enviado: 0, pendiente: 0, atrasado: 0, sin_correo: 0 };
    for (const f of filas) c[f.estado] += 1;
    return c;
  }, [filas]);

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    return filas.filter((f) => {
      if (filtro === "enviado" && f.estado !== "enviado") return false;
      if (filtro === "pendiente" && f.estado !== "pendiente" && f.estado !== "atrasado") return false;
      if (filtro === "sin_correo" && f.estado !== "sin_correo") return false;
      if (!t) return true;
      return [f.order_number, f.nombre, f.email].some((v) => (v ?? "").toLowerCase().includes(t));
    });
  }, [filas, filtro, q]);

  const pendientes = conteo.pendiente + conteo.atrasado;
  const conCorreo = conteo.total - conteo.sin_correo;
  const tarjetas: { key: Filtro; titulo: string; valor: number; nota: string; icon: typeof Mail; color: string }[] = [
    { key: "todos", titulo: "Pedidos pagados", valor: conteo.total, nota: rango.etiqueta.toLowerCase(), icon: Mail, color: "#1e40af" },
    {
      key: "enviado", titulo: "Correos enviados", valor: conteo.enviado,
      nota: conCorreo > 0 ? `${Math.round((conteo.enviado / conCorreo) * 100)}% de los que tienen correo` : "—",
      icon: MailCheck, color: "#065f46",
    },
    {
      key: "pendiente", titulo: "Por enviar", valor: pendientes,
      nota: conteo.atrasado > 0 ? `${conteo.atrasado} con más de ${ATRASO_MIN} min` : "al día",
      icon: conteo.atrasado > 0 ? AlertTriangle : Clock,
      color: conteo.atrasado > 0 ? "#7f1d1d" : "#92400e",
    },
    { key: "sin_correo", titulo: "Sin correo válido", valor: conteo.sin_correo, nota: "no se les puede escribir", icon: MailX, color: "#6b7280" },
  ];

  return (
    <div className="space-y-5">
      {/* Cabecera */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Correos de pedidos</h1>
          <p className="text-sm text-muted-foreground">
            Seguimiento del correo de confirmación de pago que envía n8n.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} /> Actualizar
        </Button>
      </div>

      {/* Periodo */}
      <Card className="p-3">
        <PeriodFilter valor={valor} onChange={setValor} />
      </Card>

      {/* Resumen (cada tarjeta filtra la tabla) */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tarjetas.map((t) => {
          const Icon = t.icon;
          const activa = filtro === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setFiltro(t.key)}
              className={`rounded-xl border bg-card p-4 text-left transition hover:shadow-sm ${activa ? "border-foreground/40 ring-1 ring-foreground/20" : "border-border/50"}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{t.titulo}</span>
                <Icon className="h-4 w-4" style={{ color: t.color }} />
              </div>
              <p className="mt-1 font-display text-2xl font-semibold">{t.valor}</p>
              <p className="text-[11px] text-muted-foreground">{t.nota}</p>
            </button>
          );
        })}
      </div>

      {/* Búsqueda */}
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Buscar por pedido, nombre o correo"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {/* Tabla */}
      {isLoading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : error ? (
        <EmptyState
          icon={AlertTriangle}
          title="No se pudieron cargar los pedidos"
          description={(error as Error).message}
          action={<Button size="sm" variant="outline" onClick={() => refetch()}>Reintentar</Button>}
        />
      ) : visibles.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="No hay pedidos para este filtro"
          description="Prueba con otro periodo o quita el filtro de estado."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/50 bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Fecha del pedido</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Enviado el</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibles.map((f) => {
                const cfg = ESTADO_CONFIG[f.estado];
                return (
                  <TableRow key={f.id}>
                    <TableCell className="font-mono text-xs">{f.order_number}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{fmtFechaHora(f.created_at)}</TableCell>
                    <TableCell className="text-sm">{f.nombre || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{f.email || "—"}</TableCell>
                    <TableCell>
                      <span
                        className="whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{ color: cfg.color, background: cfg.bg }}
                      >
                        {cfg.label}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {f.estado === "enviado" && f.correo_confirmacion_enviado_at ? (
                        <>
                          {fmtFechaHora(f.correo_confirmacion_enviado_at)}
                          <span className="ml-1 text-muted-foreground">
                            (a los {demora(f.created_at, f.correo_confirmacion_enviado_at)})
                          </span>
                        </>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm">{fmtSoles(f.total)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        «Enviado» indica que n8n envió el correo por Gmail y marcó el pedido; no garantiza que llegó a la bandeja del cliente.
        Se muestran los pedidos con pago confirmado (hasta 1000 por periodo) y la pantalla se actualiza sola cada minuto.
      </p>
    </div>
  );
}