// src/routes/_authenticated/combos.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Pencil, Trash2, Image, PackageCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { fmtPEN } from "@/lib/pricing";

export const Route = createFileRoute("/_authenticated/combos")({
  head: () => ({ meta: [{ title: "Combos — G&M POS" }] }),
  component: CombosPage,
});

const fmt = fmtPEN;

// ─── Tipos ───────────────────────────────────────────────────────────────────

type ComboFormItem = { product_id: string; cantidad: number };

type ComboForm = {
  id?: string;
  nombre: string;
  descripcion: string;
  precio_combo: string;
  vence_el: string; // datetime-local, "" = sin vencimiento
  activo: boolean;
  items: ComboFormItem[];
};

const emptyForm = (): ComboForm => ({
  nombre: "", descripcion: "", precio_combo: "", vence_el: "", activo: true, items: [],
});

const isoToLocalInput = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// ─── Helpers Supabase ─────────────────────────────────────────────────────────

async function listCombos() {
  const { data, error } = await supabase
    .from("combos")
    .select("*, combo_items(id, cantidad, product_id, products(id, nombre, precio, imagen_url, imagen_public_id, stock))")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function listProductsSimple() {
  const { data, error } = await supabase
    .from("products")
    .select("id, nombre, precio, sku, imagen_url, imagen_public_id")
    .order("nombre", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function upsertCombo(form: ComboForm) {
  const payload = {
    ...(form.id ? { id: form.id } : {}),
    nombre: form.nombre,
    descripcion: form.descripcion || null,
    precio_combo: parseFloat(form.precio_combo),
    vence_el: form.vence_el ? new Date(form.vence_el).toISOString() : null,
    activo: form.activo,
  };
  const { data: combo, error } = await supabase.from("combos").upsert(payload).select().single();
  if (error) throw new Error(error.message);

  // Reemplaza los items del combo por los actuales del formulario
  const { error: delErr } = await supabase.from("combo_items").delete().eq("combo_id", combo.id);
  if (delErr) throw new Error(delErr.message);

  if (form.items.length > 0) {
    const rows = form.items.map((it) => ({
      combo_id: combo.id,
      product_id: it.product_id,
      cantidad: it.cantidad,
    }));
    const { error: insErr } = await supabase.from("combo_items").insert(rows);
    if (insErr) throw new Error(insErr.message);
  }

  return combo;
}

async function deleteCombo(id: string) {
  const { error } = await supabase.from("combos").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ─── Modal de formulario ──────────────────────────────────────────────────────

function ComboFormModal({ initial, onClose }: { initial?: ComboForm | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<ComboForm>(initial ?? emptyForm());
  const [buscarProducto, setBuscarProducto] = useState("");

  const { data: productos = [] } = useQuery({ queryKey: ["products-simple"], queryFn: listProductsSimple });

  const productosFiltrados = useMemo(() => {
    const q = buscarProducto.toLowerCase();
    return productos.filter((p: any) => !q || p.nombre?.toLowerCase().includes(q));
  }, [productos, buscarProducto]);

  const precioNormal = useMemo(() => {
    return form.items.reduce((s, it) => {
      const p = productos.find((pr: any) => pr.id === it.product_id);
      return s + (p ? p.precio * it.cantidad : 0);
    }, 0);
  }, [form.items, productos]);

  const toggleProducto = (product_id: string) => {
    setForm((f) => {
      const existe = f.items.some((it) => it.product_id === product_id);
      return {
        ...f,
        items: existe
          ? f.items.filter((it) => it.product_id !== product_id)
          : [...f.items, { product_id, cantidad: 1 }],
      };
    });
  };

  const setCantidad = (product_id: string, cantidad: number) => {
    setForm((f) => ({
      ...f,
      items: f.items.map((it) => (it.product_id === product_id ? { ...it, cantidad: Math.max(1, cantidad) } : it)),
    }));
  };

  const saveMut = useMutation({
    mutationFn: () => upsertCombo(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["combos"] });
      toast.success(form.id ? "Combo actualizado" : "Combo creado");
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const precioComboNum = Number(form.precio_combo || 0);
  const ahorro = precioNormal - precioComboNum;

  return (
    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{form.id ? "Editar combo" : "Nuevo combo"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div>
          <Label htmlFor="nombre">Nombre del combo *</Label>
          <Input
            id="nombre"
            required
            placeholder='Ej. "Combo Sala Completa"'
            value={form.nombre}
            onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
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

        {/* ── Selección de productos ── */}
        <div>
          <Label>Productos incluidos *</Label>
          <Input
            placeholder="Buscar producto…"
            value={buscarProducto}
            onChange={(e) => setBuscarProducto(e.target.value)}
            className="mt-1 mb-2"
          />
          <div className="border border-border rounded-lg max-h-52 overflow-y-auto divide-y divide-border/50">
            {productosFiltrados.map((p: any) => {
              const item = form.items.find((it) => it.product_id === p.id);
              const checked = !!item;
              return (
                <div key={p.id} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/40">
                  <Checkbox checked={checked} onCheckedChange={() => toggleProducto(p.id)} />
                  <div className="w-9 h-9 rounded bg-muted overflow-hidden flex-shrink-0">
                    {p.imagen_public_id || p.imagen_url ? (
                      <img
                        src={p.imagen_public_id ? cloudinaryUrl(p.imagen_public_id, { w: 36, h: 36 }) : p.imagen_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Image className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <span className="flex-1 text-sm truncate">{p.nombre}</span>
                  <span className="text-xs text-muted-foreground">{fmt(p.precio)}</span>
                  {checked && (
                    <Input
                      type="number"
                      min="1"
                      value={item!.cantidad}
                      onChange={(e) => setCantidad(p.id, parseInt(e.target.value, 10) || 1)}
                      className="w-14 h-7 text-xs px-1"
                    />
                  )}
                </div>
              );
            })}
            {productosFiltrados.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Sin resultados</p>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">{form.items.length} producto(s) seleccionado(s)</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="precio_combo">Precio del combo (S/) *</Label>
            <Input
              id="precio_combo"
              type="number"
              step="0.01"
              min="0"
              required
              value={form.precio_combo}
              onChange={(e) => setForm((f) => ({ ...f, precio_combo: e.target.value }))}
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

        {form.items.length > 0 && (
          <div className="rounded-lg bg-accent/10 border border-accent/20 px-3 py-2 flex items-center gap-2 text-sm flex-wrap">
            <span className="text-muted-foreground">Suma individual:</span>
            <span className="text-muted-foreground line-through">{fmt(precioNormal)}</span>
            {!!form.precio_combo && (
              <>
                <span className="font-semibold text-accent">{fmt(precioComboNum)}</span>
                <span className="text-xs ml-auto">
                  {ahorro > 0 ? (
                    <span className="text-accent font-medium">Ahorra {fmt(ahorro)}</span>
                  ) : (
                    <span className="text-destructive font-medium">⚠ El combo cuesta igual o más que comprar separado</span>
                  )}
                </span>
              </>
            )}
          </div>
        )}

        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
          <div>
            <Label htmlFor="activo">Combo activo</Label>
            <p className="text-xs text-muted-foreground">Visible en la tienda mientras esté activo</p>
          </div>
          <Switch id="activo" checked={form.activo} onCheckedChange={(v) => setForm((f) => ({ ...f, activo: v }))} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending || !form.nombre || !form.precio_combo || form.items.length < 2}
          >
            {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Guardar
          </Button>
        </div>
        {form.items.length > 0 && form.items.length < 2 && (
          <p className="text-xs text-destructive text-right -mt-2">Un combo necesita al menos 2 productos</p>
        )}
      </div>
    </DialogContent>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

function CombosPage() {
  const { data = [], isLoading } = useQuery({ queryKey: ["combos"], queryFn: listCombos });
  const qc = useQueryClient();
  const [editItem, setEditItem] = useState<ComboForm | null | undefined>(undefined);

  const delMut = useMutation({
    mutationFn: deleteCombo,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["combos"] }); toast.success("Combo eliminado"); },
    onError: (e: any) => toast.error(e.message),
  });

  const precioNormalDe = (c: any) =>
    (c.combo_items ?? []).reduce((s: number, it: any) => s + (it.products?.precio ?? 0) * it.cantidad, 0);

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-semibold">Combos</h1>
          <p className="text-muted-foreground">Paquetes de varios productos a un precio único</p>
        </div>
        <Button onClick={() => setEditItem(null)}>
          <Plus className="h-4 w-4 mr-1" /> Nuevo combo
        </Button>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto -mx-px">
            <table className="w-full min-w-[600px] text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-3">Combo</th>
                  <th className="px-4 py-3">Incluye</th>
                  <th className="px-4 py-3 text-right">Precio</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {data.map((c: any) => {
                  const normal = precioNormalDe(c);
                  const vencido = c.vence_el && new Date(c.vence_el).getTime() <= Date.now();
                  return (
                    <tr key={c.id} className="border-t hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">
                        <div className="flex items-center gap-2">
                          <PackageCheck className="h-4 w-4 text-accent flex-shrink-0" />
                          {c.nombre}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs max-w-[280px]">
                        {(c.combo_items ?? []).map((it: any) => it.products?.nombre).filter(Boolean).join(" + ")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-col items-end leading-tight">
                          {normal > 0 && <span className="text-muted-foreground line-through text-xs">{fmt(normal)}</span>}
                          <span className="font-semibold text-accent">{fmt(c.precio_combo)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {!c.activo ? (
                          <Badge variant="outline" className="text-muted-foreground">Inactivo</Badge>
                        ) : vencido ? (
                          <Badge variant="outline" className="text-muted-foreground">Vencido</Badge>
                        ) : (
                          <Badge className="bg-accent text-accent-foreground hover:bg-accent">Activo</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditItem({
                              id: c.id,
                              nombre: c.nombre,
                              descripcion: c.descripcion ?? "",
                              precio_combo: String(c.precio_combo),
                              vence_el: isoToLocalInput(c.vence_el),
                              activo: c.activo,
                              items: (c.combo_items ?? []).map((it: any) => ({ product_id: it.product_id, cantidad: it.cantidad })),
                            })}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { if (confirm("¿Eliminar este combo?")) delMut.mutate(c.id); }}
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
                    <td colSpan={5} className="text-center py-10 text-muted-foreground">
                      Sin combos todavía. ¡Crea el primero!
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
          <ComboFormModal initial={editItem} onClose={() => setEditItem(undefined)} />
        )}
      </Dialog>
    </div>
  );
}