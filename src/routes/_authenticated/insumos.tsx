import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listInsumos, upsertInsumo, registrarMovimiento,
  getBom, calcularMrp, getStockBajo,
  listProveedores,
} from "@/lib/pos.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { Loader2, AlertTriangle, Plus, ArrowDown, ArrowUp, Calculator, Package } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/insumos")({
  head: () => ({ meta: [{ title: "Insumos MRP — G&M" }] }),
  component: InsumosPage,
});

const MODELOS = ["Vintage", "Rex", "Lineal Punta", "London", "Garra"] as const;
const TALLAS  = ["2 pies", "2.5 pies", "3 pies", "3.5 pies", "4 pies", "5 pies", "6 pies"] as const;
const UNIDADES = ["metros", "kg", "litros", "unidades", "planchas", "piezas", "paquetes", "palos", "pies", "bolsas"];

const fmt = (n: number, u: string) => `${n % 1 === 0 ? n : n.toFixed(2)} ${u}`;

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
            type="number" min={1} value={fila.cantidad}
            onChange={(e) => onChange(index, { ...fila, cantidad: Math.max(1, Number(e.target.value)) })}
          />
        </div>
        {total > 1 && (
          <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => onRemove(index)}>✕</Button>
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
            Piezas por juego{fila.cantidad > 1 ? ` (×${fila.cantidad} juegos)` : ""}:
          </p>
          <div className="grid grid-cols-3 gap-3">
            {PIEZAS_LONDON.map(({ id, label }) => {
              const qty = fila.piezas[id] ?? 0;
              return (
                <div key={id} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{label}</Label>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm" variant="outline" className="h-7 w-7 p-0"
                      disabled={qty <= 0}
                      onClick={() => onChange(index, {
                        ...fila,
                        piezas: { ...fila.piezas, [id]: Math.max(0, qty - 1) },
                      })}
                    >−</Button>
                    <span className="w-6 text-center text-sm font-semibold">{qty}</span>
                    <Button
                      size="sm" variant="outline" className="h-7 w-7 p-0"
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
          {Object.values(fila.piezas).some(v => v > 0) && (
            <p className="text-xs text-muted-foreground pt-1 border-t border-border/40">
              {PIEZAS_LONDON
                .filter(({ id }) => fila.piezas[id] > 0)
                .map(({ id, label }) => `${fila.piezas[id]}× ${label}`)
                .join(" + ")}
              {fila.cantidad > 1 ? ` (×${fila.cantidad} juegos)` : ""}
            </p>
          )}
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
          <div className="border rounded-xl overflow-hidden mt-2">
            <table className="w-full text-sm">
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
                    <td className="px-3 py-2 text-right text-muted-foreground">{fmt(r.necesario, r.unidad)}</td>
                    <td className="px-3 py-2 text-right">{fmt(r.stock_actual, r.unidad)}</td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {r.faltante > 0
                        ? <span className="text-red-600">−{fmt(r.faltante, r.unidad)}</span>
                        : <span className="text-green-600">OK</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Modal movimiento de stock ─────────────────────────────────
function MovimientoDialog({ insumoId, insumoNombre, onDone }: {
  insumoId: string; insumoNombre: string; onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<"entrada" | "salida" | "ajuste">("entrada");
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");

  const mut = useMutation({
    mutationFn: () => registrarMovimiento({
      insumo_id: insumoId, tipo,
      cantidad: tipo === "ajuste" ? Number(cantidad) : Math.abs(Number(cantidad)),
      motivo: motivo || undefined,
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
        <Button size="sm" variant="outline">
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
              value={cantidad} onChange={(e) => setCantidad(e.target.value)}
            />
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
function InsumoDialog({ insumo, onDone }: { insumo?: any; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    id:           insumo?.id,
    nombre:       insumo?.nombre ?? "",
    unidad:       insumo?.unidad ?? "unidades",
    stock_minimo: insumo?.stock_minimo ?? 0,
    precio_unit:  insumo?.precio_unit ?? "",
    proveedor_id: insumo?.proveedor_id ?? "",
    proveedor:    insumo?.proveedor ?? ""
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
          ? <Button size="sm" variant="ghost">Editar</Button>
          : <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nuevo insumo</Button>
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
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              />
            </div>
          ))}
          <div>
            <Label className="text-xs">Unidad</Label>
            <Select value={form.unidad} onValueChange={(v) => setForm((f) => ({ ...f, unidad: v }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {UNIDADES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Proveedor</Label>
            <Select
                value={form.proveedor_id ?? ""}
                onValueChange={(v) =>
                setForm((f) => ({ ...f, proveedor_id: v || null }))
                }
            >
                <SelectTrigger className="mt-1">
                <SelectValue placeholder="Seleccionar proveedor" />
                </SelectTrigger>

                <SelectContent>
                <SelectItem value="">Sin proveedor</SelectItem>

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
    if (!busqueda.trim()) return list;
    return list.filter((i: any) =>
      i.nombre.toLowerCase().includes(busqueda.toLowerCase())
    );
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
              <div className="flex justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filtrados.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">Sin insumos.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 border-b">
                    <tr>
                      {["Insumo", "Unidad", "Stock actual", "Stock mínimo", "Proveedor", ""].map((h) => (
                        <th key={h} className="px-4 py-3 text-left font-medium text-xs text-muted-foreground uppercase tracking-wide">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {filtrados.map((ins: any) => {
                      const bajo = ins.stock_actual < ins.stock_minimo;
                      return (
                        <tr key={ins.id} className={bajo ? "bg-amber-50/40" : "hover:bg-muted/20"}>
                          <td className="px-4 py-3 font-medium">
                            {ins.nombre}
                            {bajo && (
                              <AlertTriangle className="inline h-3.5 w-3.5 text-amber-500 ml-1.5" />
                            )}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{ins.unidad}</td>
                          <td className="px-4 py-3">
                            <span className={`font-semibold ${bajo ? "text-amber-600" : "text-foreground"}`}>
                              {ins.stock_actual} {ins.unidad}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {ins.stock_minimo} {ins.unidad}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">
                            {ins.proveedor ?? "—"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1.5">
                              <MovimientoDialog
                                insumoId={ins.id}
                                insumoNombre={ins.nombre}
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