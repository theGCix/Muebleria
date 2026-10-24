// src/routes/_authenticated/devoluciones.tsx
// G&M Mueblería — Devoluciones y notas de crédito
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Undo2, Plus, Search, Loader2, Ban, FileText, FileCheck2, Info, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, TableSkeleton } from "@/components/states";
import { fmtPEN } from "@/lib/pricing";
import {
  buscarVentas, getVentaDevolucion, listDevoluciones, registrarDevolucion, anularDevolucion,
  emitirNotaCredito, rangoMesLima, mesActualLima, fmtFechaCorta,
  MOTIVO_LABEL, REEMBOLSO_LABEL, NC_LABEL,
  type Devolucion, type VentaBusqueda, type VentaDetalle, type MotivoDev, type MetodoReembolso, type NcEstado,
} from "@/lib/devoluciones.functions";

export const Route = createFileRoute("/_authenticated/devoluciones")({
  head: () => ({ meta: [{ title: "Devoluciones — G&M" }] }),
  component: DevolucionesPage,
});

const NC_CLS: Record<NcEstado, string> = {
  no_aplica: "bg-muted text-muted-foreground border-border",
  pendiente: "bg-amber-100 text-amber-800 border-amber-200",
  aceptado: "bg-emerald-100 text-emerald-800 border-emerald-200",
  rechazado: "bg-red-100 text-red-800 border-red-200",
  error: "bg-red-100 text-red-800 border-red-200",
};

// ── Página ───────────────────────────────────────────────────
function DevolucionesPage() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const qc = useQueryClient();
  const [mes, setMes] = useState(mesActualLima());
  const [nueva, setNueva] = useState(false);
  const [anular, setAnular] = useState<Devolucion | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["devoluciones", mes],
    queryFn: () => listDevoluciones(rangoMesLima(mes)),
    enabled: /^\d{4}-\d{2}$/.test(mes),
  });

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ["devoluciones"] });
    qc.invalidateQueries({ queryKey: ["caja"] });
  };

  const emitir = useMutation({
    mutationFn: (id: string) => emitirNotaCredito(id),
    onSuccess: (r) => {
      refrescar();
      r.aceptado ? toast.success(`Nota de crédito ${r.serie}-${r.numero} aceptada por SUNAT`)
                 : toast.warning(`Nubefact respondió: ${r.descripcion || "revisa la nota de crédito"}`);
    },
    onError: (e: Error) => { refrescar(); toast.error(e.message); },
  });

  const vivas = useMemo(() => rows.filter((d) => d.estado === "registrada"), [rows]);
  const totalMes = vivas.reduce((s, d) => s + d.total, 0);
  const ncPendientes = vivas.filter((d) => ["pendiente", "error", "rechazado"].includes(d.nc_estado)).length;

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold"><Undo2 className="h-5 w-5" /> Devoluciones</h1>
          <p className="text-sm text-muted-foreground">
            Registra lo que el cliente devuelve, reembolsa y emite la nota de crédito cuando corresponde.
          </p>
        </div>
        <Button size="sm" onClick={() => setNueva(true)}><Plus className="mr-1.5 h-4 w-4" /> Nueva devolución</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="w-[170px]" />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Devuelto en el mes</div>
          <div className="mt-1 text-2xl font-semibold">{fmtPEN(totalMes)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Devoluciones</div>
          <div className="mt-1 text-2xl font-semibold">{vivas.length}</div>
        </Card>
        <Card className={`p-4 ${ncPendientes > 0 ? "border-amber-200 bg-amber-50/60" : ""}`}>
          <div className="text-xs text-muted-foreground">Notas de crédito por emitir</div>
          <div className="mt-1 text-2xl font-semibold">{ncPendientes}</div>
        </Card>
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} cols={6} />
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState icon={Undo2} title="No hay devoluciones en este mes"
                      description="Cuando un cliente devuelva un producto, regístralo aquí para reembolsar y ajustar la caja."
                      action={<Button size="sm" onClick={() => setNueva(true)}>Nueva devolución</Button>} />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Devolución</th>
                  <th className="px-4 py-3 font-medium">Productos</th>
                  <th className="px-4 py-3 font-medium">Motivo</th>
                  <th className="px-4 py-3 text-right font-medium">Reembolso</th>
                  <th className="px-4 py-3 font-medium">Nota de crédito</th>
                  <th className="px-4 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {rows.map((d) => {
                  const anulada = d.estado === "anulada";
                  const puedeEmitir = !anulada && ["pendiente", "error", "rechazado"].includes(d.nc_estado);
                  const busy = emitir.isPending && emitir.variables === d.id;
                  return (
                    <tr key={d.id} className={`align-top ${anulada ? "opacity-50" : ""}`}>
                      <td className="px-4 py-3">
                        <div className={`font-medium ${anulada ? "line-through" : ""}`}>{d.numero}</div>
                        <div className="text-xs text-muted-foreground">{fmtFechaCorta(d.created_at)} · venta {d.venta_numero ?? "—"}</div>
                        {anulada && <div className="text-xs text-red-700">Anulada: {d.anulado_motivo}</div>}
                      </td>
                      <td className="max-w-[220px] px-4 py-3 text-xs">
                        {d.devolucion_items.map((i, k) => (
                          <div key={k} className="truncate">{i.qty}× {i.title}</div>
                        ))}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {MOTIVO_LABEL[d.motivo]}
                        {d.detalle && <div className="text-muted-foreground">{d.detalle}</div>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className="font-medium">{fmtPEN(d.total)}</div>
                        <div className="text-xs text-muted-foreground">{REEMBOLSO_LABEL[d.metodo_reembolso].split(" (")[0]}</div>
                      </td>
                      <td className="px-4 py-3">
                        {!anulada && (
                          <Badge variant="outline" className={NC_CLS[d.nc_estado]}>{NC_LABEL[d.nc_estado]}</Badge>
                        )}
                        {d.nc_serie && d.nc_numero && d.nc_estado !== "no_aplica" && (
                          <div className="mt-1 text-xs text-muted-foreground">{d.nc_serie}-{String(d.nc_numero).padStart(8, "0")}</div>
                        )}
                        {d.nc_error && d.nc_estado !== "aceptado" && !anulada && (
                          <div className="mt-1 max-w-[220px] text-xs text-red-700">{d.nc_error}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-1">
                          {puedeEmitir && (
                            <Button size="sm" className="h-8" disabled={busy} onClick={() => emitir.mutate(d.id)}>
                              {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <FileText className="mr-1 h-3.5 w-3.5" />}
                              {d.nc_estado === "pendiente" ? "Emitir NC" : "Reintentar NC"}
                            </Button>
                          )}
                          {d.nc_estado === "aceptado" && d.nc_enlace && (
                            <Button asChild size="sm" variant="outline" className="h-8">
                              <a href={d.nc_enlace} target="_blank" rel="noreferrer">
                                <FileCheck2 className="mr-1 h-3.5 w-3.5" /> Ver NC
                              </a>
                            </Button>
                          )}
                          {isAdmin && !anulada && d.nc_estado !== "aceptado" && (
                            <Button size="icon" variant="ghost" className="h-8 w-8" title="Anular devolución"
                                    onClick={() => setAnular(d)}>
                              <Ban className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {nueva && (
        <NuevaDevolucionDialog onClose={() => setNueva(false)}
                               onDone={() => { setNueva(false); refrescar(); }} />
      )}
      {anular && (
        <AnularDialog d={anular} onClose={() => setAnular(null)}
                      onDone={() => { setAnular(null); refrescar(); }} />
      )}
    </div>
  );
}

// ── Nueva devolución ─────────────────────────────────────────
function NuevaDevolucionDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [q, setQ] = useState("");
  const [saleId, setSaleId] = useState<string | null>(null);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>Nueva devolución</DialogTitle></DialogHeader>
        {saleId ? (
          <Detalle saleId={saleId} onBack={() => setSaleId(null)} onDone={onDone} />
        ) : (
          <Buscador q={q} setQ={setQ} onPick={(v) => setSaleId(v.id)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Buscador({ q, setQ, onPick }: { q: string; setQ: (s: string) => void; onPick: (v: VentaBusqueda) => void }) {
  const { data: ventas = [], isFetching } = useQuery({
    queryKey: ["devoluciones", "buscar", q],
    queryFn: () => buscarVentas(q),
    placeholderData: (prev) => prev,
  });
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" autoFocus value={q} onChange={(e) => setQ(e.target.value)}
               placeholder="Busca por N.º de comprobante, cliente o documento (ej. B001-00000042)" />
      </div>
      {isFetching && ventas.length === 0 ? (
        <div className="py-6 text-center text-sm text-muted-foreground">Buscando…</div>
      ) : ventas.length === 0 ? (
        <EmptyState compact icon={Search} title="Sin resultados" description="Prueba con otro número o con el nombre del cliente." />
      ) : (
        <div className="divide-y rounded-md border">
          {ventas.map((v) => {
            const completa = v.devuelto >= v.total;
            return (
              <button key={v.id} type="button" disabled={completa} onClick={() => onPick(v)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{v.numero}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {v.cliente ?? "Cliente varios"} · {fmtFechaCorta(v.created_at)}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm font-medium">{fmtPEN(v.total)}</div>
                  {v.devuelto > 0 && (
                    <div className="text-[11px] text-amber-700">{completa ? "Ya devuelta" : `Devuelto ${fmtPEN(v.devuelto)}`}</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">Se muestran las 15 ventas más recientes que coinciden.</p>
    </div>
  );
}

function Detalle({ saleId, onBack, onDone }: { saleId: string; onBack: () => void; onDone: () => void }) {
  const { data: venta, isLoading } = useQuery({
    queryKey: ["devoluciones", "venta", saleId],
    queryFn: () => getVentaDevolucion(saleId),
  });
  if (isLoading || !venta) return <div className="py-8 text-center text-sm text-muted-foreground">Cargando venta…</div>;
  return <Formulario venta={venta} onBack={onBack} onDone={onDone} />;
}

function Formulario({ venta, onBack, onDone }: { venta: VentaDetalle; onBack: () => void; onDone: () => void }) {
  const [cant, setCant] = useState<Record<string, string>>({});
  const [motivo, setMotivo] = useState<MotivoDev>("no_conforme");
  const [detalle, setDetalle] = useState("");
  const [metodo, setMetodo] = useState<MetodoReembolso>(
    (["efectivo", "tarjeta", "transferencia", "yape_plin"] as string[]).includes(venta.metodo_pago)
      ? (venta.metodo_pago as MetodoReembolso) : "efectivo",
  );
  const lleva_nc = ["boleta", "factura"].includes(venta.tipo) && venta.nubefact_estado === "aceptado";
  const [emitirNc, setEmitirNc] = useState(true);

  const lineas = venta.items.map((i) => ({ ...i, max: Math.max(0, i.qty - i.devuelto) }));
  const seleccion = lineas
    .map((i) => ({ i, qty: Number(cant[i.id] ?? 0) }))
    .filter((x) => x.qty > 0);
  const total = seleccion.reduce((s, x) => s + Math.round(x.qty * x.i.unit_price * 100) / 100, 0);
  const excede = seleccion.some((x) => x.qty > x.i.max);

  const guardar = useMutation({
    mutationFn: async () => {
      const r = await registrarDevolucion({
        sale_id: venta.id,
        items: seleccion.map((x) => ({ sale_item_id: x.i.id, qty: x.qty })),
        motivo, detalle, metodo,
      });
      let nc: Awaited<ReturnType<typeof emitirNotaCredito>> | null = null;
      let ncError: string | null = null;
      if (emitirNc && r.nc_estado === "pendiente") {
        try { nc = await emitirNotaCredito(r.id); } catch (e) { ncError = (e as Error).message; }
      }
      return { r, nc, ncError };
    },
    onSuccess: ({ r, nc, ncError }) => {
      toast.success(`Devolución ${r.numero} registrada por ${fmtPEN(r.total)}${r.en_caja ? " · descontada de la caja" : ""}`);
      if (nc) {
        nc.aceptado ? toast.success(`Nota de crédito ${nc.serie}-${nc.numero} aceptada por SUNAT`)
                    : toast.warning(`Nubefact respondió: ${nc.descripcion || "revisa la nota de crédito"}`);
      }
      if (ncError) toast.error(`Devolución guardada, pero la nota de crédito falló: ${ncError}. Reintenta desde la lista.`);
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" className="-ml-2 h-7" onClick={onBack}>
        <ArrowLeft className="mr-1 h-4 w-4" /> Cambiar venta
      </Button>
      <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
        <div className="font-medium">{venta.numero} · {fmtPEN(venta.total)}</div>
        <div className="text-xs text-muted-foreground">{venta.cliente ?? "Cliente varios"} · {fmtFechaCorta(venta.created_at)}</div>
      </div>

      <div className="space-y-2">
        <Label>¿Qué devuelve el cliente?</Label>
        <div className="divide-y rounded-md border">
          {lineas.map((i) => (
            <div key={i.id} className={`flex items-center justify-between gap-3 px-3 py-2.5 ${i.max === 0 ? "opacity-50" : ""}`}>
              <div className="min-w-0">
                <div className="truncate text-sm">{i.title}</div>
                <div className="text-xs text-muted-foreground">
                  {fmtPEN(i.unit_price)} c/u · vendidos {i.qty}{i.devuelto > 0 ? ` · ya devueltos ${i.devuelto}` : ""}
                </div>
              </div>
              <Input type="number" inputMode="decimal" min={0} max={i.max} step="1" disabled={i.max === 0}
                     className={`w-20 text-right ${Number(cant[i.id] ?? 0) > i.max ? "border-red-400" : ""}`}
                     placeholder={`0–${i.max}`} value={cant[i.id] ?? ""}
                     onChange={(e) => setCant((p) => ({ ...p, [i.id]: e.target.value }))} />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Motivo</Label>
          <Select value={motivo} onValueChange={(v) => setMotivo(v as MotivoDev)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(MOTIVO_LABEL) as MotivoDev[]).map((m) => (
                <SelectItem key={m} value={m}>{MOTIVO_LABEL[m]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Reembolso por</Label>
          <Select value={metodo} onValueChange={(v) => setMetodo(v as MetodoReembolso)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(REEMBOLSO_LABEL) as MetodoReembolso[]).map((m) => (
                <SelectItem key={m} value={m}>{REEMBOLSO_LABEL[m]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Detalle (opcional)</Label>
        <Textarea rows={2} maxLength={300} value={detalle} onChange={(e) => setDetalle(e.target.value)}
                  placeholder="Ej. La pata llegó rota, el cliente trae fotos" />
      </div>

      <div className="rounded-md border px-3 py-2.5">
        <div className="flex items-center justify-between">
          <span className="text-sm">Total a reembolsar</span>
          <span className="text-lg font-semibold">{fmtPEN(total)}</span>
        </div>
        {metodo === "efectivo" && (
          <p className="mt-1 text-xs text-muted-foreground">Saldrá del efectivo de la caja abierta. Si no hay caja abierta, no se podrá registrar.</p>
        )}
      </div>

      {lleva_nc ? (
        <label className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50/60 px-3 py-2.5 text-sm">
          <Checkbox checked={emitirNc} onCheckedChange={(c) => setEmitirNc(c === true)} className="mt-0.5" />
          <span>
            Emitir la <strong>nota de crédito electrónica</strong> ahora
            <span className="block text-xs text-muted-foreground">
              El comprobante {venta.numero} fue aceptado por SUNAT, por eso corresponde una nota de crédito.
            </span>
          </span>
        </label>
      ) : (
        <div className="flex gap-2 rounded-md bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {venta.tipo === "nota"
            ? "Las notas de venta no son comprobantes electrónicos, no llevan nota de crédito."
            : "Este comprobante no está aceptado por SUNAT, así que no se emite nota de crédito. Si lo emitiste por error, anúlalo desde Ventas."}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" onClick={onBack}>Volver</Button>
        <Button onClick={() => guardar.mutate()} disabled={guardar.isPending || seleccion.length === 0 || excede}>
          {guardar.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Registrar devolución
        </Button>
      </div>
    </div>
  );
}

function AnularDialog({ d, onClose, onDone }: { d: Devolucion; onClose: () => void; onDone: () => void }) {
  const [motivo, setMotivo] = useState("");
  const anular = useMutation({
    mutationFn: () => anularDevolucion({ id: d.id, motivo }),
    onSuccess: () => { toast.success("Devolución anulada"); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Anular {d.numero}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Se libera lo devuelto para poder registrarlo otra vez{d.metodo_reembolso === "efectivo"
              ? " y el reembolso en efectivo vuelve a la caja (si sigue abierta)" : ""}. Si ya devolviste el dinero al cliente, no la anules.
          </p>
          <div className="space-y-1.5">
            <Label>Motivo</Label>
            <Input autoFocus maxLength={200} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Volver</Button>
            <Button variant="destructive" onClick={() => anular.mutate()} disabled={anular.isPending || !motivo.trim()}>
              {anular.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Anular
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
