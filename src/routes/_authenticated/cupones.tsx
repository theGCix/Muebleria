// src/routes/_authenticated/cupones.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Pencil, Trash2, Tag } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";
import { toast } from "sonner";
import { fmtPEN } from "@/lib/pricing";
import { CATEGORIAS } from "@/lib/categories";

export const Route = createFileRoute("/_authenticated/cupones")({
  head: () => ({ meta: [{ title: "Cupones — G&M POS" }] }),
  component: CuponesPage,
});

const fmt = fmtPEN;

// ─── Tipos ───────────────────────────────────────────────────────────────────

type TipoDescuento = "porcentaje" | "monto_fijo";
type AplicaA = "todo" | "categoria" | "producto" | "combo";
type Segmento = "nuevo" | "recurrente" | "vip" | "inactivo";
type Origen = "carrito_abandonado" | "reactivacion" | "bienvenida" | "manual" | "referido" | "resena";

type CuponForm = {
  id?: string;
  codigo: string;
  descripcion: string;
  tipo_descuento: TipoDescuento;
  valor: string;
  descuento_maximo: string;
  monto_minimo_compra: string;
  aplica_a: AplicaA;
  categoria: string;
  producto_id: string;
  combo_id: string;
  segmento_objetivo: Segmento | "ninguno";
  solo_primera_compra: boolean;
  uso_maximo_total: string;
  uso_maximo_por_cliente: string;
  vigente_desde: string; // datetime-local
  vence_el: string; // datetime-local, "" = sin vencimiento
  activo: boolean;
  origen: Origen;
  notas: string;
};

const emptyForm = (): CuponForm => ({
  codigo: "",
  descripcion: "",
  tipo_descuento: "porcentaje",
  valor: "10",
  descuento_maximo: "",
  monto_minimo_compra: "0",
  aplica_a: "todo",
  categoria: "",
  producto_id: "",
  combo_id: "",
  segmento_objetivo: "ninguno",
  solo_primera_compra: false,
  uso_maximo_total: "",
  uso_maximo_por_cliente: "1",
  vigente_desde: isoToLocalInput(new Date().toISOString()),
  vence_el: "",
  activo: true,
  origen: "manual",
  notas: "",
});

function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── Helpers Supabase ─────────────────────────────────────────────────────────

async function listCupones() {
  const { data, error } = await supabase
    .from("cupones")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function listProductsSimple() {
  const { data, error } = await supabase
    .from("products")
    .select("id, nombre")
    .order("nombre", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function listCombosSimple() {
  const { data, error } = await supabase
    .from("combos")
    .select("id, nombre")
    .order("nombre", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

function validate(form: CuponForm): string | null {
  if (!form.codigo.trim()) return "El código es obligatorio";
  const valor = Number(form.valor);
  if (!valor || valor <= 0) return "El valor debe ser mayor a 0";
  if (form.tipo_descuento === "porcentaje" && valor > 90)
    return "El máximo permitido es 90% de descuento";
  if (form.aplica_a === "categoria" && !form.categoria) return "Selecciona una categoría";
  if (form.aplica_a === "producto" && !form.producto_id) return "Selecciona un producto";
  if (form.aplica_a === "combo" && !form.combo_id) return "Selecciona un combo";
  return null;
}

async function upsertCupon(form: CuponForm) {
  const err = validate(form);
  if (err) throw new Error(err);

  const payload = {
    ...(form.id ? { id: form.id } : {}),
    codigo: form.codigo.trim().toUpperCase(),
    descripcion: form.descripcion || null,
    tipo_descuento: form.tipo_descuento,
    valor: Number(form.valor),
    descuento_maximo:
      form.tipo_descuento === "porcentaje" && form.descuento_maximo
        ? Number(form.descuento_maximo)
        : null,
    monto_minimo_compra: Number(form.monto_minimo_compra || 0),
    aplica_a: form.aplica_a,
    categoria: form.aplica_a === "categoria" ? form.categoria : null,
    producto_id: form.aplica_a === "producto" ? form.producto_id : null,
    combo_id: form.aplica_a === "combo" ? form.combo_id : null,
    segmento_objetivo: form.segmento_objetivo === "ninguno" ? null : form.segmento_objetivo,
    solo_primera_compra: form.solo_primera_compra,
    uso_maximo_total: form.uso_maximo_total ? Number(form.uso_maximo_total) : null,
    uso_maximo_por_cliente: Number(form.uso_maximo_por_cliente || 1),
    vigente_desde: new Date(form.vigente_desde).toISOString(),
    vence_el: form.vence_el ? new Date(form.vence_el).toISOString() : null,
    activo: form.activo,
    origen: form.origen,
    notas: form.notas || null,
  };

  const { error } = await supabase.from("cupones").upsert(payload);
  if (error) {
    if (error.code === "23505") throw new Error("Ya existe un cupón con ese código");
    throw new Error(error.message);
  }
}

async function deleteCupon(id: string) {
  const { error } = await supabase.from("cupones").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

async function toggleActivo(id: string, activo: boolean) {
  const { error } = await supabase.from("cupones").update({ activo }).eq("id", id);
  if (error) throw new Error(error.message);
}

// ─── Modal de formulario ──────────────────────────────────────────────────────

function CuponFormModal({ initial, onClose }: { initial?: CuponForm | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<CuponForm>(initial ?? emptyForm());

  const { data: productos = [] } = useQuery({ queryKey: ["products-simple"], queryFn: listProductsSimple });
  const { data: combos = [] } = useQuery({ queryKey: ["combos-simple"], queryFn: listCombosSimple });

  const saveMut = useMutation({
    mutationFn: () => upsertCupon(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cupones"] });
      toast.success(form.id ? "Cupón actualizado" : "Cupón creado");
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{form.id ? "Editar cupón" : "Nuevo cupón"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div>
          <Label htmlFor="codigo">Código *</Label>
          <Input
            id="codigo"
            required
            placeholder="VERANO20"
            className="font-mono"
            value={form.codigo}
            onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
          />
        </div>

        <div>
          <Label htmlFor="descripcion">Descripción</Label>
          <Textarea
            id="descripcion"
            rows={2}
            value={form.descripcion}
            onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Tipo de descuento</Label>
            <Select value={form.tipo_descuento} onValueChange={(v: TipoDescuento) => setForm((f) => ({ ...f, tipo_descuento: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="porcentaje">Porcentaje</SelectItem>
                <SelectItem value="monto_fijo">Monto fijo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="valor">Valor {form.tipo_descuento === "porcentaje" ? "(%)" : "(S/)"} *</Label>
            <Input
              id="valor"
              type="number"
              step="0.01"
              min="0"
              required
              value={form.valor}
              onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
            />
          </div>
        </div>

        {form.tipo_descuento === "porcentaje" && (
          <div>
            <Label htmlFor="descuento_maximo">Descuento máximo en soles (opcional)</Label>
            <Input
              id="descuento_maximo"
              type="number"
              step="0.01"
              min="0"
              placeholder="Sin tope"
              value={form.descuento_maximo}
              onChange={(e) => setForm((f) => ({ ...f, descuento_maximo: e.target.value }))}
            />
          </div>
        )}

        <div>
          <Label htmlFor="monto_minimo">Monto mínimo de compra (S/)</Label>
          <Input
            id="monto_minimo"
            type="number"
            step="0.01"
            min="0"
            value={form.monto_minimo_compra}
            onChange={(e) => setForm((f) => ({ ...f, monto_minimo_compra: e.target.value }))}
          />
        </div>

        <div>
          <Label>Aplica a</Label>
          <Select value={form.aplica_a} onValueChange={(v: AplicaA) => setForm((f) => ({ ...f, aplica_a: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todo">Todo el catálogo</SelectItem>
              <SelectItem value="categoria">Una categoría</SelectItem>
              <SelectItem value="producto">Un producto</SelectItem>
              <SelectItem value="combo">Un combo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {form.aplica_a === "categoria" && (
          <div>
            <Label>Categoría</Label>
            <Select value={form.categoria} onValueChange={(v) => setForm((f) => ({ ...f, categoria: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecciona una categoría" /></SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map((c) => (
                  <SelectItem key={c.slug} value={c.slug}>{c.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {form.aplica_a === "producto" && (
          <div>
            <Label>Producto</Label>
            <Select value={form.producto_id} onValueChange={(v) => setForm((f) => ({ ...f, producto_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecciona un producto" /></SelectTrigger>
              <SelectContent>
                {productos.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {form.aplica_a === "combo" && (
          <div>
            <Label>Combo</Label>
            <Select value={form.combo_id} onValueChange={(v) => setForm((f) => ({ ...f, combo_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecciona un combo" /></SelectTrigger>
              <SelectContent>
                {combos.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Segmento objetivo</Label>
            <Select
              value={form.segmento_objetivo}
              onValueChange={(v) => setForm((f) => ({ ...f, segmento_objetivo: v as Segmento | "ninguno" }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ninguno">Todos los clientes</SelectItem>
                <SelectItem value="nuevo">Nuevo</SelectItem>
                <SelectItem value="recurrente">Recurrente</SelectItem>
                <SelectItem value="vip">VIP</SelectItem>
                <SelectItem value="inactivo">Inactivo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Origen</Label>
            <Select value={form.origen} onValueChange={(v: Origen) => setForm((f) => ({ ...f, origen: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="bienvenida">Bienvenida</SelectItem>
                <SelectItem value="reactivacion">Reactivación</SelectItem>
                <SelectItem value="carrito_abandonado">Carrito abandonado</SelectItem>
                <SelectItem value="referido">Referido</SelectItem>
                <SelectItem value="resena">Reseña</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="uso_max_total">Uso máximo total</Label>
            <Input
              id="uso_max_total"
              type="number"
              min="1"
              placeholder="Ilimitado"
              value={form.uso_maximo_total}
              onChange={(e) => setForm((f) => ({ ...f, uso_maximo_total: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="uso_max_cliente">Uso máximo por cliente</Label>
            <Input
              id="uso_max_cliente"
              type="number"
              min="1"
              value={form.uso_maximo_por_cliente}
              onChange={(e) => setForm((f) => ({ ...f, uso_maximo_por_cliente: e.target.value }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="vigente_desde">Vigente desde</Label>
            <Input
              id="vigente_desde"
              type="datetime-local"
              value={form.vigente_desde}
              onChange={(e) => setForm((f) => ({ ...f, vigente_desde: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="vence_el">Vence el (opcional)</Label>
            <Input
              id="vence_el"
              type="datetime-local"
              value={form.vence_el}
              onChange={(e) => setForm((f) => ({ ...f, vence_el: e.target.value }))}
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
          <div>
            <Label htmlFor="solo_primera">Solo primera compra</Label>
            <p className="text-xs text-muted-foreground">Solo clientes sin pedidos pagados previos</p>
          </div>
          <Switch
            id="solo_primera"
            checked={form.solo_primera_compra}
            onCheckedChange={(v) => setForm((f) => ({ ...f, solo_primera_compra: v }))}
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
          <div>
            <Label htmlFor="activo">Cupón activo</Label>
            <p className="text-xs text-muted-foreground">Se puede usar en la tienda mientras esté activo</p>
          </div>
          <Switch id="activo" checked={form.activo} onCheckedChange={(v) => setForm((f) => ({ ...f, activo: v }))} />
        </div>

        <div>
          <Label htmlFor="notas">Notas internas</Label>
          <Textarea
            id="notas"
            rows={2}
            value={form.notas}
            onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !form.codigo || !form.valor}>
            {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Guardar
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

function estadoCupon(c: any): { label: string; className: string } {
  const now = Date.now();
  if (!c.activo) return { label: "Inactivo", className: "text-muted-foreground" };
  if (c.vence_el && new Date(c.vence_el).getTime() < now)
    return { label: "Vencido", className: "text-destructive" };
  if (c.uso_maximo_total && c.usos_actuales >= c.uso_maximo_total)
    return { label: "Agotado", className: "text-destructive" };
  if (new Date(c.vigente_desde).getTime() > now)
    return { label: "Programado", className: "text-muted-foreground" };
  return { label: "Activo", className: "text-accent" };
}

function CuponesPage() {
  const { data = [], isLoading } = useQuery({ queryKey: ["cupones"], queryFn: listCupones });
  const qc = useQueryClient();
  const [editItem, setEditItem] = useState<CuponForm | null | undefined>(undefined);

  const delMut = useMutation({
    mutationFn: deleteCupon,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cupones"] }); toast.success("Cupón eliminado"); },
    onError: () => toast.error("No se pudo eliminar (probablemente ya tiene usos registrados). Prueba desactivarlo en su lugar."),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, activo }: { id: string; activo: boolean }) => toggleActivo(id, activo),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cupones"] }),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-semibold">Cupones</h1>
          <p className="text-muted-foreground">Códigos de descuento para la tienda</p>
        </div>
        <Button onClick={() => setEditItem(null)}>
          <Plus className="h-4 w-4 mr-1" /> Nuevo cupón
        </Button>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto -mx-px">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Descuento</th>
                  <th className="px-4 py-3">Aplica a</th>
                  <th className="px-4 py-3">Usos</th>
                  <th className="px-4 py-3">Vigencia</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {data.map((c: any) => {
                  const estado = estadoCupon(c);
                  return (
                    <tr key={c.id} className="border-t hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">
                        <div className="flex items-center gap-2 font-mono">
                          <Tag className="h-4 w-4 text-accent flex-shrink-0" />
                          {c.codigo}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {c.tipo_descuento === "porcentaje"
                          ? `${c.valor}%${c.descuento_maximo ? ` (máx ${fmt(c.descuento_maximo)})` : ""}`
                          : fmt(c.valor)}
                      </td>
                      <td className="px-4 py-3 capitalize text-muted-foreground">{c.aplica_a}</td>
                      <td className="px-4 py-3">
                        {c.usos_actuales}{c.uso_maximo_total ? ` / ${c.uso_maximo_total}` : ""}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {c.vence_el ? new Date(c.vence_el).toLocaleDateString("es-PE") : "Sin vencimiento"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="outline" className={estado.className}>{estado.label}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Switch
                            checked={c.activo}
                            onCheckedChange={(v) => toggleMut.mutate({ id: c.id, activo: v })}
                            className="mr-1"
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditItem({
                              id: c.id,
                              codigo: c.codigo,
                              descripcion: c.descripcion ?? "",
                              tipo_descuento: c.tipo_descuento,
                              valor: String(c.valor),
                              descuento_maximo: c.descuento_maximo ? String(c.descuento_maximo) : "",
                              monto_minimo_compra: String(c.monto_minimo_compra ?? 0),
                              aplica_a: c.aplica_a,
                              categoria: c.categoria ?? "",
                              producto_id: c.producto_id ?? "",
                              combo_id: c.combo_id ?? "",
                              segmento_objetivo: c.segmento_objetivo ?? "ninguno",
                              solo_primera_compra: c.solo_primera_compra,
                              uso_maximo_total: c.uso_maximo_total ? String(c.uso_maximo_total) : "",
                              uso_maximo_por_cliente: String(c.uso_maximo_por_cliente ?? 1),
                              vigente_desde: isoToLocalInput(c.vigente_desde),
                              vence_el: isoToLocalInput(c.vence_el),
                              activo: c.activo,
                              origen: c.origen,
                              notas: c.notas ?? "",
                            })}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { if (confirm(`¿Eliminar el cupón "${c.codigo}"?`)) delMut.mutate(c.id); }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {data.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-muted-foreground">
                      Sin cupones todavía. ¡Crea el primero!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={editItem !== undefined} onOpenChange={(v) => !v && setEditItem(undefined)}>
        {editItem !== undefined && (
          <CuponFormModal initial={editItem} onClose={() => setEditItem(undefined)} />
        )}
      </Dialog>
    </div>
  );
}