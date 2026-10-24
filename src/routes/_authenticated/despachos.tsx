// src/routes/_authenticated/despachos.tsx
// G&M Mueblería — Despachos y entregas
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Navigation, Plus, Pencil, MessageCircle, Play, CheckCircle2, XCircle, CalendarClock,
  Ban, ClipboardCopy, PackageCheck, AlertTriangle, Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, TableSkeleton } from "@/components/states";
import { fmtPEN } from "@/lib/pricing";
import {
  listDespachos, listPedidosSinDespacho, crearDespacho, editarDespacho,
  cambiarEstadoDespacho, hoyISO, whatsappLink, FRANJA_LABEL,
  type Despacho, type DespachoEstado, type Franja,
} from "@/lib/despachos.functions";

export const Route = createFileRoute("/_authenticated/despachos")({
  head: () => ({ meta: [{ title: "Despachos — G&M" }] }),
  component: DespachosPage,
});

// ── Presentación ─────────────────────────────────────────────
const ESTADO: Record<DespachoEstado, { label: string; cls: string }> = {
  programado: { label: "Programado", cls: "bg-sky-100 text-sky-800 border-sky-200" },
  en_ruta:    { label: "En ruta",    cls: "bg-amber-100 text-amber-800 border-amber-200" },
  entregado:  { label: "Entregado",  cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  fallido:    { label: "Fallido",    cls: "bg-red-100 text-red-800 border-red-200" },
  cancelado:  { label: "Cancelado",  cls: "bg-muted text-muted-foreground border-border" },
};

const fmtFecha = (iso: string) =>
  new Intl.DateTimeFormat("es-PE", { weekday: "short", day: "2-digit", month: "short" })
    .format(new Date(iso + "T00:00:00"));

type Filtro = "activos" | DespachoEstado | "todos";

// ── Página ───────────────────────────────────────────────────
function DespachosPage() {
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState<Filtro>("activos");
  const [fecha, setFecha] = useState<string>("");
  const [q, setQ] = useState("");
  const [form, setForm] = useState<{ open: boolean; edit?: Despacho; orderId?: string }>({ open: false });
  const [accion, setAccion] = useState<{ d: Despacho; tipo: "entregado" | "fallido" | "reprogramar" | "cancelado" } | null>(null);

  const { data: despachos = [], isLoading } = useQuery({
    queryKey: ["despachos"],
    queryFn: listDespachos,
  });
  const { data: sinDespacho = [] } = useQuery({
    queryKey: ["despachos-pendientes"],
    queryFn: listPedidosSinDespacho,
  });

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ["despachos"] });
    qc.invalidateQueries({ queryKey: ["despachos-pendientes"] });
    qc.invalidateQueries({ queryKey: ["orders"] });
  };

  const salirARuta = useMutation({
    mutationFn: (id: string) => cambiarEstadoDespacho({ id, nuevo_estado: "en_ruta" }),
    onSuccess: (aviso) => {
      refrescar();
      aviso ? toast.warning(aviso) : toast.success("Despacho en ruta");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const hoy = hoyISO();
  const kpis = useMemo(() => ({
    hoy: despachos.filter((d) => d.fecha_programada === hoy && ["programado", "en_ruta"].includes(d.estado)).length,
    programados: despachos.filter((d) => d.estado === "programado").length,
    enRuta: despachos.filter((d) => d.estado === "en_ruta").length,
    atencion: despachos.filter(
      (d) => d.estado === "fallido" || (d.estado === "programado" && d.fecha_programada < hoy),
    ).length,
  }), [despachos, hoy]);

  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase();
    return despachos.filter((d) => {
      const okEstado =
        filtro === "todos" ? true
        : filtro === "activos" ? ["programado", "en_ruta", "fallido"].includes(d.estado)
        : d.estado === filtro;
      const okFecha = !fecha || d.fecha_programada === fecha;
      const o = d.orders;
      const okQ = !term || [o?.order_number, o?.nombre, o?.distrito, o?.direccion, d.conductor]
        .some((x) => x?.toLowerCase().includes(term));
      return okEstado && okFecha && okQ;
    });
  }, [despachos, filtro, fecha, q]);

  const copiarHojaDeRuta = async () => {
    const dia = fecha || hoy;
    const lista = despachos
      .filter((d) => d.fecha_programada === dia && ["programado", "en_ruta"].includes(d.estado))
      .sort((a, b) => a.franja.localeCompare(b.franja) || (a.orders?.distrito ?? "").localeCompare(b.orders?.distrito ?? ""));
    if (lista.length === 0) return toast.info("No hay entregas activas para ese día.");
    const texto = [
      `HOJA DE RUTA — ${fmtFecha(dia)}`,
      ...lista.map((d, i) => {
        const o = d.orders;
        return [
          `${i + 1}. ${o?.order_number} · ${o?.nombre} · ${o?.telefono ?? "sin teléfono"}`,
          `   ${o?.direccion ?? "sin dirección"}${o?.distrito ? `, ${o.distrito}` : ""}`,
          `   ${FRANJA_LABEL[d.franja]}${d.conductor ? ` · ${d.conductor}` : ""}${d.referencia ? ` · Ref: ${d.referencia}` : ""}`,
        ].join("\n");
      }),
    ].join("\n\n");
    try {
      await navigator.clipboard.writeText(texto);
      toast.success(`Hoja de ruta copiada (${lista.length} entregas)`);
    } catch {
      toast.error("No se pudo copiar al portapapeles");
    }
  };

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <Navigation className="h-5 w-5" /> Despachos
          </h1>
          <p className="text-sm text-muted-foreground">Programa, controla y cierra las entregas de los pedidos.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={copiarHojaDeRuta}>
            <ClipboardCopy className="mr-1.5 h-4 w-4" /> Hoja de ruta
          </Button>
          <Button size="sm" onClick={() => setForm({ open: true })}>
            <Plus className="mr-1.5 h-4 w-4" /> Programar despacho
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Para hoy" value={kpis.hoy} />
        <Kpi label="Programados" value={kpis.programados} />
        <Kpi label="En ruta" value={kpis.enRuta} />
        <Kpi label="Requieren atención" value={kpis.atencion} alert={kpis.atencion > 0}
             hint="Fallidos o vencidos" />
      </div>

      {/* Pedidos listos para programar */}
      {sinDespacho.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/60 p-3">
          <div className="flex items-start gap-3">
            <PackageCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-amber-900">
                {sinDespacho.length} pedido{sinDespacho.length !== 1 && "s"} pagado{sinDespacho.length !== 1 && "s"} sin entrega programada
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {sinDespacho.slice(0, 8).map((p) => (
                  <Button key={p.id} variant="outline" size="sm" className="h-7 bg-white text-xs"
                          onClick={() => setForm({ open: true, orderId: p.id })}>
                    {p.order_number} · {p.distrito ?? "—"}
                  </Button>
                ))}
                {sinDespacho.length > 8 && (
                  <span className="self-center text-xs text-amber-800">y {sinDespacho.length - 8} más…</span>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="activos">Activos</SelectItem>
            <SelectItem value="programado">Programados</SelectItem>
            <SelectItem value="en_ruta">En ruta</SelectItem>
            <SelectItem value="fallido">Fallidos</SelectItem>
            <SelectItem value="entregado">Entregados</SelectItem>
            <SelectItem value="cancelado">Cancelados</SelectItem>
            <SelectItem value="todos">Todos</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-[160px]" />
        {fecha && <Button variant="ghost" size="sm" onClick={() => setFecha("")}>Quitar fecha</Button>}
        <Input placeholder="Buscar pedido, cliente, distrito, conductor…" value={q}
               onChange={(e) => setQ(e.target.value)} className="min-w-[220px] flex-1 md:max-w-sm" />
      </div>

      {/* Tabla */}
      {isLoading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Pedido / cliente</th>
                  <th className="px-4 py-3 font-medium">Dirección</th>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Conductor</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filtrados.map((d) => {
                  const o = d.orders;
                  const vencido = d.estado === "programado" && d.fecha_programada < hoy;
                  const wa = whatsappLink(
                    o?.telefono,
                    `Hola ${o?.nombre?.split(" ")[0] ?? ""}, te escribimos de G&M Mueblería. Tu pedido ${o?.order_number} está programado para el ${fmtFecha(d.fecha_programada)} (${FRANJA_LABEL[d.franja].toLowerCase()}). ¿Nos confirmas que habrá alguien para recibirlo?`,
                  );
                  const busy = salirARuta.isPending && salirARuta.variables === d.id;
                  return (
                    <tr key={d.id} className="align-top">
                      <td className="px-4 py-3">
                        <div className="font-medium">{o?.order_number}</div>
                        <div className="text-xs text-muted-foreground">{o?.nombre}</div>
                        {o?.telefono && <div className="text-xs text-muted-foreground">{o.telefono}</div>}
                      </td>
                      <td className="max-w-[240px] px-4 py-3">
                        <div className="truncate">{o?.direccion ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{o?.distrito ?? ""}</div>
                        {d.referencia && <div className="truncate text-xs italic text-muted-foreground">Ref: {d.referencia}</div>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className={vencido ? "font-medium text-red-700" : ""}>{fmtFecha(d.fecha_programada)}</div>
                        <div className="text-xs text-muted-foreground">{FRANJA_LABEL[d.franja]}</div>
                        {vencido && <div className="text-xs text-red-700">Vencido</div>}
                      </td>
                      <td className="px-4 py-3">
                        <div>{d.conductor ?? <span className="text-muted-foreground">Sin asignar</span>}</div>
                        {d.vehiculo && <div className="text-xs text-muted-foreground">{d.vehiculo}</div>}
                        {d.costo_flete > 0 && <div className="text-xs text-muted-foreground">Flete {fmtPEN(d.costo_flete)}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={ESTADO[d.estado].cls}>{ESTADO[d.estado].label}</Badge>
                        {d.intentos > 1 && <div className="mt-1 text-xs text-muted-foreground">{d.intentos} intentos</div>}
                        {d.estado === "fallido" && d.motivo_fallo && (
                          <div className="mt-1 max-w-[180px] text-xs text-red-700">{d.motivo_fallo}</div>
                        )}
                        {d.estado === "entregado" && d.recibido_por && (
                          <div className="mt-1 text-xs text-muted-foreground">Recibió: {d.recibido_por}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-1">
                          {d.estado === "programado" && (
                            <Button size="sm" className="h-8" disabled={busy} onClick={() => salirARuta.mutate(d.id)}>
                              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1 h-3.5 w-3.5" />}
                              Salir a ruta
                            </Button>
                          )}
                          {d.estado === "en_ruta" && (
                            <>
                              <Button size="sm" className="h-8" onClick={() => setAccion({ d, tipo: "entregado" })}>
                                <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Entregado
                              </Button>
                              <Button size="sm" variant="outline" className="h-8" onClick={() => setAccion({ d, tipo: "fallido" })}>
                                <XCircle className="mr-1 h-3.5 w-3.5" /> No se pudo
                              </Button>
                            </>
                          )}
                          {d.estado === "fallido" && (
                            <Button size="sm" className="h-8" onClick={() => setAccion({ d, tipo: "reprogramar" })}>
                              <CalendarClock className="mr-1 h-3.5 w-3.5" /> Reprogramar
                            </Button>
                          )}
                          {["programado", "fallido"].includes(d.estado) && (
                            <Button size="icon" variant="ghost" className="h-8 w-8" title="Cancelar despacho"
                                    onClick={() => setAccion({ d, tipo: "cancelado" })}>
                              <Ban className="h-4 w-4" />
                            </Button>
                          )}
                          {["programado", "en_ruta", "fallido"].includes(d.estado) && (
                            <Button size="icon" variant="ghost" className="h-8 w-8" title="Editar"
                                    onClick={() => setForm({ open: true, edit: d })}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {wa && ["programado", "en_ruta", "fallido"].includes(d.estado) && (
                            <Button asChild size="icon" variant="ghost" className="h-8 w-8" title="Avisar por WhatsApp">
                              <a href={wa} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" /></a>
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtrados.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      {despachos.length === 0 ? (
                        <EmptyState
                          icon={Navigation}
                          title="Aún no hay despachos"
                          description="Programa la entrega de un pedido pagado para ordenar las salidas del día."
                          action={<Button size="sm" onClick={() => setForm({ open: true })}>Programar despacho</Button>}
                        />
                      ) : (
                        <EmptyState
                          icon={Navigation}
                          title="Ningún despacho coincide con el filtro"
                          description="Prueba con otro estado, quita la fecha o cambia la búsqueda."
                          action={
                            <Button size="sm" variant="outline"
                                    onClick={() => { setFiltro("todos"); setFecha(""); setQ(""); }}>
                              Limpiar filtros
                            </Button>
                          }
                        />
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {form.open && (
        <DespachoDialog
          edit={form.edit}
          orderId={form.orderId}
          pedidos={sinDespacho}
          onClose={() => setForm({ open: false })}
          onSaved={() => { setForm({ open: false }); refrescar(); }}
        />
      )}
      {accion && (
        <AccionDialog
          d={accion.d}
          tipo={accion.tipo}
          onClose={() => setAccion(null)}
          onDone={(aviso) => {
            setAccion(null);
            refrescar();
            aviso ? toast.warning(aviso) : toast.success("Despacho actualizado");
          }}
        />
      )}
    </div>
  );
}

function Kpi({ label, value, alert, hint }: { label: string; value: number; alert?: boolean; hint?: string }) {
  return (
    <Card className={`p-4 ${alert ? "border-red-200 bg-red-50/60" : ""}`}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {alert && <AlertTriangle className="h-3.5 w-3.5 text-red-600" />} {label}
      </div>
      <div className={`mt-1 text-2xl font-semibold ${alert ? "text-red-700" : ""}`}>{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </Card>
  );
}

// ── Crear / editar ───────────────────────────────────────────
function DespachoDialog({
  edit, orderId, pedidos, onClose, onSaved,
}: {
  edit?: Despacho;
  orderId?: string;
  pedidos: Awaited<ReturnType<typeof listPedidosSinDespacho>>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [order, setOrder] = useState(orderId ?? "");
  const [fecha, setFecha] = useState(edit?.fecha_programada ?? hoyISO());
  const [franja, setFranja] = useState<Franja>(edit?.franja ?? "manana");
  const [conductor, setConductor] = useState(edit?.conductor ?? "");
  const [vehiculo, setVehiculo] = useState(edit?.vehiculo ?? "");
  const [referencia, setReferencia] = useState(edit?.referencia ?? "");
  const [flete, setFlete] = useState(String(edit?.costo_flete ?? 0));
  const [notas, setNotas] = useState(edit?.notas ?? "");

  const pedido = pedidos.find((p) => p.id === order);

  const guardar = useMutation({
    mutationFn: async () => {
      const costo_flete = Number(flete) || 0;
      if (edit) {
        await editarDespacho({ id: edit.id, fecha_programada: fecha, franja, conductor, vehiculo, referencia, costo_flete, notas });
      } else {
        if (!order) throw new Error("Elige el pedido a despachar");
        await crearDespacho({ order_id: order, fecha_programada: fecha, franja, conductor, vehiculo, referencia, costo_flete, notas });
      }
    },
    onSuccess: () => { toast.success(edit ? "Despacho actualizado" : "Despacho programado"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{edit ? `Editar despacho ${edit.orders?.order_number ?? ""}` : "Programar despacho"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {!edit && (
            <div className="space-y-1.5">
              <Label>Pedido</Label>
              <Select value={order} onValueChange={setOrder}>
                <SelectTrigger><SelectValue placeholder="Elige un pedido pagado" /></SelectTrigger>
                <SelectContent>
                  {pedidos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.order_number} · {p.nombre} · {p.distrito ?? "sin distrito"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {pedidos.length === 0 && (
                <p className="text-xs text-muted-foreground">No hay pedidos pagados sin entrega programada.</p>
              )}
              {pedido && (
                <p className="text-xs text-muted-foreground">
                  {pedido.direccion ?? "Sin dirección"} · {fmtPEN(pedido.total)} · pedido en «{pedido.status.replace("_", " ")}»
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Fecha</Label>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Franja</Label>
              <Select value={franja} onValueChange={(v) => setFranja(v as Franja)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manana">Mañana</SelectItem>
                  <SelectItem value="tarde">Tarde</SelectItem>
                  <SelectItem value="todo_el_dia">Todo el día</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Conductor</Label>
              <Input value={conductor} onChange={(e) => setConductor(e.target.value)} placeholder="Nombre" />
            </div>
            <div className="space-y-1.5">
              <Label>Vehículo</Label>
              <Input value={vehiculo} onChange={(e) => setVehiculo(e.target.value)} placeholder="Placa o tipo" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Referencia de la dirección</Label>
            <Input value={referencia} onChange={(e) => setReferencia(e.target.value)}
                   placeholder="Ej. Frente al parque, portón negro, 3er piso sin ascensor" />
          </div>
          <div className="space-y-1.5">
            <Label>Costo del flete (S/)</Label>
            <Input type="number" min={0} step="0.01" value={flete} onChange={(e) => setFlete(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Notas internas</Label>
            <Textarea rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={() => guardar.mutate()} disabled={guardar.isPending}>
              {guardar.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {edit ? "Guardar cambios" : "Programar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Entregado / fallido / reprogramar / cancelar ─────────────
function AccionDialog({
  d, tipo, onClose, onDone,
}: {
  d: Despacho;
  tipo: "entregado" | "fallido" | "reprogramar" | "cancelado";
  onClose: () => void;
  onDone: (aviso: string | null) => void;
}) {
  const [texto, setTexto] = useState("");
  const [nuevaFecha, setNuevaFecha] = useState(hoyISO());

  const titulo = {
    entregado: "Confirmar entrega",
    fallido: "Entrega no realizada",
    reprogramar: "Reprogramar entrega",
    cancelado: "Cancelar despacho",
  }[tipo];

  const ejecutar = useMutation({
    mutationFn: () =>
      cambiarEstadoDespacho({
        id: d.id,
        nuevo_estado: tipo === "reprogramar" ? "programado" : tipo,
        motivo: tipo === "fallido" ? texto : undefined,
        recibido_por: tipo === "entregado" ? texto : undefined,
        nueva_fecha: tipo === "reprogramar" ? nuevaFecha : undefined,
      }),
    onSuccess: onDone,
    onError: (e: Error) => toast.error(e.message),
  });

  const invalido = (tipo === "fallido" && !texto.trim()) || (tipo === "reprogramar" && !nuevaFecha);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{titulo} · {d.orders?.order_number}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {d.orders?.nombre} — {d.orders?.direccion ?? "sin dirección"}{d.orders?.distrito ? `, ${d.orders.distrito}` : ""}
          </p>

          {tipo === "entregado" && (
            <div className="space-y-1.5">
              <Label>¿Quién recibió? (opcional)</Label>
              <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Nombre de quien recibió" />
              <p className="text-xs text-muted-foreground">
                Si el pedido está en «listo despacho» o «enviado», también pasará a «entregado».
              </p>
            </div>
          )}
          {tipo === "fallido" && (
            <div className="space-y-1.5">
              <Label>Motivo</Label>
              <Textarea rows={3} value={texto} onChange={(e) => setTexto(e.target.value)}
                        placeholder="Ej. Cliente ausente, dirección incorrecta, no pasa por la puerta…" />
            </div>
          )}
          {tipo === "reprogramar" && (
            <div className="space-y-1.5">
              <Label>Nueva fecha</Label>
              <Input type="date" value={nuevaFecha} onChange={(e) => setNuevaFecha(e.target.value)} />
            </div>
          )}
          {tipo === "cancelado" && (
            <p className="text-sm">
              El pedido no se cancela, solo esta entrega. Podrás programar otra después.
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Volver</Button>
            <Button onClick={() => ejecutar.mutate()} disabled={invalido || ejecutar.isPending}
                    variant={tipo === "cancelado" ? "destructive" : "default"}>
              {ejecutar.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Confirmar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
