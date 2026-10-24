// src/routes/_authenticated/caja.tsx
// G&M Mueblería — Caja y gastos del POS
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Wallet, Lock, Unlock, Plus, Ban, Download, Loader2, ArrowDownCircle, ArrowUpCircle, HandCoins, Eye,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, TableSkeleton } from "@/components/states";
import { fmtPEN } from "@/lib/pricing";
import {
  getTurnoActual, getResumenTurno, listTurnosCerrados, listMovimientos, abrirCaja, cerrarCaja,
  registrarMovimientoCaja, anularMovimientoCaja, rangoMesLima, mesActualLima, fmtFechaHora,
  movimientosACsv, categoriaLabel, GASTO_CATEGORIAS, METODO_LABEL, TIPO_MOV_LABEL,
  type Turno, type Movimiento, type ResumenTurno, type MetodoPago, type TipoMov, type TipoManual,
} from "@/lib/caja.functions";

export const Route = createFileRoute("/_authenticated/caja")({
  head: () => ({ meta: [{ title: "Caja y gastos — G&M" }] }),
  component: CajaPage,
});

const METODOS: MetodoPago[] = ["efectivo", "tarjeta", "transferencia", "yape_plin"];

const TIPO_CLS: Record<TipoMov, string> = {
  gasto: "bg-red-100 text-red-800 border-red-200",
  ingreso: "bg-emerald-100 text-emerald-800 border-emerald-200",
  retiro: "bg-amber-100 text-amber-800 border-amber-200",
  devolucion: "bg-orange-100 text-orange-800 border-orange-200",
};

function CajaPage() {
  const { roles, user } = useAuth();
  const isAdmin = roles.includes("admin");
  const qc = useQueryClient();

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ["caja"] });
  };

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Wallet className="h-5 w-5" /> Caja y gastos
        </h1>
        <p className="text-sm text-muted-foreground">
          Abre y cierra la caja del POS, registra gastos y retiros, y cuadra el efectivo del día.
        </p>
      </div>

      <Tabs defaultValue="turno">
        <TabsList>
          <TabsTrigger value="turno">Turno actual</TabsTrigger>
          {isAdmin && <TabsTrigger value="gastos">Gastos</TabsTrigger>}
          {isAdmin && <TabsTrigger value="historial">Historial</TabsTrigger>}
        </TabsList>

        <TabsContent value="turno" className="mt-4">
          <TurnoActual isAdmin={isAdmin} userId={user?.id ?? null} onChange={refrescar} />
        </TabsContent>
        {isAdmin && (
          <TabsContent value="gastos" className="mt-4"><GastosTab /></TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="historial" className="mt-4"><HistorialTab /></TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Turno actual
// ─────────────────────────────────────────────────────────────
function TurnoActual({ isAdmin, userId, onChange }: { isAdmin: boolean; userId: string | null; onChange: () => void }) {
  const [movOpen, setMovOpen] = useState(false);
  const [cierreOpen, setCierreOpen] = useState(false);
  const [anular, setAnular] = useState<Movimiento | null>(null);

  const { data: turno, isLoading } = useQuery({ queryKey: ["caja", "turno"], queryFn: getTurnoActual });

  const { data: resumen } = useQuery({
    queryKey: ["caja", "resumen", turno?.id],
    queryFn: () => getResumenTurno(turno!.id),
    enabled: !!turno,
    refetchInterval: 30_000, // refleja ventas hechas desde otro equipo
  });

  const { data: movs = [] } = useQuery({
    queryKey: ["caja", "movs", turno?.id],
    queryFn: () => listMovimientos({ turnoId: turno!.id }),
    enabled: !!turno,
  });

  if (isLoading) return <TableSkeleton rows={4} cols={4} />;
  if (!turno) return <AbrirCaja onOpened={onChange} />;

  const puedeCerrar = isAdmin || turno.abierto_por === userId;

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-emerald-100 p-2 text-emerald-700"><Unlock className="h-4 w-4" /></div>
          <div>
            <div className="font-medium">Caja abierta</div>
            <div className="text-xs text-muted-foreground">
              Desde {fmtFechaHora(turno.abierta_at)} · apertura {fmtPEN(turno.monto_apertura)}
              {turno.notas_apertura ? ` · ${turno.notas_apertura}` : ""}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setMovOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Gasto / retiro / ingreso
          </Button>
          <Button size="sm" onClick={() => setCierreOpen(true)} disabled={!resumen || !puedeCerrar}
                  title={puedeCerrar ? "" : "Solo quien abrió la caja o un administrador puede cerrarla"}>
            <Lock className="mr-1.5 h-4 w-4" /> Cerrar caja
          </Button>
        </div>
      </Card>

      {resumen && <ResumenCards r={resumen} />}

      <Card className="overflow-hidden">
        <div className="border-b px-4 py-3 text-sm font-medium">Movimientos del turno</div>
        {movs.length === 0 ? (
          <EmptyState compact icon={HandCoins} title="Sin movimientos todavía"
                      description="Registra aquí los gastos pagados con efectivo de la caja, retiros o ingresos extra." />
        ) : (
          <MovTable rows={movs} onAnular={isAdmin ? setAnular : undefined} />
        )}
      </Card>

      {movOpen && (
        <MovimientoDialog onClose={() => setMovOpen(false)}
                          onSaved={() => { setMovOpen(false); onChange(); }} />
      )}
      {cierreOpen && resumen && (
        <CierreDialog turno={turno} resumen={resumen}
                      onClose={() => setCierreOpen(false)}
                      onClosed={() => { setCierreOpen(false); onChange(); }} />
      )}
      {anular && (
        <AnularDialog mov={anular} onClose={() => setAnular(null)}
                      onDone={() => { setAnular(null); onChange(); }} />
      )}
    </div>
  );
}

function ResumenCards({ r }: { r: ResumenTurno }) {
  const gastos = r.gastos_efectivo + r.gastos_otros;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="border-emerald-200 bg-emerald-50/60 p-4">
          <div className="text-xs text-muted-foreground">Efectivo esperado en caja</div>
          <div className="mt-1 text-2xl font-semibold text-emerald-800">{fmtPEN(r.esperado)}</div>
          <div className="text-[11px] text-muted-foreground">Apertura + ventas en efectivo ± movimientos</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Ventas del turno</div>
          <div className="mt-1 text-2xl font-semibold">{fmtPEN(r.ventas_total)}</div>
          <div className="text-[11px] text-muted-foreground">
            {r.ventas_n} venta{r.ventas_n !== 1 && "s"}{r.anuladas_n > 0 ? ` · ${r.anuladas_n} anulada${r.anuladas_n !== 1 ? "s" : ""}` : ""}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Gastos</div>
          <div className="mt-1 text-2xl font-semibold">{fmtPEN(gastos)}</div>
          <div className="text-[11px] text-muted-foreground">
            {fmtPEN(r.gastos_efectivo)} de la caja · {fmtPEN(r.gastos_otros)} otros medios
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Retiros / ingresos</div>
          <div className="mt-1 text-2xl font-semibold">{fmtPEN(r.retiros)}</div>
          <div className="text-[11px] text-muted-foreground">
            Ingresos extra: {fmtPEN(r.ingresos)} · Devoluciones: {fmtPEN(r.devoluciones ?? 0)}
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="mb-2 text-sm font-medium">Ventas por medio de pago</div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {METODOS.map((m) => {
            const x = r.ventas[m];
            return (
              <div key={m} className="rounded-md border px-3 py-2">
                <div className="text-xs text-muted-foreground">{METODO_LABEL[m]}</div>
                <div className="font-medium">{fmtPEN(x?.total ?? 0)}</div>
                <div className="text-[11px] text-muted-foreground">{x?.n ?? 0} venta{(x?.n ?? 0) !== 1 && "s"}</div>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Solo cuenta ventas hechas en el POS. Los pagos de pedidos de la tienda online no pasan por esta caja.
        </p>
      </Card>
    </div>
  );
}

function MovTable({ rows, onAnular }: { rows: Movimiento[]; onAnular?: (m: Movimiento) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">Hora</th>
            <th className="px-4 py-2.5 font-medium">Tipo</th>
            <th className="px-4 py-2.5 font-medium">Detalle</th>
            <th className="px-4 py-2.5 font-medium">Medio</th>
            <th className="px-4 py-2.5 text-right font-medium">Monto</th>
            {onAnular && <th className="w-10 px-2 py-2.5" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {rows.map((m) => (
            <tr key={m.id} className={m.anulado ? "opacity-50" : ""}>
              <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">{fmtFechaHora(m.created_at)}</td>
              <td className="px-4 py-2.5">
                <Badge variant="outline" className={TIPO_CLS[m.tipo]}>{TIPO_MOV_LABEL[m.tipo]}</Badge>
              </td>
              <td className="px-4 py-2.5">
                <div className={m.anulado ? "line-through" : ""}>{m.descripcion}</div>
                <div className="text-xs text-muted-foreground">
                  {m.tipo === "gasto" ? categoriaLabel(m.categoria) : ""}
                  {m.comprobante ? ` · ${m.comprobante}` : ""}
                  {m.anulado && m.anulado_motivo ? ` · Anulado: ${m.anulado_motivo}` : ""}
                </div>
              </td>
              <td className="px-4 py-2.5 text-xs">{METODO_LABEL[m.metodo]}</td>
              <td className={`whitespace-nowrap px-4 py-2.5 text-right font-medium ${m.tipo === "ingreso" ? "text-emerald-700" : "text-red-700"}`}>
                {m.tipo === "ingreso" ? "+" : "−"}{fmtPEN(m.monto)}
              </td>
              {onAnular && (
                <td className="px-2 py-2.5">
                  {!m.anulado && (
                    <Button size="icon" variant="ghost" className="h-8 w-8" title="Anular" onClick={() => onAnular(m)}>
                      <Ban className="h-4 w-4" />
                    </Button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Abrir caja ───────────────────────────────────────────────
function AbrirCaja({ onOpened }: { onOpened: () => void }) {
  const [monto, setMonto] = useState("");
  const [notas, setNotas] = useState("");
  const abrir = useMutation({
    mutationFn: () => abrirCaja({ monto: Number(monto) || 0, notas }),
    onSuccess: () => { toast.success("Caja abierta"); onOpened(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Card className="mx-auto max-w-md space-y-4 p-6">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-muted p-2.5"><Lock className="h-5 w-5 text-muted-foreground" /></div>
        <div>
          <div className="font-medium">La caja está cerrada</div>
          <div className="text-xs text-muted-foreground">Cuenta el efectivo inicial y ábrela para empezar el turno.</div>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Efectivo inicial (S/)</Label>
        <Input type="number" inputMode="decimal" min={0} step="0.01" value={monto}
               onChange={(e) => setMonto(e.target.value)} placeholder="0.00" autoFocus />
      </div>
      <div className="space-y-1.5">
        <Label>Notas (opcional)</Label>
        <Input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej. Turno mañana" maxLength={300} />
      </div>
      <Button className="w-full" onClick={() => abrir.mutate()} disabled={abrir.isPending || monto === ""}>
        {abrir.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Abrir caja
      </Button>
    </Card>
  );
}

// ── Registrar gasto / retiro / ingreso ───────────────────────
function MovimientoDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [tipo, setTipo] = useState<TipoManual>("gasto");
  const [categoria, setCategoria] = useState("otros");
  const [metodo, setMetodo] = useState<MetodoPago>("efectivo");
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [comprobante, setComprobante] = useState("");

  const guardar = useMutation({
    mutationFn: () => registrarMovimientoCaja({
      tipo, categoria, metodo, monto: Number(monto), descripcion, comprobante,
    }),
    onSuccess: () => { toast.success("Movimiento registrado"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const ayuda = {
    gasto: "Un pago del negocio. Si sale del efectivo de la caja, descuenta del esperado.",
    retiro: "Efectivo que sacas de la caja (a banco, al dueño, etc.). Descuenta del esperado.",
    ingreso: "Efectivo que entra a la caja fuera de una venta (ej. cambio, aporte). Suma al esperado.",
  }[tipo];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader><DialogTitle>Registrar movimiento</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-1.5">
            {(["gasto", "retiro", "ingreso"] as TipoManual[]).map((t) => (
              <Button key={t} type="button" size="sm" variant={tipo === t ? "default" : "outline"}
                      onClick={() => setTipo(t)}>
                {TIPO_MOV_LABEL[t]}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{ayuda}</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Monto (S/)</Label>
              <Input type="number" inputMode="decimal" min={0} step="0.01" value={monto}
                     onChange={(e) => setMonto(e.target.value)} placeholder="0.00" autoFocus />
            </div>
            {tipo === "gasto" ? (
              <div className="space-y-1.5">
                <Label>Pagado con</Label>
                <Select value={metodo} onValueChange={(v) => setMetodo(v as MetodoPago)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {METODOS.map((m) => <SelectItem key={m} value={m}>{METODO_LABEL[m]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Medio</Label>
                <Input value="Efectivo" disabled />
              </div>
            )}
          </div>

          {tipo === "gasto" && (
            <div className="space-y-1.5">
              <Label>Categoría</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GASTO_CATEGORIAS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Descripción</Label>
            <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={200}
                   placeholder={tipo === "gasto" ? "Ej. Flete de madera a taller" : tipo === "retiro" ? "Ej. Depósito al banco" : "Ej. Cambio para el turno"} />
          </div>
          {tipo === "gasto" && (
            <div className="space-y-1.5">
              <Label>N.º de comprobante (opcional)</Label>
              <Input value={comprobante} onChange={(e) => setComprobante(e.target.value)} maxLength={60} placeholder="Boleta / factura / recibo" />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={() => guardar.mutate()} disabled={guardar.isPending || !(Number(monto) > 0) || !descripcion.trim()}>
              {guardar.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Registrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Cerrar caja ──────────────────────────────────────────────
function CierreDialog({
  turno, resumen, onClose, onClosed,
}: { turno: Turno; resumen: ResumenTurno; onClose: () => void; onClosed: () => void }) {
  const [contado, setContado] = useState("");
  const [notas, setNotas] = useState("");
  const tiene = contado !== "";
  const dif = tiene ? Math.round((Number(contado) - resumen.esperado) * 100) / 100 : 0;

  const cerrar = useMutation({
    mutationFn: () => cerrarCaja({ turnoId: turno.id, contado: Number(contado), notas }),
    onSuccess: (r) => {
      toast.success(r.diferencia === 0 ? "Caja cerrada y cuadrada" : `Caja cerrada con diferencia de ${fmtPEN(r.diferencia)}`);
      onClosed();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Cerrar caja</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md bg-muted/50 px-3 py-2.5 text-sm">
            <div className="flex justify-between"><span>Apertura</span><span>{fmtPEN(resumen.apertura)}</span></div>
            <div className="flex justify-between"><span>+ Ventas en efectivo</span><span>{fmtPEN(resumen.ventas.efectivo?.total ?? 0)}</span></div>
            <div className="flex justify-between"><span>+ Ingresos</span><span>{fmtPEN(resumen.ingresos)}</span></div>
            <div className="flex justify-between"><span>− Gastos en efectivo</span><span>{fmtPEN(resumen.gastos_efectivo)}</span></div>
            <div className="flex justify-between"><span>− Retiros</span><span>{fmtPEN(resumen.retiros)}</span></div>
            {(resumen.devoluciones ?? 0) > 0 && (
              <div className="flex justify-between"><span>− Devoluciones en efectivo</span><span>{fmtPEN(resumen.devoluciones ?? 0)}</span></div>
            )}
            <div className="mt-1.5 flex justify-between border-t pt-1.5 font-semibold">
              <span>Efectivo esperado</span><span>{fmtPEN(resumen.esperado)}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Efectivo contado (S/)</Label>
            <Input type="number" inputMode="decimal" min={0} step="0.01" value={contado}
                   onChange={(e) => setContado(e.target.value)} placeholder="Cuenta los billetes y monedas" autoFocus />
          </div>

          {tiene && (
            <div className={`rounded-md border px-3 py-2 text-sm ${
              dif === 0 ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-amber-200 bg-amber-50 text-amber-900"}`}>
              {dif === 0 ? "La caja cuadra." : dif > 0
                ? `Sobran ${fmtPEN(dif)}.` : `Faltan ${fmtPEN(Math.abs(dif))}.`}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Notas del cierre {tiene && dif !== 0 ? "(obligatorio si hay diferencia)" : "(opcional)"}</Label>
            <Textarea rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={500} />
          </div>

          <p className="text-xs text-muted-foreground">
            Al cerrar no se podrán registrar más movimientos en este turno.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Volver</Button>
            <Button onClick={() => cerrar.mutate()}
                    disabled={cerrar.isPending || !tiene || (dif !== 0 && !notas.trim())}>
              {cerrar.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Cerrar caja
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AnularDialog({ mov, onClose, onDone }: { mov: Movimiento; onClose: () => void; onDone: () => void }) {
  const [motivo, setMotivo] = useState("");
  const anular = useMutation({
    mutationFn: () => anularMovimientoCaja({ id: mov.id, motivo }),
    onSuccess: () => { toast.success("Movimiento anulado"); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Anular movimiento</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {TIPO_MOV_LABEL[mov.tipo]} de {fmtPEN(mov.monto)} — {mov.descripcion}
          </p>
          <div className="space-y-1.5">
            <Label>Motivo</Label>
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} autoFocus />
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

// ─────────────────────────────────────────────────────────────
// Gastos (todos los turnos, por mes)
// ─────────────────────────────────────────────────────────────
function GastosTab() {
  const [mes, setMes] = useState(mesActualLima());
  const [cat, setCat] = useState("todas");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["caja", "gastos", mes],
    queryFn: () => { const r = rangoMesLima(mes); return listMovimientos({ tipo: "gasto", ...r }); },
    enabled: /^\d{4}-\d{2}$/.test(mes),
  });

  const vivos = useMemo(() => rows.filter((m) => !m.anulado), [rows]);
  const filtrados = useMemo(() => (cat === "todas" ? rows : rows.filter((m) => m.categoria === cat)), [rows, cat]);
  const total = vivos.reduce((s, m) => s + m.monto, 0);
  const porCat = useMemo(() => {
    const acc = new Map<string, number>();
    vivos.forEach((m) => acc.set(m.categoria, (acc.get(m.categoria) ?? 0) + m.monto));
    return [...acc.entries()].sort((a, b) => b[1] - a[1]);
  }, [vivos]);

  const exportar = () => {
    const blob = new Blob([movimientosACsv(filtrados)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `gastos-${mes}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="w-[170px]" />
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las categorías</SelectItem>
            {GASTO_CATEGORIAS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="ml-auto" onClick={exportar} disabled={filtrados.length === 0}>
          <Download className="mr-1.5 h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Gastos del mes</div>
          <div className="mt-1 text-2xl font-semibold">{fmtPEN(total)}</div>
          <div className="text-[11px] text-muted-foreground">{vivos.length} registro{vivos.length !== 1 && "s"} (sin anulados)</div>
        </Card>
        <Card className="p-4 md:col-span-2">
          <div className="mb-2 text-xs text-muted-foreground">Por categoría</div>
          {porCat.length === 0 ? (
            <div className="text-sm text-muted-foreground">Sin gastos en este mes.</div>
          ) : (
            <div className="space-y-1.5">
              {porCat.map(([c, v]) => (
                <div key={c} className="flex items-center gap-2 text-sm">
                  <div className="w-44 shrink-0 truncate">{categoriaLabel(c)}</div>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${total ? (v / total) * 100 : 0}%` }} />
                  </div>
                  <div className="w-24 shrink-0 text-right font-medium">{fmtPEN(v)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : (
        <Card className="overflow-hidden">
          {filtrados.length === 0 ? (
            <EmptyState compact icon={ArrowDownCircle} title="Sin gastos para este filtro" />
          ) : (
            <MovTable rows={filtrados} />
          )}
        </Card>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Historial de turnos
// ─────────────────────────────────────────────────────────────
function HistorialTab() {
  const [ver, setVer] = useState<Turno | null>(null);
  const { data: turnos = [], isLoading } = useQuery({ queryKey: ["caja", "historial"], queryFn: () => listTurnosCerrados() });

  if (isLoading) return <TableSkeleton rows={5} cols={6} />;
  if (turnos.length === 0) {
    return <EmptyState icon={ArrowUpCircle} title="Aún no hay turnos cerrados"
                       description="Cuando cierres la primera caja aparecerá aquí con su arqueo." />;
  }
  return (
    <>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Turno</th>
                <th className="px-4 py-3 text-right font-medium">Ventas</th>
                <th className="px-4 py-3 text-right font-medium">Esperado</th>
                <th className="px-4 py-3 text-right font-medium">Contado</th>
                <th className="px-4 py-3 text-right font-medium">Diferencia</th>
                <th className="w-10 px-2 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {turnos.map((t) => {
                const d = t.diferencia ?? 0;
                return (
                  <tr key={t.id}>
                    <td className="px-4 py-3">
                      <div>{fmtFechaHora(t.abierta_at)}</div>
                      <div className="text-xs text-muted-foreground">a {t.cerrada_at ? fmtFechaHora(t.cerrada_at) : "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-right">{fmtPEN(t.resumen?.ventas_total ?? 0)}</td>
                    <td className="px-4 py-3 text-right">{fmtPEN(t.efectivo_esperado ?? 0)}</td>
                    <td className="px-4 py-3 text-right">{fmtPEN(t.efectivo_contado ?? 0)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${d === 0 ? "text-emerald-700" : d < 0 ? "text-red-700" : "text-amber-700"}`}>
                      {d === 0 ? "Cuadra" : `${d > 0 ? "+" : "−"}${fmtPEN(Math.abs(d))}`}
                    </td>
                    <td className="px-2 py-3">
                      <Button size="icon" variant="ghost" className="h-8 w-8" title="Ver detalle" onClick={() => setVer(t)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      {ver && <DetalleTurnoDialog turno={ver} onClose={() => setVer(null)} />}
    </>
  );
}

function DetalleTurnoDialog({ turno, onClose }: { turno: Turno; onClose: () => void }) {
  const { data: movs = [] } = useQuery({
    queryKey: ["caja", "movs", turno.id],
    queryFn: () => listMovimientos({ turnoId: turno.id }),
  });
  const r = turno.resumen;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Turno del {fmtFechaHora(turno.abierta_at)}</DialogTitle>
        </DialogHeader>
        {r && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {METODOS.map((m) => (
                <div key={m} className="rounded-md border px-3 py-2">
                  <div className="text-xs text-muted-foreground">{METODO_LABEL[m]}</div>
                  <div className="font-medium">{fmtPEN(r.ventas[m]?.total ?? 0)}</div>
                  <div className="text-[11px] text-muted-foreground">{r.ventas[m]?.n ?? 0} ventas</div>
                </div>
              ))}
            </div>
            <div className="rounded-md bg-muted/50 px-3 py-2.5 text-sm">
              <div className="flex justify-between"><span>Apertura</span><span>{fmtPEN(r.apertura)}</span></div>
              <div className="flex justify-between"><span>+ Ventas en efectivo</span><span>{fmtPEN(r.ventas.efectivo?.total ?? 0)}</span></div>
              <div className="flex justify-between"><span>+ Ingresos</span><span>{fmtPEN(r.ingresos)}</span></div>
              <div className="flex justify-between"><span>− Gastos en efectivo</span><span>{fmtPEN(r.gastos_efectivo)}</span></div>
              <div className="flex justify-between"><span>− Retiros</span><span>{fmtPEN(r.retiros)}</span></div>
              {(r.devoluciones ?? 0) > 0 && (
                <div className="flex justify-between"><span>− Devoluciones en efectivo</span><span>{fmtPEN(r.devoluciones ?? 0)}</span></div>
              )}
              <div className="mt-1.5 flex justify-between border-t pt-1.5 font-semibold">
                <span>Esperado / contado</span><span>{fmtPEN(r.esperado)} / {fmtPEN(turno.efectivo_contado ?? 0)}</span>
              </div>
            </div>
            {turno.notas_cierre && <p className="text-sm"><span className="text-muted-foreground">Notas del cierre: </span>{turno.notas_cierre}</p>}
          </div>
        )}
        <Card className="overflow-hidden">
          {movs.length === 0 ? (
            <EmptyState compact title="Sin movimientos en este turno" />
          ) : (
            <MovTable rows={movs} />
          )}
        </Card>
      </DialogContent>
    </Dialog>
  );
}
