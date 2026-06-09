import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listProveedores, upsertProveedor, getProveedor,
  listOrdenes, crearOrdenCompra, actualizarStatusOrden, recibirOrdenCompra,
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

  const set = (k: string) => (e: React.ChangeEvent) =>
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
    
      
        
          
            {initial ? "Editar proveedor" : "Nuevo proveedor"}
          
        
        
          
            
              Nombre *
              <Input className="mt-1" value={form.nombre} onChange={set("nombre")} placeholder="Ej: Textiles Peruanos SAC" />
            
            
              RUC
              <Input className="mt-1" value={form.ruc} onChange={set("ruc")} placeholder="20XXXXXXXXX" maxLength={11} />
            
            
              Tipo *
              <Select value={form.tipo} onValueChange={(v) => setForm((f: any) => ({ ...f, tipo: v }))}>
                
                
                  Proveedor de insumos
                  Fabricante de productos
                  Ambos
                
              
            
          

          
            Contacto
            
              {[
                { k: "contacto_nombre", label: "Nombre contacto", placeholder: "Juan Pérez" },
                { k: "telefono",        label: "Teléfono",        placeholder: "+51 999 999 999" },
                { k: "email",           label: "Email",           placeholder: "ventas@proveedor.com" },
                { k: "whatsapp",        label: "WhatsApp",        placeholder: "+51 999 999 999" },
              ].map(({ k, label, placeholder }) => (
                
                  {label}
                  
                
              ))}
              
                Dirección
                <Input className="mt-1" value={form.direccion} onChange={set("direccion")} placeholder="Av. Principal 123" />
              
              
                Distrito
                <Input className="mt-1" value={form.distrito} onChange={set("distrito")} placeholder="San Juan de Lurigancho" />
              
            
          

          
            Condiciones
            
              
                Plazo entrega (días)
                <Input className="mt-1" type="number" min={0} value={form.plazo_entrega_dias}
                  onChange={(e) => setForm((f: any) => ({ ...f, plazo_entrega_dias: Number(e.target.value) }))} />
              
              
                Crédito (días, 0 = contado)
                <Input className="mt-1" type="number" min={0} value={form.credito_dias}
                  onChange={(e) => setForm((f: any) => ({ ...f, credito_dias: Number(e.target.value) }))} />
              
            
          

          
            Notas internas
            <Textarea className="mt-1 text-sm" rows={2} value={form.notas} onChange={set("notas")}
              placeholder="Condiciones especiales, historial de relación, etc." />
          

          <Button className="w-full" disabled={!form.nombre || mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending && }
            {initial ? "Guardar cambios" : "Crear proveedor"}
          
        
      
    
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
      
        
          
            
              
              {isLoading ? "Cargando..." : p?.nombre}
            
          

          {isLoading || !p ? (
            
          ) : (
            
              {/* Header info */}
              
                
                  {tipo.label}
                  {p.ruc && RUC: {p.ruc}}
                
                <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>Editar
              

              
                
                  Información
                  
                    Órdenes de compra
                    {ordenes.filter((o: any) => o.status === "enviada").length > 0 && (
                      
                        {ordenes.filter((o: any) => o.status === "enviada").length}
                      
                    )}
                  
                  Materiales
                

                {/* Tab: Información */}
                
                  
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
                      
                        {label}
                        {value}
                      
                    ) : null)}
                  

                  {/* Acciones de contacto rápido */}
                  
                    {p.telefono && (
                      
                        
                           Llamar
                        
                      
                    )}
                    {p.whatsapp && (
                      
                        
                           WhatsApp
                        
                      
                    )}
                    {p.email && (
                      
                        
                           Email
                        
                      
                    )}
                  

                  {p.notas && (
                    
                      Notas
                      {p.notas}
                    
                  )}
                

                {/* Tab: Órdenes de compra */}
                
                  
                    <Button size="sm" onClick={() => setOcOpen(true)}>
                       Nueva orden de compra
                    
                  

                  {ordenes.length === 0 ? (
                    Sin órdenes de compra
                  ) : (
                    
                      {ordenes.map((oc: any) => {
                        const st = OC_STATUS_CONFIG[oc.status as OcStatus];
                        const Icon = st?.icon ?? Package;
                        return (
                          
                            
                              
                                {oc.numero}
                                
                                  {fmtDay(oc.fecha_emision)}
                                  {oc.fecha_esperada && ` · Esperada: ${fmtDay(oc.fecha_esperada)}`}
                                
                              
                              
                                {st?.label}
                              
                            

                            {/* Ítems */}
                            
                              {(oc.orden_compra_items ?? []).map((item: any) => (
                                
                                  {item.descripcion} × {item.cantidad}
                                  {fmt(Number(item.subtotal))}
                                
                              ))}
                            

                            
                              {fmt(Number(oc.total))}
                              
                                {oc.status === "borrador" && (
                                  <Button size="sm" variant="outline"
                                    onClick={() => statusMut.mutate({ id: oc.id, status: "enviada" })}
                                    disabled={statusMut.isPending}>
                                     Enviar al proveedor
                                  
                                )}
                                {(oc.status === "enviada" || oc.status === "confirmada") && (
                                  <Button size="sm"
                                    onClick={() => recibirMut.mutate(oc.id)}
                                    disabled={recibirMut.isPending}>
                                    {recibirMut.isPending
                                      ? 
                                      : }
                                    Confirmar recepción
                                  
                                )}
                                {oc.status === "borrador" && (
                                  <Button size="sm" variant="ghost"
                                    onClick={() => statusMut.mutate({ id: oc.id, status: "cancelada" })}>
                                    
                                  
                                )}
                              
                            
                          
                        );
                      })}
                    
                  )}
                

                {/* Tab: Materiales vinculados */}
                
                  {(p.insumos ?? []).length > 0 && (
                    
                      Insumos
                      
                        {p.insumos.map((i: any) => (
                          
                            {i.nombre}
                            {i.stock_actual} {i.unidad}
                          
                        ))}
                      
                    
                  )}
                  {(p.products ?? []).length > 0 && (
                    
                      Productos
                      
                        {p.products.map((pr: any) => (
                          
                            {pr.nombre}
                            {fmt(Number(pr.precio))}
                          
                        ))}
                      
                    
                  )}
                  {(p.insumos ?? []).length === 0 && (p.products ?? []).length === 0 && (
                    
                      Sin materiales vinculados. Vincula insumos o productos desde sus respectivos paneles.
                    
                  )}
                
              
            
          )}
        
      

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
  const [items, setItems] = useState([
    { descripcion: "", unidad: "unidades", cantidad: 1, precio_unit: 0 },
  ]);

  const addItem = () => setItems((it) => [...it, { descripcion: "", unidad: "unidades", cantidad: 1, precio_unit: 0 }]);
  const removeItem = (i: number) => setItems((it) => it.filter((_, idx) => idx !== i));
  const updateItem = (i: number, k: string, v: string | number) =>
    setItems((it) => it.map((row, idx) => idx === i ? { ...row, [k]: v } : row));

  const total = items.reduce((s, it) => s + it.cantidad * it.precio_unit, 0);

  const mut = useMutation({
    mutationFn: () => crearOrdenCompra({ proveedor_id: proveedorId, fecha_esperada: fechaEsperada || null, notas: notas || null, items }),
    onSuccess: () => { toast.success("Orden de compra creada"); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    
      
        Nueva orden de compra
        
          
            
              Fecha esperada de entrega
              <Input className="mt-1" type="date" value={fechaEsperada} onChange={(e) => setFechaEsperada(e.target.value)} />
            
            
              Notas para el proveedor
              <Input className="mt-1" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Instrucciones, referencias..." />
            
          

          
            
              Ítems *
               Añadir
            
            {items.map((item, i) => (
              
                
                  {i === 0 && Descripción}
                  <Input placeholder="Tela metro lineal..." value={item.descripcion}
                    onChange={(e) => updateItem(i, "descripcion", e.target.value)} />
                
                
                  {i === 0 && Unidad}
                  <Select value={item.unidad} onValueChange={(v) => updateItem(i, "unidad", v)}>
                    
                    
                      {UNIDADES.map((u) => {u})}
                    
                  
                
                
                  {i === 0 && Cantidad}
                  <Input type="number" min={0} value={item.cantidad}
                    onChange={(e) => updateItem(i, "cantidad", Number(e.target.value))} />
                
                
                  {i === 0 && P. Unit (S/)}
                  <Input type="number" min={0} step="0.01" value={item.precio_unit}
                    onChange={(e) => updateItem(i, "precio_unit", Number(e.target.value))} />
                
                
                  {i === 0 && Sub.}
                  
                    {fmt(item.cantidad * item.precio_unit)}
                  
                
                
                  {items.length > 1 && (
                    <Button size="sm" variant="ghost" onClick={() => removeItem(i)}>
                      
                    
                  )}
                
              
            ))}

            
              Total estimado: {fmt(total)} + IGV ({fmt(total * 0.18)}) = {fmt(total * 1.18)}
            
          

          <Button className="w-full"
            disabled={items.some((it) => !it.descripcion) || mut.isPending}
            onClick={() => mut.mutate()}>
            {mut.isPending && }
            Crear orden de compra (borrador)
          
        
      
    
  );
}

// ── Página principal ─────────────────────────────────────────
function ProveedoresPage() {
  const [busqueda, setBusqueda] = useState("");
  const [tipoFilter, setTipoFilter] = useState("todos");
  const [formOpen, setFormOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

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
    
      
        
          Proveedores y Fabricantes
          Directorio y órdenes de compra
        
        
          <Button variant="outline" size="sm" onClick={() => refetch()}>
             Actualizar
          
          <Button size="sm" onClick={() => setFormOpen(true)}>
             Nuevo proveedor
          
        
      

      {/* KPIs */}
      
        {[
          { label: "Total",          value: stats.total },
          { label: "Proveen insumos", value: stats.insumo },
          { label: "Fabricantes",    value: stats.producto },
          { label: "OC pendientes",  value: stats.oc_pend },
        ].map(({ label, value }) => (
          <div key={label} className={`border rounded-xl p-4 ${label === "OC pendientes" && value > 0 ? "bg-amber-50 border-amber-200" : "bg-card border-border/50"}`}>
            {label}
            {value}
          
        ))}
      

      {/* Filtros */}
      
        
          <Input placeholder="Buscar por nombre, RUC o contacto…"
            value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        
        
          
          
            Todos los tipos
            Proveedores de insumos
            Fabricantes
            Ambos
          
        
      

      {/* Tabla */}
      {isLoading ? (
        
      ) : filtrados.length === 0 ? (
        
          
          No hay proveedores registrados
          <Button size="sm" onClick={() => setFormOpen(true)}> Añadir el primero
        
      ) : (
        
          
            
              
                
                  {["Proveedor", "Tipo", "Contacto", "Plazo", "Insumos", "OC pendientes", "Total comprado", ""].map((h) => (
                    {h}
                  ))}
                
              
              
                {filtrados.map((p: any) => {
                  const tipo = TIPO_CONFIG[p.tipo as ProvTipo];
                  return (
                    
                      
                        {p.nombre}
                        {p.ruc && RUC {p.ruc}}
                      
                      
                        {tipo?.label}
                      
                      
                        {p.contacto_nombre && {p.contacto_nombre}}
                        {p.telefono && {p.telefono}}
                      
                      
                        {p.plazo_entrega_dias ? `${p.plazo_entrega_dias}d` : "—"}
                      
                      {p.total_insumos ?? 0}
                      
                        {(p.oc_pendientes ?? 0) > 0
                          ? {p.oc_pendientes}
                          : —}
                      
                      
                        {Number(p.total_comprado) > 0 ? fmt(Number(p.total_comprado)) : "—"}
                      
                      
                        <Button variant="ghost" size="sm" onClick={() => setSelectedId(p.id)}>
                          
                        
                      
                    
                  );
                })}
              
            
          
        
      )}

      {formOpen && <ProveedorForm onClose={() => setFormOpen(false)} />}
      {selectedId && <ProveedorDetalle proveedorId={selectedId} onClose={() => setSelectedId(null)} />}
    
  );
}