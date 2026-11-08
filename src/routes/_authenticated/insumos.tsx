import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listInsumos, upsertInsumo, registrarMovimiento,
  getBom, calcularMrp, getStockBajo,
  listProveedores, enviarAProduccion, listCarpinteros,
  listUbicaciones,
} from "@/lib/pos.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { Loader2, AlertTriangle, Plus, ArrowDown, Calculator, Package, Hammer } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { EmptyState, TableSkeleton } from "@/components/states";
import { RoleGate } from "@/components/RoleGate";
import { TarjetaFila, TarjetasMovil, BTN_TACTIL } from "@/components/admin/TarjetaFila";
import {
  formatoCantidad, formatoFaltante, limitarDecimales,
  estadoStock, faltaStock, ordenarPorUrgencia, type EstadoStock,
} from "@/lib/cantidades";

export const Route = createFileRoute("/_authenticated/insumos")({
  head: () => ({ meta: [{ title: "Insumos MRP — G&M" }] }),
  component: InsumosRoute,
});

// Insumos MRP (precios de compra, proveedores, stock) es solo del administrador.
function InsumosRoute() {
  return (
    <RoleGate allow={["admin"]}>
      <InsumosPage />
    </RoleGate>
  );
}

const MODELOS = ["Vintage", "Rex", "Lineal Punta", "London", "Garra"] as const;
const TALLAS  = ["2 pies", "2.5 pies", "3 pies", "3.5 pies", "4 pies", "5 pies", "6 pies"] as const;
const UNIDADES = ["metros", "kg", "litros", "unidades", "planchas", "piezas", "paquetes", "palos", "pies", "bolsas"];

// Enteros para unidades/planchas…, máx. 1 decimal para metros/kg… (ver src/lib/cantidades.ts)
const fmt = formatoCantidad;

// Estado de stock (ver estadoStock en src/lib/cantidades.ts): rojo = falta, verde = suficiente, gris = sin mínimo
const ESTADO_STOCK: Record<EstadoStock, { label: string; badge: string; texto: string; fila: string }> = {
  sin_stock:    { label: "Sin stock",    badge: "bg-red-100 text-red-700",           texto: "text-red-600",       fila: "bg-red-50/50" },
  insuficiente: { label: "Insuficiente", badge: "bg-red-100 text-red-700",           texto: "text-red-600",       fila: "bg-red-50/50" },
  suficiente:   { label: "Suficiente",   badge: "bg-green-100 text-green-800",       texto: "text-green-700",     fila: "hover:bg-muted/20" },
  sin_minimo:   { label: "Sin mínimo",   badge: "bg-muted text-muted-foreground",    texto: "text-foreground",    fila: "hover:bg-muted/20" },
};

// Modelos que usan piezas en vez de talla
const MODELOS_CON_PIEZAS = ["London"] as const;
const PIEZAS_LONDON = [
  { id: "1 cuerpo",  label: "Sofá 1 cuerpo" },
  { id: "2 cuerpos", label: "Sofá 2 cuerpos" },
  { id: "3 cuerpos", label: "Sofá 3 cuerpos" },
] as const;

type FilaPedido =
  | { tipo: "talla";   modelo: string; talla: string; cantidad: number }
  | { tipo: "piezas";  modelo: string; piezas: Record<string, number>; cantidad: number };

/** Expande una FilaPedido a los pedidos simples que acepta calcularMrp */
function expandirPedidos(filas: FilaPedido[]) {
  const result: Array<{ modelo: string; talla: string; cantidad: number }> = [];
  for (const fila of filas) {
    if (fila.tipo === "talla") {
      result.push({ modelo: fila.modelo, talla: fila.talla, cantidad: fila.cantidad });
    } else {
      for (const [pieza, qty] of Object.entries(fila.piezas)) {
        if (qty > 0) {
          // multiplicar por cantidad de juegos completos
          result.push({ modelo: fila.modelo, talla: pieza, cantidad: qty * fila.cantidad });
        }
      }
    }
  }
  return result;
}

// ── Modal Fabricar ────────────────────────────────────────────
function FabricarDialog({
  insumos,
  descripcion,
  onClose,
  onDone,
}: {
  insumos: Array<{ nombre: string; necesario: number; unidad: string; faltante: number; stock_actual: number }>;
  descripcion: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [carpinteroId, setCarpinteroId] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [prioridad, setPrioridad] = useState("2");

  const { data: carpinterosData } = useQuery({
    queryKey: ["carpinteros"],
    queryFn: listCarpinteros,
  });

  const hayFaltantes = insumos.some((i) => i.faltante > 0);

  // Necesitamos los insumo_id — los traemos del BOM calculado que ya tiene el resultado
  // Pero calcularMrp no devuelve insumo_id, así que hacemos una query adicional
  const { data: insumosData } = useQuery({
    queryKey: ["insumos"],
    queryFn: listInsumos,
    staleTime: 30_000,
  });

  const fabricarMut = useMutation({
    mutationFn: async () => {
      // Mapear nombre → id
      const insumosMap = new Map(
        (insumosData?.insumos ?? []).map((i: any) => [i.nombre, i.id])
      );
      const insumosPayload = insumos
        .filter((i) => i.necesario > 0)
        .map((i) => ({
          insumo_id: insumosMap.get(i.nombre) as string,
          cantidad:  i.necesario,
          nombre:    i.nombre,
        }))
        .filter((i) => i.insumo_id); // descartar si no se encontró ID

      return enviarAProduccion({
        descripcion,
        insumos: insumosPayload,
        carpintero_id:      carpinteroId || undefined,
        observaciones:      observaciones || undefined,
        fecha_fin_estimada: fechaFin || undefined,
        prioridad:          Number(prioridad),
      });
    },
    onSuccess: (res) => {
      toast.success(`Orden ${res.order_number} enviada a producción`);
      qc.invalidateQueries({ queryKey: ["insumos"] });
      qc.invalidateQueries({ queryKey: ["insumos-alertas"] });
      qc.invalidateQueries({ queryKey: ["produccion"] });
      onDone();
      navigate({ to: "/produccion" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Hammer className="h-5 w-5" /> Enviar a producción
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-1">
          {/* Resumen */}
          <div className="bg-muted/40 rounded-xl p-3 text-sm">
            <p className="text-xs text-muted-foreground mb-1">Pedido a fabricar</p>
            <p className="font-medium">{descripcion}</p>
          </div>

          {/* Alerta de faltantes */}
          {hayFaltantes && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>Hay insumos insuficientes. Se registrará la salida de lo disponible, pero puede quedar stock negativo. Asegúrate de reponer antes de fabricar.</span>
            </div>
          )}

          {/* Tabla de insumos a descontar */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Insumos a descontar</p>
            <div className="border rounded-lg overflow-x-auto text-sm">
              <table className="w-full">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs text-muted-foreground">Insumo</th>
                    <th className="px-3 py-2 text-right text-xs text-muted-foreground">Cantidad</th>
                    <th className="px-3 py-2 text-right text-xs text-muted-foreground">Stock tras descuento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {insumos.filter(i => i.necesario > 0).map((i) => {
                    const stockTras = i.stock_actual - i.necesario;
                    return (
                      <tr key={i.nombre} className={i.faltante > 0 ? "bg-red-50/40" : ""}>
                        <td className="px-3 py-2">{i.nombre}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{fmt(i.necesario, i.unidad)}</td>
                        <td className={`px-3 py-2 text-right font-semibold ${stockTras < 0 ? "text-red-600" : "text-green-700"}`}>
                          {fmt(stockTras, i.unidad)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Opcionales */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Detalles de producción (opcional)</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">Carpintero</Label>
                <Select value={carpinteroId} onValueChange={(v) => setCarpinteroId(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin asignar</SelectItem>
                    {(carpinterosData?.carpinteros ?? []).map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Prioridad</Label>
                <Select value={prioridad} onValueChange={setPrioridad}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">🔴 Urgente</SelectItem>
                    <SelectItem value="2">🔵 Normal</SelectItem>
                    <SelectItem value="3">⚪ Baja</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs mb-1 block">Fecha fin estimada</Label>
              <Input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
            </div>

            <div>
              <Label className="text-xs mb-1 block">Observaciones</Label>
              <Textarea
                rows={3}
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Instrucciones especiales, material, color, medidas..."
                className="text-sm"
              />
            </div>
          </div>

          {/* Acciones */}
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button
              className="bg-[#4a2c1a] hover:bg-[#3a200f] text-white gap-2"
              disabled={fabricarMut.isPending || !insumosData}
              onClick={() => fabricarMut.mutate()}
            >
              {fabricarMut.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Hammer className="h-4 w-4" />}
              Confirmar y fabricar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Calculadora MRP ──────────────────────────────────────────
function FilaModelo({
  fila, index, total,
  onChange, onRemove,
}: {
  fila: FilaPedido; index: number; total: number;
  onChange: (i: number, f: FilaPedido) => void;
  onRemove: (i: number) => void;
}) {
  const usaPiezas = (MODELOS_CON_PIEZAS as readonly string[]).includes(fila.modelo);

  const setModelo = (modelo: string) => {
    if ((MODELOS_CON_PIEZAS as readonly string[]).includes(modelo)) {
      onChange(index, { tipo: "piezas", modelo, piezas: { "1 cuerpo": 1, "2 cuerpos": 1, "3 cuerpos": 1 }, cantidad: 1 });
    } else {
      onChange(index, { tipo: "talla", modelo, talla: "6 pies", cantidad: 1 });
    }
  };

  return (
    <div className="border border-border/50 rounded-xl p-4 space-y-3 bg-card">
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Label className="text-xs mb-1 block">Modelo</Label>
          <Select value={fila.modelo} onValueChange={setModelo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {MODELOS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-24">
          <Label className="text-xs mb-1 block">
            {usaPiezas ? "Juegos" : "Cantidad"}
          </Label>
          <Input
            type="number" min={1} step={1} inputMode="numeric" value={fila.cantidad}
            onChange={(e) => onChange(index, { ...fila, cantidad: Math.max(1, Math.floor(Number(e.target.value)) || 1) })}
          />
        </div>
        {total > 1 && (
          <Button size="sm" variant="ghost" className="h-11 min-w-11 text-muted-foreground" aria-label="Quitar modelo" onClick={() => onRemove(index)}>✕</Button>
        )}
      </div>

      {/* Talla (modelos normales) */}
      {!usaPiezas && fila.tipo === "talla" && (
        <div className="w-44">
          <Label className="text-xs mb-1 block">Talla</Label>
          <Select value={fila.talla} onValueChange={(v) => onChange(index, { ...fila, talla: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TALLAS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Piezas (London y futuros modelos por piezas) */}
      {usaPiezas && fila.tipo === "piezas" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Piezas por juego:
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
            {PIEZAS_LONDON.map(({ id, label }) => {
              const qty = fila.piezas[id] ?? 0;
              return (
                <div key={id} className="flex items-center justify-between gap-3 rounded-lg border border-border/50 px-3 py-1.5 sm:block sm:space-y-1 sm:border-0 sm:p-0">
                  <Label className="text-sm text-muted-foreground sm:text-xs">{label}</Label>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm" variant="outline" className="h-11 w-11 p-0 text-lg"
                      aria-label={`Quitar una pieza: ${label}`}
                      disabled={qty <= 0}
                      onClick={() => onChange(index, {
                        ...fila,
                        piezas: { ...fila.piezas, [id]: Math.max(0, qty - 1) },
                      })}
                    >−</Button>
                    <span className="w-8 text-center text-base font-semibold">{qty}</span>
                    <Button
                      size="sm" variant="outline" className="h-11 w-11 p-0 text-lg"
                      aria-label={`Añadir una pieza: ${label}`}
                      disabled={qty >= 3}
                      onClick={() => onChange(index, {
                        ...fila,
                        piezas: { ...fila.piezas, [id]: Math.min(3, qty + 1) },
                      })}
                    >+</Button>
                  </div>
                </div>
              );
            })}
          </div>
          {Object.values(fila.piezas).some(v => v > 0) && (() => {
            const porJuego = PIEZAS_LONDON.filter(({ id }) => fila.piezas[id] > 0);
            const piezasJuego = porJuego.reduce((s, { id }) => s + fila.piezas[id], 0);
            return (
              <p className="text-xs text-muted-foreground pt-2 border-t border-border/40">
                <span className="font-medium text-foreground">Por juego:</span>{" "}
                {porJuego.map(({ id }) => `${fila.piezas[id]}× ${id}`).join(" · ")}
                {" · "}
                <span className="font-medium text-foreground">
                  {piezasJuego} {piezasJuego === 1 ? "pieza" : "piezas"}
                </span>
                {fila.cantidad > 1 && (
                  <>
                    {" · "}{fila.cantidad} juegos ={" "}
                    <span className="font-medium text-foreground">{piezasJuego * fila.cantidad} piezas</span>
                  </>
                )}
              </p>
            );
          })()}
        </div>
      )}
    </div>
  );
}

function CalculadoraMrp() {
  const [filas, setFilas] = useState<FilaPedido[]>([
    { tipo: "piezas", modelo: "London", piezas: { "1 cuerpo": 1, "2 cuerpos": 1, "3 cuerpos": 1 }, cantidad: 1 },
  ]);
  const [resultado, setResultado] = useState<Awaited<ReturnType<typeof calcularMrp>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [fabricarOpen, setFabricarOpen] = useState(false);

  const addFila = () =>
    setFilas((f) => [...f, { tipo: "talla", modelo: "Vintage", talla: "6 pies", cantidad: 1 }]);

  const removeFila = (i: number) => setFilas((f) => f.filter((_, idx) => idx !== i));

  const updateFila = (i: number, fila: FilaPedido) =>
    setFilas((f) => f.map((row, idx) => (idx === i ? fila : row)));

  const puedeCalcular = filas.some((f) =>
    f.tipo === "piezas" ? Object.values(f.piezas).some((v) => v > 0) : true
  );

  const calcular = async () => {
    const pedidos = expandirPedidos(filas);
    if (pedidos.length === 0) {
      toast.error("Selecciona al menos 1 pieza para producir");
      return;
    }
    setLoading(true);
    try {
      const res = await calcularMrp({ pedidos });
      setResultado(res);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {filas.map((fila, i) => (
          <FilaModelo
            key={i} fila={fila} index={i} total={filas.length}
            onChange={updateFila} onRemove={removeFila}
          />
        ))}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={addFila}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Añadir modelo
        </Button>
        <Button onClick={calcular} disabled={loading || !puedeCalcular}>
          {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          <Calculator className="h-4 w-4 mr-2" /> Calcular
        </Button>
      </div>

      {resultado && (
        <div className="mt-4 space-y-2">
          {resultado.hayFaltantes ? (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              Hay insumos insuficientes para completar estos pedidos.
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              ✓ Stock suficiente para todos los pedidos.
            </div>
          )}
          <div className="border rounded-xl overflow-x-auto mt-2">
            <table className="hidden sm:table w-full text-sm">
              <thead className="bg-muted/40 border-b">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-xs text-muted-foreground">Insumo</th>
                  <th className="px-3 py-2 text-right font-medium text-xs text-muted-foreground">Necesario</th>
                  <th className="px-3 py-2 text-right font-medium text-xs text-muted-foreground">En stock</th>
                  <th className="px-3 py-2 text-right font-medium text-xs text-muted-foreground">Faltante</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {resultado.resultado.map((r) => (
                  <tr key={r.nombre} className={r.faltante > 0 ? "bg-red-50/50" : ""}>
                    <td className="px-3 py-2 font-medium">{r.nombre}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">{fmt(r.necesario, r.unidad)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{fmt(r.stock_actual, r.unidad)}</td>
                    <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                      {r.faltante > 0
                        ? <span className="text-red-600">{formatoFaltante(r.faltante, r.unidad)}</span>
                        : <span className="text-green-700">OK</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Móvil (< 640 px): tarjetas apiladas */}
            <TarjetasMovil>
              {resultado.resultado.map((r) => (
                <TarjetaFila
                  key={r.nombre}
                  tono={r.faltante > 0 ? "peligro" : "normal"}
                  titulo={r.nombre}
                  estado={
                    r.faltante > 0 ? (
                      <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700 text-center">
                        Faltan {fmt(r.faltante, r.unidad)}
                      </span>
                    ) : (
                      <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">OK</span>
                    )
                  }
                  datos={[
                    { etiqueta: "Necesario", valor: fmt(r.necesario, r.unidad) },
                    { etiqueta: "En stock", valor: fmt(r.stock_actual, r.unidad), destacado: true },
                  ]}
                />
              ))}
            </TarjetasMovil>
          </div>

          {/* Botón Fabricar */}
          <div className="flex justify-end pt-2">
            <Button
              className="gap-2 bg-[#4a2c1a] hover:bg-[#3a200f] text-white"
              onClick={() => setFabricarOpen(true)}
            >
              <Hammer className="h-4 w-4" />
              Fabricar
            </Button>
          </div>
        </div>
      )}

      {/* Modal Fabricar */}
      {fabricarOpen && resultado && (
        <FabricarDialog
          insumos={resultado.resultado}
          descripcion={filas.map((f) => {
            if (f.tipo === "piezas") {
              const piezas = PIEZAS_LONDON
                .filter(({ id }) => f.piezas[id] > 0)
                .map(({ id, label }) => `${f.piezas[id]}× ${label}`)
                .join(" + ");
              return `${f.modelo} (${piezas})${f.cantidad > 1 ? ` ×${f.cantidad}` : ""}`;
            }
            return `${f.modelo} ${f.talla} ×${f.cantidad}`;
          }).join(", ")}
          onClose={() => setFabricarOpen(false)}
          onDone={() => {
            setFabricarOpen(false);
            setResultado(null);
          }}
        />
      )}
    </div>
  );
}

// ── Modal movimiento de stock ─────────────────────────────────
function MovimientoDialog({ insumoId, insumoNombre, unidad, onDone, triggerClassName }: {
  insumoId: string; insumoNombre: string; unidad?: string; onDone: () => void; triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<"entrada" | "salida" | "ajuste">("entrada");
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");
  const [ubicacionId, setUbicacionId] = useState("");

  const { data: ubicData } = useQuery({
    queryKey: ["ubicaciones"],
    queryFn: listUbicaciones,
  });

  const mut = useMutation({
    mutationFn: () => registrarMovimiento({
      insumo_id: insumoId, tipo,
      cantidad: tipo === "ajuste" ? Number(cantidad) : Math.abs(Number(cantidad)),
      motivo: motivo || undefined,
      ubicacion_id: ubicacionId || undefined,
    }),
    onSuccess: () => {
      toast.success("Movimiento registrado");
      setOpen(false); setCantidad(""); setMotivo("");
      onDone();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className={triggerClassName}>
          <ArrowDown className="h-3.5 w-3.5 mr-1" /> Stock
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Registrar movimiento — {insumoNombre}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label className="text-xs">Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="entrada">Entrada (compra / recepción)</SelectItem>
                <SelectItem value="salida">Salida (producción / merma)</SelectItem>
                <SelectItem value="ajuste">Ajuste de inventario</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">
              Cantidad {tipo === "ajuste" ? "(+ para sumar, − para restar)" : ""}
            </Label>
            <Input
              className="mt-1" type="number"
              placeholder={tipo === "ajuste" ? "−5 o +10" : "0"}
              value={cantidad} onChange={(e) => setCantidad(limitarDecimales(e.target.value, unidad))}
            />
          </div>
          <div>
            <Label className="text-xs">Ubicación</Label>
            <Select value={ubicacionId} onValueChange={setUbicacionId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Almacén Central (por defecto)" /></SelectTrigger>
              <SelectContent>
                {(ubicData?.ubicaciones ?? []).map((u: any) => (
                  <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Motivo (opcional)</Label>
            <Input
              className="mt-1" placeholder="Compra proveedor, Pedido #123..."
              value={motivo} onChange={(e) => setMotivo(e.target.value)}
            />
          </div>
          <Button
            className="w-full"
            disabled={!cantidad || mut.isPending}
            onClick={() => mut.mutate()}
          >
            {mut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Registrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Modal editar / crear insumo ───────────────────────────────
function InsumoDialog({ insumo, onDone, triggerClassName }: { insumo?: any; onDone: () => void; triggerClassName?: string }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    id:           insumo?.id,
    nombre:       insumo?.nombre ?? "",
    unidad:       insumo?.unidad ?? "unidades",
    stock_minimo: insumo?.stock_minimo ?? 0,
    precio_unit:  insumo?.precio_unit ?? "",
    proveedor_id: insumo?.proveedor_id ?? null,
    proveedor:    insumo?.proveedor ?? null
  });

  // Añadir query de proveedores dentro del componente InsumoDialog
    const { data: provData } = useQuery({
    queryKey: ["proveedores"],
    queryFn: () => listProveedores({ activo: true }),
    });

  const mut = useMutation({
    mutationFn: () =>
    upsertInsumo({
        ...form,
        stock_minimo: Number(form.stock_minimo) || 0,
        precio_unit: form.precio_unit ? Number(form.precio_unit) : null,
        proveedor_id: form.proveedor_id || null,
    }),

    onSuccess: () => {
      toast.success(insumo ? "Insumo actualizado" : "Insumo creado");
      setOpen(false); onDone();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {insumo
          ? <Button size="sm" variant="ghost" className={triggerClassName}>Editar</Button>
          : <Button size="sm" className="h-11 sm:h-8"><Plus className="h-4 w-4 mr-1" /> Nuevo insumo</Button>
        }
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{insumo ? "Editar insumo" : "Nuevo insumo"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          {[
            { label: "Nombre", key: "nombre", placeholder: "Ej: Tela" },
            { label: "Stock mínimo", key: "stock_minimo", placeholder: "0", type: "number" },
            { label: "Precio unit. (S/)", key: "precio_unit", placeholder: "0.00", type: "number" },
            { label: "Proveedor", key: "proveedor", placeholder: "Nombre del proveedor" },
          ].map(({ label, key, placeholder, type }) => (
            <div key={key}>
              <Label className="text-xs">{label}</Label>
              <Input
                className="mt-1" type={type ?? "text"}
                placeholder={placeholder}
                value={(form as any)[key]}
                onChange={(e) => setForm((f) => ({
                  ...f,
                  [key]: key === "stock_minimo" ? limitarDecimales(e.target.value, f.unidad) : e.target.value,
                }))}
              />
            </div>
          ))}
          <div>
            <Label className="text-xs">Unidad</Label>
            <Select value={form.unidad} onValueChange={(v) => setForm((f) => ({ ...f, unidad: v }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
              {UNIDADES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              {/* Mostrar la unidad actual si no está en la lista */}
              {form.unidad && !UNIDADES.includes(form.unidad) && (
                <SelectItem value={form.unidad}>{form.unidad} (actual)</SelectItem>
              )}
            </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Proveedor</Label>
            <Select
                value={form.proveedor_id ?? "none"}
                onValueChange={(v) =>
                setForm((f) => ({ ...f, proveedor_id: v === "none" ? null : v }))
                }
            >
                <SelectTrigger className="mt-1">
                <SelectValue placeholder="Seleccionar proveedor" />
                </SelectTrigger>

                <SelectContent>
                <SelectItem value="none">Sin proveedor</SelectItem>

                {(provData?.proveedores ?? []).map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                    {p.nombre}
                    </SelectItem>
                ))}
                </SelectContent>
            </Select>
            </div>

          
            <Button
            className="w-full"
            disabled={!form.nombre || mut.isPending}
            onClick={() => mut.mutate()}
            >
            {mut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {insumo ? "Guardar" : "Crear"}
            </Button>

        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Página principal ──────────────────────────────────────────
function InsumosPage() {
  const qc = useQueryClient();
  const [busqueda, setBusqueda] = useState("");
  const [tab, setTab] = useState("stock");

  const { data: insumosData, isLoading } = useQuery({
    queryKey: ["insumos"],
    queryFn: listInsumos,
  });

  const { data: alertasData } = useQuery({
    queryKey: ["insumos-alertas"],
    queryFn: getStockBajo,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["insumos"] });
    qc.invalidateQueries({ queryKey: ["insumos-alertas"] });
  };

  const filtrados = useMemo(() => {
    const list = insumosData?.insumos ?? [];
    const visibles = !busqueda.trim()
      ? list
      : list.filter((i: any) => i.nombre.toLowerCase().includes(busqueda.toLowerCase()));
    return ordenarPorUrgencia(visibles);
  }, [insumosData, busqueda]);

  const alertaCount = alertasData?.alertas?.length ?? 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-display font-semibold">Insumos MRP</h1>
        <p className="text-muted-foreground mt-0.5">Control de materiales y lista de insumos por modelo</p>
      </div>

      {alertaCount > 0 && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-500" />
          <span>
            <strong>{alertaCount} insumo{alertaCount > 1 ? "s" : ""}</strong> por debajo del stock mínimo:{" "}
            {alertasData!.alertas.slice(0, 3).map((a: any) => a.nombre).join(", ")}
            {alertaCount > 3 ? ` y ${alertaCount - 3} más.` : "."}
          </span>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="stock" className="gap-1.5">
            <Package className="h-4 w-4" /> Stock
            {alertaCount > 0 && (
              <span className="ml-1 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
                {alertaCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="mrp">
            <Calculator className="h-4 w-4 mr-1.5" /> Calcular MRP
          </TabsTrigger>
        </TabsList>

        {/* Tab: Stock */}
        <TabsContent value="stock" className="space-y-4 mt-4">
          <div className="flex gap-3">
            <Input
              className="flex-1"
              placeholder="Buscar insumo…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            <InsumoDialog onDone={refresh} />
          </div>

          <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
            {isLoading ? (
              <TableSkeleton rows={6} cols={6} bare />
            ) : filtrados.length === 0 ? (
              busqueda.trim() ? (
                <EmptyState
                  icon={Package}
                  title="Ningún insumo coincide"
                  action={<Button variant="outline" size="sm" onClick={() => setBusqueda("")}>Limpiar búsqueda</Button>}
                />
              ) : (
                <EmptyState
                  icon={Package}
                  title="Aún no hay insumos"
                  description="Registra madera, herrajes y demás materiales para controlar el stock y calcular materiales por pedido."
                />
              )
            ) : (
              <div className="overflow-x-auto">
                <table className="hidden sm:table w-full text-sm">
                  <thead className="bg-muted/40 border-b">
                    <tr>
                      {["Insumo", "Unidad", "Stock actual", "Stock mínimo", "Estado", "Proveedor", ""].map((h) => (
                        <th key={h} className="px-4 py-3 text-left font-medium text-xs text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {filtrados.map((ins: any) => {
                      const est = estadoStock(ins.stock_actual, ins.stock_minimo);
                      const cfg = ESTADO_STOCK[est];
                      return (
                        <tr key={ins.id} className={cfg.fila}>
                          <td className="px-4 py-3 font-medium">{ins.nombre}</td>
                          <td className="px-4 py-3 text-muted-foreground">{ins.unidad}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`font-semibold ${cfg.texto}`}>
                              {fmt(ins.stock_actual, ins.unidad)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                            {fmt(ins.stock_minimo, ins.unidad)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.badge}`}>
                              {faltaStock(est) && <AlertTriangle className="h-3 w-3" />} {cfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">
                            {ins.proveedor ?? "—"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1.5">
                              <MovimientoDialog
                                insumoId={ins.id}
                                insumoNombre={ins.nombre}
                                unidad={ins.unidad}
                                onDone={refresh}
                              />
                              <InsumoDialog insumo={ins} onDone={refresh} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Móvil (< 640 px): tarjetas apiladas */}
                <TarjetasMovil>
                  {filtrados.map((ins: any) => {
                    const est = estadoStock(ins.stock_actual, ins.stock_minimo);
                    const cfg = ESTADO_STOCK[est];
                    const faltan = Math.max(0, Number(ins.stock_minimo) - Number(ins.stock_actual));
                    return (
                      <TarjetaFila
                        key={ins.id}
                        tono={faltaStock(est) ? "peligro" : "normal"}
                        titulo={ins.nombre}
                        estado={
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.badge}`}>
                            {faltaStock(est) && <AlertTriangle className="h-3 w-3" />} {cfg.label}
                          </span>
                        }
                        datos={[
                          {
                            etiqueta: "Stock actual",
                            destacado: true,
                            valor: <span className={cfg.texto}>{fmt(ins.stock_actual, ins.unidad)}</span>,
                          },
                          { etiqueta: "Stock mínimo", valor: fmt(ins.stock_minimo, ins.unidad) },
                          ...(faltan > 0
                            ? [{ etiqueta: "Faltan", valor: <span className="text-red-600">{fmt(faltan, ins.unidad)}</span> }]
                            : []),
                          ...(ins.proveedor ? [{ etiqueta: "Proveedor", completo: true, valor: ins.proveedor }] : []),
                        ]}
                        acciones={
                          <>
                            <MovimientoDialog
                              insumoId={ins.id}
                              insumoNombre={ins.nombre}
                              unidad={ins.unidad}
                              onDone={refresh}
                              triggerClassName={`${BTN_TACTIL} flex-1`}
                            />
                            <InsumoDialog insumo={ins} onDone={refresh} triggerClassName={`${BTN_TACTIL} flex-1 border`} />
                          </>
                        }
                      />
                    );
                  })}
                </TarjetasMovil>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab: Calculadora MRP */}
        <TabsContent value="mrp" className="mt-4">
          <div className="bg-card border border-border/50 rounded-xl p-5">
            <h3 className="font-semibold mb-1">Calculadora de insumos</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Selecciona los modelos y cantidades a producir. El sistema calcula qué insumos necesitas
              y si el stock actual es suficiente.
            </p>
            <CalculadoraMrp />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}