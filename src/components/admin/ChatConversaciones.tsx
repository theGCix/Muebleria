import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LIMITE_RESUMEN,
  listarMensajesSesion,
  listarSesiones,
  listarSinResolver,
  percentil,
  resumenTurnos,
  type ChatMensaje,
} from "@/lib/chatAdmin";

const RANGOS = [
  { valor: "7", etiqueta: "Últimos 7 días" },
  { valor: "30", etiqueta: "Últimos 30 días" },
  { valor: "90", etiqueta: "Últimos 90 días" },
];

const fecha = (iso: string) =>
  new Date(iso).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });

const segundos = (ms: number | null) => (ms == null ? "—" : `${(ms / 1000).toFixed(1)} s`);

function Kpi({ titulo, valor, detalle }: { titulo: string; valor: string; detalle?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{titulo}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{valor}</CardTitle>
      </CardHeader>
      {detalle && <CardContent className="text-xs text-muted-foreground">{detalle}</CardContent>}
    </Card>
  );
}

function BadgesHerramientas({ herramientas }: { herramientas: ChatMensaje["herramientas"] }) {
  if (!herramientas?.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {herramientas.map((h, i) => (
        <Badge
          key={i}
          variant={h.resultado === "error" ? "destructive" : h.resultado === "vacio" ? "secondary" : "outline"}
          className="font-normal"
        >
          {h.nombre}: {h.resultado === "vacio" ? "sin resultados" : h.resultado}
        </Badge>
      ))}
    </div>
  );
}

function Hilo({ sesionId }: { sesionId: string }) {
  const q = useQuery({
    queryKey: ["chat-admin", "hilo", sesionId],
    queryFn: () => listarMensajesSesion(sesionId),
  });
  if (q.isLoading) return <Skeleton className="mt-4 h-40 w-full" />;
  if (q.isError) return <p className="mt-4 text-sm text-destructive">No se pudo cargar la conversación.</p>;

  return (
    <div className="mt-4 space-y-4">
      {q.data?.map((m) =>
        m.rol === "user" ? (
          <div
            key={m.id}
            className="ml-8 whitespace-pre-wrap rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
          >
            {m.contenido}
          </div>
        ) : (
          <div key={m.id} className="mr-8 space-y-2">
            <div className="whitespace-pre-wrap rounded-lg bg-muted px-3 py-2 text-sm">
              {m.contenido || "(sin respuesta)"}
            </div>
            <BadgesHerramientas herramientas={m.herramientas} />
            <p className="text-xs text-muted-foreground">
              {[fecha(m.created_at), m.latencia_ms != null && segundos(m.latencia_ms), m.modelo, m.agrego_carrito && "agregó al carrito"]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {m.error && <p className="text-xs text-destructive">{m.error}</p>}
          </div>
        ),
      )}
    </div>
  );
}

const ErrorCarga = () => (
  <p className="text-sm text-destructive">
    No se pudieron cargar los datos. Verifica que la migración esté aplicada y que tu usuario tenga rol admin.
  </p>
);

export function ChatConversaciones() {
  const [dias, setDias] = useState(30);
  const [soloSinResolver, setSoloSinResolver] = useState(false);
  const [abierta, setAbierta] = useState<string | null>(null);

  const turnos = useQuery({ queryKey: ["chat-admin", "turnos", dias], queryFn: () => resumenTurnos(dias) });
  const pendientes = useQuery({ queryKey: ["chat-admin", "pendientes", dias], queryFn: () => listarSinResolver(dias) });
  const sesiones = useQuery({
    queryKey: ["chat-admin", "sesiones", dias, soloSinResolver],
    queryFn: () => listarSesiones(dias, soloSinResolver),
  });

  const t = turnos.data ?? [];
  const n = t.length;
  const pct = (x: number) => (n ? `${Math.round((x / n) * 100)}%` : "—");
  const sinResolver = t.filter((x) => x.sin_resolver).length;
  const conCarrito = t.filter((x) => x.agrego_carrito).length;
  const conError = t.filter((x) => x.error).length;
  const latencias = t.map((x) => x.latencia_ms).filter((x): x is number => x != null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Qué preguntan los clientes al asistente y qué consultas no logra resolver.
        </p>
        <Select value={String(dias)} onValueChange={(v) => setDias(Number(v))}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGOS.map((r) => (
              <SelectItem key={r.valor} value={r.valor}>
                {r.etiqueta}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {turnos.isError ? (
        <ErrorCarga />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi
            titulo="Respuestas del bot"
            valor={turnos.isLoading ? "…" : String(n)}
            detalle={n >= LIMITE_RESUMEN ? `Se analizan las últimas ${LIMITE_RESUMEN}` : undefined}
          />
          <Kpi
            titulo="Sin resolver"
            valor={turnos.isLoading ? "…" : pct(sinResolver)}
            detalle={n ? `${sinResolver} respuestas, ${conError} con error` : undefined}
          />
          <Kpi
            titulo="Agregaron al carrito"
            valor={turnos.isLoading ? "…" : pct(conCarrito)}
            detalle={n ? `${conCarrito} respuestas` : undefined}
          />
          <Kpi
            titulo="Latencia p50 / p95"
            valor={turnos.isLoading ? "…" : `${segundos(percentil(latencias, 0.5))} / ${segundos(percentil(latencias, 0.95))}`}
          />
        </div>
      )}

      <Tabs defaultValue="pendientes">
        <TabsList>
          <TabsTrigger value="pendientes">Sin resolver</TabsTrigger>
          <TabsTrigger value="sesiones">Conversaciones</TabsTrigger>
        </TabsList>

        <TabsContent value="pendientes" className="mt-4 space-y-3">
          {pendientes.isLoading && <Skeleton className="h-24 w-full" />}
          {pendientes.isError && <ErrorCarga />}
          {pendientes.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">No hay preguntas sin resolver en este período.</p>
          )}
          {pendientes.data?.map(({ respuesta, pregunta }) => (
            <button
              key={respuesta.id}
              onClick={() => setAbierta(respuesta.sesion_id)}
              className="w-full rounded-lg border p-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium">{pregunta}</p>
                <span className="shrink-0 text-xs text-muted-foreground">{fecha(respuesta.created_at)}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {respuesta.contenido || "Sin respuesta"}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <BadgesHerramientas herramientas={respuesta.herramientas} />
                {respuesta.error && (
                  <Badge variant="destructive" className="font-normal">
                    {respuesta.error}
                  </Badge>
                )}
              </div>
            </button>
          ))}
        </TabsContent>

        <TabsContent value="sesiones" className="mt-4 space-y-3">
          <Button
            variant={soloSinResolver ? "default" : "outline"}
            size="sm"
            aria-pressed={soloSinResolver}
            onClick={() => setSoloSinResolver((v) => !v)}
          >
            Solo con consultas sin resolver
          </Button>
          {sesiones.isLoading && <Skeleton className="h-24 w-full" />}
          {sesiones.isError && <ErrorCarga />}
          {sesiones.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">Aún no hay conversaciones en este período.</p>
          )}
          {sesiones.data?.map((s) => (
            <button
              key={s.id}
              onClick={() => setAbierta(s.id)}
              className="flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div>
                <p className="text-sm font-medium">{fecha(s.ultimo_mensaje_at)}</p>
                <p className="text-xs text-muted-foreground">
                  {s.total_mensajes} mensajes · iniciada {fecha(s.created_at)}
                </p>
              </div>
              {s.sin_resolver ? <Badge variant="destructive">Sin resolver</Badge> : <Badge variant="outline">Resuelta</Badge>}
            </button>
          ))}
        </TabsContent>
      </Tabs>

      <Sheet open={abierta !== null} onOpenChange={(abrir) => !abrir && setAbierta(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Conversación</SheetTitle>
            <SheetDescription>Lo que escribió el cliente y lo que respondió el asistente.</SheetDescription>
          </SheetHeader>
          {abierta && <Hilo sesionId={abierta} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}