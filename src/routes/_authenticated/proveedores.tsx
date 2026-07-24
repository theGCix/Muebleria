import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listProveedores, upsertProveedor, getProveedor,
  listOrdenes, crearOrdenCompra, actualizarStatusOrden, recibirOrdenCompra,
  listUbicaciones,
} from "@/lib/pos.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Loader2, Plus, Eye, Truck, ShoppingCart,
  Phone, Mail, MessageCircle, Package, Building2,
  CheckCircle2, XCircle, Send, RefreshCw, Trash2,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/proveedores")({
  head: () => ({ meta: [{ title: "Proveedores — G&M" }] }),
  component: ProveedoresPage,
});

// ── Config visual ────────────────────────────────────────────
const TIPO_CONFIG = {
  insumo:   { label: "Insumos",            color: "#1e40af", bg: "#dbeafe" },
  producto: { label: "Productos",          color: "#065f46", bg: "#d1fae5" },
  ambos:    { label: "Insumos + Productos", color: "#6d28d9", bg: "#ede9fe" },
} as const;

const OC_STATUS_CONFIG = {
  borrador:   { label: "Borrador",    color: "#6b7280", bg: "#f3f4f6", icon: Package },
  enviada:    { label: "Enviada",     color: "#92400e", bg: "#fef3c7", icon: Send },
  confirmada: { label: "Confirmada",  color: "#1e40af", bg: "#dbeafe", icon: CheckCircle2 },
  parcial:    { label: "Recepción parcial", color: "#5b21b6", bg: "#ede9fe", icon: Truck },
  recibida:   { label: "Recibida",    color: "#14532d", bg: "#dcfce7", icon: CheckCircle2 },
  cancelada:  { label: "Cancelada",   color: "#7f1d1d", bg: "#fee2e2", icon: XCircle },
} as const;

type OcStatus = keyof typeof OC_STATUS_CONFIG;
type ProvTipo = keyof typeof TIPO_CONFIG;

const fmt     = (n: number) => new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n);
const fmtDay  = (d: string | null) => d ? format(new Date(d), "dd MMM yyyy", { locale: es }) : "—";
const UNIDADES = ["metros", "kg", "litros", "unidades", "planchas", "piezas", "paquetes", "palos", "pies", "bolsas"];

// ── Form proveedor ───────────────────────────────────────────
const EMPTY_PROV = () => ({
  nombre: "", ruc: "", tipo: "insumo" as ProvTipo,
  contacto_nombre: "", telefono: "", email: "", whatsapp: "",
  direccion: "", distrito: "",
  plazo_entrega_dias: 7, credito_dias: 0, notas: "",
});

function ProveedorForm({ initial, onClose }: { initial?: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(initial ? {
    ...EMPTY_PROV(), ...initial,
    plazo_entrega_dias: initial.plazo_entrega_dias ?? 7,
    credito_dias: initial.credito_dias ?? 0,
  } : EMPTY_PROV());

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f: any) => ({ ...f, [k]: e.target.value }));

  const mut = useMutation({
    mutationFn: () => upsertProveedor({ ...form, id: initial?.id }),
    onSuccess: () => {
      toast.success(initial ? "Proveedor actualizado" : "Proveedor creado");
      qc.invalidateQueries({ queryKey: ["proveedores"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            {initial ? "Editar proveedor" : "Nuevo proveedor"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">Nombre *</Label>
              <Input className="mt-1" value={form.nombre} onChange={set("nombre")} placeholder="Ej: Textiles Peruanos SAC" />
            </div>
            <div>
              <Label className="text-xs">RUC</Label>
              <Input className="mt-1" value={form.ruc} onChange={set("ruc")} placeholder="20XXXXXXXXX" maxLength={11} />
            </div>
            <div>
              <Label className="text-xs">Tipo *</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm((f: any) => ({ ...f, tipo: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="insumo">Proveedor de insumos</SelectItem>
                  <SelectItem value="producto">Fabricante de productos</SelectItem>
                  <SelectItem value="ambos">Ambos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border-t pt-3 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Contacto</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { k: "contacto_nombre", label: "Nombre contacto", placeholder: "Juan Pérez" },
                { k: "telefono",        label: "Teléfono",        placeholder: "+51 999 999 999" },
                { k: "email",           label: "Email",           placeholder: "ventas@proveedor.com" },
                { k: "whatsapp",        label: "WhatsApp",        placeholder: "+51 999 999 999" },
              ].map(({ k, label, placeholder }) => (
                <div key={k}>
                  <Label className="text-xs">{label}</Label>
                  <Input className="mt-1" value={(form as any)[k]} onChange={set(k)} placeholder={placeholder} />
                </div>
              ))}
              <div className="col-span-2">
                <Label className="text-xs">Dirección</Label>
                <Input className="mt-1" value={form.direccion} onChange={set("direccion")} placeholder="Av. Principal 123" />
              </div>
              <div>
                <Label className="text-xs">Distrito</Label>
                <Input className="mt-1" value={form.distrito} onChange={set("distrito")} placeholder="San Juan de Lurigancho" />
              </div>
            </div>
          </div>

          <div className="border-t pt-3 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Condiciones</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Plazo entrega (días)</Label>
                <Input className="mt-1" type="number" min={0} value={form.plazo_entrega_dias}
                  onChange={(e) => setForm((f: any) => ({ ...f, plazo_entrega_dias: Number(e.target.value) }))} />
              </div>
              <div>
                <Label className="text-xs">Crédito (días, 0 = contado)</Label>
                <Input className="mt-1" type="number" min={0} value={form.credito_dias}
                  onChange={(e) => setForm((f: any) => ({ ...f, credito_dias: Number(e.target.value) }))} />
              </div>
            </div>
          </div>

          <div>
            <Label className="text-xs">Notas internas</Label>
            <Textarea className="mt-1 text-sm" rows={2} value={form.notas} onChange={set("notas")}
              placeholder="Condiciones especiales, historial de relación, etc." />
          </div>

          <Button className="w-full" disabled={!form.nombre || mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {initial ? "Guardar cambios" : "Crear proveedor"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Detalle del proveedor con OC ─────────────────────────────
function ProveedorDetalle({ proveedorId, onClose }: { proveedorId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState("info");
  const [editOpen, setEditOpen] = useState(false);
  const [ocOpen, setOcOpen] = useState(false);

  const { data: provData, isLoading } = useQuery({
    queryKey: ["proveedor", proveedorId],
    queryFn: () => getProveedor({ id: proveedorId }),
  });

  const { data: ocData } = useQuery({
    queryKey: ["ordenes", proveedorId],
    queryFn: () => listOrdenes({ proveedor_id: proveedorId }),
  });

  const recibirMut = useMutation({
    mutationFn: (id: string) => recibirOrdenCompra({ id }),
    onSuccess: () => {
      toast.success("Stock actualizado — insumos ingresados");
      qc.invalidateQueries({ queryKey: ["ordenes", proveedorId] });
      qc.invalidateQueries({ queryKey: ["insumos"] });
      qc.invalidateQueries({ queryKey: ["insumos-alertas"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: any }) => actualizarStatusOrden({ id, status }),
    onSuccess: () => {
      toast.success("Estado actualizado");
      qc.invalidateQueries({ queryKey: ["ordenes", proveedorId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const p = provData?.proveedor;
  const ordenes = ocData?.ordenes ?? [];
  const tipo = TIPO_CONFIG[p?.tipo as ProvTipo] ?? TIPO_CONFIG.insumo;

  return (
    <>
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {isLoading ? "Cargando..." : p?.nombre}
            </DialogTitle>
          </DialogHeader>

          {isLoading || !p ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : (
            <div className="space-y-4 mt-1">
              {/* Header info */}
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium"
                    style={{ color: tipo.color, background: tipo.bg }}>{tipo.label}</span>
                  {p.ruc && <p className="text-sm text-muted-foreground">RUC: {p.ruc}</p>}
                </div>
                <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>Editar</Button>
              </div>

              <Tabs value={tab} onValueChange={setTab}>
                <TabsList>
                  <TabsTrigger value="info">Información</TabsTrigger>
                  <TabsTrigger value="ordenes">
                    Órdenes de compra
                    {ordenes.filter((o: any) => o.status === "enviada").length > 0 && (
                      <span className="ml-1.5 bg-amber-500 text-white text-xs rounded-full px-1.5 leading-none py-0.5">
                        {ordenes.filter((o: any) => o.status === "enviada").length}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="materiales">Materiales</TabsTrigger>
                </TabsList>

                {/* Tab: Información */}
                <TabsContent value="info" className="mt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {[
                      ["Contacto",      p.contacto_nombre],
                      ["Teléfono",      p.telefono],
                      ["Email",         p.email],
                      ["WhatsApp",      p.whatsapp],
                      ["Dirección",     p.direccion],
                      ["Distrito",      p.distrito],
                      ["Plazo entrega", p.plazo_entrega_dias ? `${p.plazo_entrega_dias} días` : null],
                      ["Crédito",       p.credito_dias ? `${p.credito_dias} días` : "Contado"],
                    ].map(([label, value]) => value ? (
                      <div key={label as string} className="bg-muted/30 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                        <p className="font-medium">{value}</p>
                      </div>
                    ) : null)}
                  </div>

                  {/* Acciones de contacto rápido */}
                  <div className="flex gap-2 flex-wrap pt-1">
                    {p.telefono && (
                      <a href={`tel:${p.telefono}`}>
                        <Button size="sm" variant="outline">
                          <Phone className="h-3.5 w-3.5 mr-1" /> Llamar
                        </Button>
                      </a>
                    )}
                    {p.whatsapp && (
                      <a href={`https://wa.me/${p.whatsapp?.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="outline">
                          <MessageCircle className="h-3.5 w-3.5 mr-1" /> WhatsApp
                        </Button>
                      </a>
                    )}
                    {p.email && (
                      <a href={`mailto:${p.email}`}>
                        <Button size="sm" variant="outline">
                          <Mail className="h-3.5 w-3.5 mr-1" /> Email
                        </Button>
                      </a>
                    )}
                  </div>

                  {p.notas && (
                    <div className="bg-muted/30 rounded-lg p-3 text-sm text-muted-foreground">
                      <p className="text-xs font-medium mb-1">Notas</p>
                      <p className="whitespace-pre-line">{p.notas}</p>
                    </div>
                  )}
                </TabsContent>

                {/* Tab: Órdenes de compra */}
                <TabsContent value="ordenes" className="mt-4 space-y-3">
                  <div className="flex justify-end">
                    <Button size="sm" onClick={() => setOcOpen(true)}>
                      <Plus className="h-4 w-4 mr-1" /> Nueva orden de compra
                    </Button>
                  </div>

                  {ordenes.length === 0 ? (
                    <p className="text-center py-8 text-sm text-muted-foreground">Sin órdenes de compra</p>
                  ) : (
                    <div className="space-y-2">
                      {ordenes.map((oc: any) => {
                        const st = OC_STATUS_CONFIG[oc.status as OcStatus];
                        const Icon = st?.icon ?? Package;
                        return (
                          <div key={oc.id} className="border rounded-xl p-4 space-y-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-mono font-semibold text-sm">{oc.numero}</p>
                                <p className="text-xs text-muted-foreground">
                                  {fmtDay(oc.fecha_emision)}
                                  {oc.fecha_esperada && ` · Esperada: ${fmtDay(oc.fecha_esperada)}`}
                                </p>
                              </div>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                                style={{ color: st?.color, background: st?.bg }}>
                                <Icon className="h-3 w-3" />{st?.label}
                              </span>
                            </div>

                            {/* Ítems */}
                            <div className="space-y-1">
                              {(oc.orden_compra_items ?? []).map((item: any) => (
                                <div key={item.id} className="flex justify-between text-sm text-muted-foreground">
                                  <span>{item.descripcion} × {item.cantidad}</span>
                                  <span>{fmt(Number(item.subtotal))}</span>
                                </div>
                              ))}
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t">
                              <span className="font-semibold">{fmt(Number(oc.total))}</span>
                              <div className="flex gap-2">
                                {oc.status === "borrador" && (
                                  <Button size="sm" variant="outline"
                                    onClick={() => statusMut.mutate({ id: oc.id, status: "enviada" })}
                                    disabled={statusMut.isPending}>
                                    <Send className="h-3.5 w-3.5 mr-1" /> Enviar al proveedor
                                  </Button>
                                )}
                                {(oc.status === "enviada" || oc.status === "confirmada") && (
                                  <Button size="sm"
                                    onClick={() => recibirMut.mutate(oc.id)}
                                    disabled={recibirMut.isPending}>
                                    {recibirMut.isPending
                                      ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                                      : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
                                    Confirmar recepción
                                  </Button>
                                )}
                                {oc.status === "borrador" && (
                                  <Button size="sm" variant="ghost"
                                    onClick={() => statusMut.mutate({ id: oc.id, status: "cancelada" })}>
                                    <XCircle className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>

                {/* Tab: Materiales vinculados */}
                <TabsContent value="materiales" className="mt-4 space-y-4">
                  {(p.insumos ?? []).length > 0 && (
                    <section>
                      <h4 className="text-sm font-semibold mb-2">Insumos</h4>
                      <div className="space-y-1.5">
                        {p.insumos.map((i: any) => (
                          <div key={i.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 text-sm">
                            <span className="font-medium">{i.nombre}</span>
                            <span className="text-muted-foreground text-xs">{i.stock_actual} {i.unidad}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                  {(p.products ?? []).length > 0 && (
                    <section>
                      <h4 className="text-sm font-semibold mb-2">Productos</h4>
                      <div className="space-y-1.5">
                        {p.products.map((pr: any) => (
                          <div key={pr.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 text-sm">
                            <span className="font-medium">{pr.nombre}</span>
                            <span className="text-muted-foreground text-xs">{fmt(Number(pr.precio))}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                  {(p.insumos ?? []).length === 0 && (p.products ?? []).length === 0 && (
                    <p className="text-center py-8 text-sm text-muted-foreground">
                      Sin materiales vinculados. Vincula insumos o productos desde sus respectivos paneles.
                    </p>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {editOpen && p && (
        <ProveedorForm initial={p} onClose={() => { setEditOpen(false); qc.invalidateQueries({ queryKey: ["proveedor", proveedorId] }); }} />
      )}
      {ocOpen && (
        <NuevaOrdenDialog proveedorId={proveedorId} onClose={() => { setOcOpen(false); qc.invalidateQueries({ queryKey: ["ordenes", proveedorId] }); }} />
      )}
    </>
  );
}

// ── Dialog nueva orden de compra ─────────────────────────────
function NuevaOrdenDialog({ proveedorId, onClose }: { proveedorId: string; onClose: () => void }) {
  const [fechaEsperada, setFechaEsperada] = useState("");
  const [notas, setNotas] = useState("");
  const [destinoId, setDestinoId] = useState("");
  const [items, setItems] = useState([
    { descripcion: "", unidad: "unidades", cantidad: 1, precio_unit: 0 },
  ]);

  const { data: ubicData } = useQuery({
    queryKey: ["ubicaciones"],
    queryFn: listUbicaciones,
  });

  const addItem = () => setItems((it) => [...it, { descripcion: "", unidad: "unidades", cantidad: 1, precio_unit: 0 }]);
  const removeItem = (i: number) => setItems((it) => it.filter((_, idx) => idx !== i));
  const updateItem = (i: number, k: string, v: string | number) =>
    setItems((it) => it.map((row, idx) => idx === i ? { ...row, [k]: v } : row));

  const total = items.reduce((s, it) => s + it.cantidad * it.precio_unit, 0);

  const mut = useMutation({
    mutationFn: () => crearOrdenCompra({
      proveedor_id: proveedorId,
      fecha_esperada: fechaEsperada || null,
      notas: notas || null,
      destino_ubicacion_id: destinoId || null,
      items,
    }),
    onSuccess: () => { toast.success("Orden de compra creada"); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display">Nueva orden de compra</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Fecha esperada de entrega</Label>
              <Input className="mt-1" type="date" value={fechaEsperada} onChange={(e) => setFechaEsperada(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Destino (taller / almacén)</Label>
              <Select value={destinoId} onValueChange={setDestinoId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Almacén Central (por defecto)" /></SelectTrigger>
                <SelectContent>
                  {(ubicData?.ubicaciones ?? []).map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Notas para el proveedor</Label>
            <Input className="mt-1" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Instrucciones, referencias..." />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium">Ítems *</p>
              <Button size="sm" variant="ghost" onClick={addItem}><Plus className="h-3.5 w-3.5 mr-1" /> Añadir</Button>
            </div>
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-12 gap-1.5 items-end">
                <div className="col-span-4">
                  {i === 0 && <Label className="text-xs mb-1 block">Descripción</Label>}
                  <Input placeholder="Tela metro lineal..." value={item.descripcion}
                    onChange={(e) => updateItem(i, "descripcion", e.target.value)} />
                </div>
                <div className="col-span-2">
                  {i === 0 && <Label className="text-xs mb-1 block">Unidad</Label>}
                  <Select value={item.unidad} onValueChange={(v) => updateItem(i, "unidad", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UNIDADES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  {i === 0 && <Label className="text-xs mb-1 block">Cantidad</Label>}
                  <Input type="number" min={0} value={item.cantidad}
                    onChange={(e) => updateItem(i, "cantidad", Number(e.target.value))} />
                </div>
                <div className="col-span-2">
                  {i === 0 && <Label className="text-xs mb-1 block">P. Unit (S/)</Label>}
                  <Input type="number" min={0} step="0.01" value={item.precio_unit}
                    onChange={(e) => updateItem(i, "precio_unit", Number(e.target.value))} />
                </div>
                <div className="col-span-1">
                  {i === 0 && <Label className="text-xs mb-1 block">Sub.</Label>}
                  <p className="text-xs text-muted-foreground py-2.5 text-right">
                    {fmt(item.cantidad * item.precio_unit)}
                  </p>
                </div>
                <div className="col-span-1 flex justify-end">
                  {items.length > 1 && (
                    <Button size="sm" variant="ghost" onClick={() => removeItem(i)}>
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  )}
                </div>
              </div>
            ))}

            <div className="flex justify-end pt-2 border-t text-sm font-semibold">
              Total estimado: {fmt(total)} + IGV ({fmt(total * 0.18)}) = {fmt(total * 1.18)}
            </div>
          </div>

          <Button className="w-full"
            disabled={items.some((it) => !it.descripcion) || mut.isPending}
            onClick={() => mut.mutate()}>
            {mut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Crear orden de compra (borrador)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Página principal ─────────────────────────────────────────
function ProveedoresPage() {
  const [busqueda, setBusqueda] = useState("");
  const [tipoFilter, setTipoFilter] = useState("todos");
  const [formOpen, setFormOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["proveedores"],
    queryFn: () => listProveedores({ activo: true }),
  });

  const proveedores = data?.proveedores ?? [];

  const filtrados = useMemo(() => {
    return proveedores.filter((p: any) => {
      const matchTipo = tipoFilter === "todos" || p.tipo === tipoFilter;
      const q = busqueda.toLowerCase();
      const matchQ = !q || p.nombre.toLowerCase().includes(q) ||
        (p.ruc ?? "").includes(q) || (p.contacto_nombre ?? "").toLowerCase().includes(q);
      return matchTipo && matchQ;
    });
  }, [proveedores, busqueda, tipoFilter]);

  const stats = useMemo(() => ({
    total:    proveedores.length,
    insumo:   proveedores.filter((p: any) => p.tipo === "insumo" || p.tipo === "ambos").length,
    producto: proveedores.filter((p: any) => p.tipo === "producto" || p.tipo === "ambos").length,
    oc_pend:  proveedores.reduce((s: number, p: any) => s + (p.oc_pendientes ?? 0), 0),
  }), [proveedores]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold">Proveedores y Fabricantes</h1>
          <p className="text-muted-foreground mt-0.5">Directorio y órdenes de compra</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" /> Actualizar
          </Button>
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nuevo proveedor
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total",          value: stats.total },
          { label: "Proveen insumos", value: stats.insumo },
          { label: "Fabricantes",    value: stats.producto },
          { label: "OC pendientes",  value: stats.oc_pend },
        ].map(({ label, value }) => (
          <div key={label} className={`border rounded-xl p-4 ${label === "OC pendientes" && value > 0 ? "bg-amber-50 border-amber-200" : "bg-card border-border/50"}`}>
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className="font-display text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Input placeholder="Buscar por nombre, RUC o contacto…"
            value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
        <Select value={tipoFilter} onValueChange={setTipoFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los tipos</SelectItem>
            <SelectItem value="insumo">Proveedores de insumos</SelectItem>
            <SelectItem value="producto">Fabricantes</SelectItem>
            <SelectItem value="ambos">Ambos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabla */}
      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <Truck className="h-10 w-10" />
          <p className="text-sm">No hay proveedores registrados</p>
          <Button size="sm" onClick={() => setFormOpen(true)}><Plus className="h-4 w-4 mr-1" /> Añadir el primero</Button>
        </div>
      ) : (
        <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/40">
                  {["Proveedor", "Tipo", "Contacto", "Plazo", "Insumos", "OC pendientes", "Total comprado", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium text-xs text-muted-foreground uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filtrados.map((p: any) => {
                  const tipo = TIPO_CONFIG[p.tipo as ProvTipo];
                  return (
                    <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium">{p.nombre}</p>
                        {p.ruc && <p className="text-xs text-muted-foreground font-mono">RUC {p.ruc}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ color: tipo?.color, background: tipo?.bg }}>{tipo?.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        {p.contacto_nombre && <p className="text-sm">{p.contacto_nombre}</p>}
                        {p.telefono && <p className="text-xs text-muted-foreground">{p.telefono}</p>}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {p.plazo_entrega_dias ? `${p.plazo_entrega_dias}d` : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-center">{p.total_insumos ?? 0}</td>
                      <td className="px-4 py-3 text-center">
                        {(p.oc_pendientes ?? 0) > 0
                          ? <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs font-medium">{p.oc_pendientes}</span>
                          : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {Number(p.total_comprado) > 0 ? fmt(Number(p.total_comprado)) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedId(p.id)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {formOpen && <ProveedorForm onClose={() => setFormOpen(false)} />}
      {selectedId && <ProveedorDetalle proveedorId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}