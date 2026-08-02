import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ProductComboSelector } from "./ProductComboSelector";

// ---- Tipos basados en el schema de public.cupones ----
type TipoDescuento = "porcentaje" | "monto_fijo";
type AplicaA = "todo" | "categoria" | "producto" | "combo";
type Segmento = "nuevo" | "recurrente" | "vip" | "inactivo";
type Origen =
  | "carrito_abandonado"
  | "reactivacion"
  | "bienvenida"
  | "manual"
  | "referido"
  | "resena";

interface Cupon {
  id: string;
  codigo: string;
  descripcion: string | null;
  tipo_descuento: TipoDescuento;
  valor: number;
  descuento_maximo: number | null;
  monto_minimo_compra: number;
  aplica_a: AplicaA;
  categoria: string | null;
  producto_id: string | null;
  combo_id: string | null;
  segmento_objetivo: Segmento | null;
  solo_primera_compra: boolean;
  uso_maximo_total: number | null;
  uso_maximo_por_cliente: number;
  usos_actuales: number;
  vigente_desde: string;
  vence_el: string | null;
  activo: boolean;
  origen: Origen;
  notas: string | null;
}

type CuponFormState = Omit<Cupon, "id" | "usos_actuales">;

const EMPTY_FORM: CuponFormState = {
  codigo: "",
  descripcion: "",
  tipo_descuento: "porcentaje",
  valor: 10,
  descuento_maximo: null,
  monto_minimo_compra: 0,
  aplica_a: "todo",
  categoria: null,
  producto_id: null,
  combo_id: null,
  segmento_objetivo: null,
  solo_primera_compra: false,
  uso_maximo_total: null,
  uso_maximo_por_cliente: 1,
  vigente_desde: new Date().toISOString().slice(0, 16),
  vence_el: null,
  activo: true,
  origen: "manual",
  notas: "",
};

export default function CuponesAdmin() {
  const [cupones, setCupones] = useState<Cupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CuponFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCupones();
  }, []);

  async function fetchCupones() {
    setLoading(true);
    const { data, error } = await supabase
      .from("cupones")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Error al cargar cupones: " + error.message);
    } else {
      setCupones((data ?? []) as Cupon[]);
    }
    setLoading(false);
  }

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(cupon: Cupon) {
    setEditingId(cupon.id);
    setForm({
      ...cupon,
      vigente_desde: cupon.vigente_desde?.slice(0, 16) ?? "",
      vence_el: cupon.vence_el?.slice(0, 16) ?? null,
    });
    setDialogOpen(true);
  }

  function validate(): string | null {
    if (!form.codigo.trim()) return "El código es obligatorio";
    if (form.valor <= 0) return "El valor debe ser mayor a 0";
    if (form.tipo_descuento === "porcentaje" && form.valor > 100)
      return "Un descuento porcentual no puede superar 100";
    if (form.monto_minimo_compra < 0)
      return "El monto mínimo no puede ser negativo";
    if (form.aplica_a === "categoria" && !form.categoria)
      return "Selecciona una categoría";
    if (form.aplica_a === "producto" && !form.producto_id)
      return "Selecciona un producto";
    if (form.aplica_a === "combo" && !form.combo_id)
      return "Selecciona un combo";
    return null;
  }

  async function handleSave() {
    const validationError = validate();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSaving(true);
    const payload = {
      ...form,
      codigo: form.codigo.trim().toUpperCase(),
      descripcion: form.descripcion || null,
      categoria: form.aplica_a === "categoria" ? form.categoria : null,
      producto_id: form.aplica_a === "producto" ? form.producto_id : null,
      combo_id: form.aplica_a === "combo" ? form.combo_id : null,
      descuento_maximo:
        form.tipo_descuento === "porcentaje" ? form.descuento_maximo : null,
      vence_el: form.vence_el || null,
      notas: form.notas || null,
    };

    const { error } = editingId
      ? await supabase.from("cupones").update(payload).eq("id", editingId)
      : await supabase.from("cupones").insert(payload);

    if (error) {
      toast.error(
        error.code === "23505"
          ? "Ya existe un cupón con ese código"
          : "Error al guardar: " + error.message
      );
    } else {
      toast.success(editingId ? "Cupón actualizado" : "Cupón creado");
      setDialogOpen(false);
      fetchCupones();
    }
    setSaving(false);
  }

  async function toggleActivo(cupon: Cupon) {
    const { error } = await supabase
      .from("cupones")
      .update({ activo: !cupon.activo })
      .eq("id", cupon.id);

    if (error) {
      toast.error("No se pudo actualizar el estado");
    } else {
      setCupones((prev) =>
        prev.map((c) => (c.id === cupon.id ? { ...c, activo: !c.activo } : c))
      );
    }
  }

  async function handleDelete(cupon: Cupon) {
    if (!confirm(`¿Eliminar el cupón "${cupon.codigo}"? Esta acción no se puede deshacer.`))
      return;

    const { error } = await supabase.from("cupones").delete().eq("id", cupon.id);
    if (error) {
      toast.error(
        "No se pudo eliminar (probablemente tiene usos registrados). Considera desactivarlo en su lugar."
      );
    } else {
      toast.success("Cupón eliminado");
      setCupones((prev) => prev.filter((c) => c.id !== cupon.id));
    }
  }

  function estadoVigencia(c: Cupon): { label: string; variant: "default" | "secondary" | "destructive" } {
    const now = new Date();
    if (!c.activo) return { label: "Inactivo", variant: "secondary" };
    if (c.vence_el && new Date(c.vence_el) < now)
      return { label: "Vencido", variant: "destructive" };
    if (c.uso_maximo_total && c.usos_actuales >= c.uso_maximo_total)
      return { label: "Agotado", variant: "destructive" };
    if (new Date(c.vigente_desde) > now)
      return { label: "Programado", variant: "secondary" };
    return { label: "Activo", variant: "default" };
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Cupones y descuentos</h1>
          <p className="text-sm text-muted-foreground">
            Gestiona los cupones activos, su vigencia y límites de uso.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo cupón
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Descuento</TableHead>
              <TableHead>Aplica a</TableHead>
              <TableHead>Usos</TableHead>
              <TableHead>Vigencia</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : cupones.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No hay cupones todavía
                </TableCell>
              </TableRow>
            ) : (
              cupones.map((c) => {
                const estado = estadoVigencia(c);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono font-medium">{c.codigo}</TableCell>
                    <TableCell>
                      {c.tipo_descuento === "porcentaje"
                        ? `${c.valor}%${c.descuento_maximo ? ` (máx S/ ${c.descuento_maximo})` : ""}`
                        : `S/ ${c.valor}`}
                    </TableCell>
                    <TableCell className="capitalize">{c.aplica_a}</TableCell>
                    <TableCell>
                      {c.usos_actuales}
                      {c.uso_maximo_total ? ` / ${c.uso_maximo_total}` : ""}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.vence_el
                        ? new Date(c.vence_el).toLocaleDateString("es-PE")
                        : "Sin vencimiento"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={estado.variant}>{estado.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Switch
                        checked={c.activo}
                        onCheckedChange={() => toggleActivo(c)}
                        className="align-middle mr-2"
                      />
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(c)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar cupón" : "Nuevo cupón"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2">
              <Label>Código</Label>
              <Input
                value={form.codigo}
                onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                placeholder="VERANO20"
                className="font-mono"
              />
            </div>

            <div className="col-span-2">
              <Label>Descripción</Label>
              <Textarea
                value={form.descripcion ?? ""}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                rows={2}
              />
            </div>

            <div>
              <Label>Tipo de descuento</Label>
              <Select
                value={form.tipo_descuento}
                onValueChange={(v: TipoDescuento) => setForm({ ...form, tipo_descuento: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="porcentaje">Porcentaje</SelectItem>
                  <SelectItem value="monto_fijo">Monto fijo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Valor {form.tipo_descuento === "porcentaje" ? "(%)" : "(S/)"}</Label>
              <Input
                type="number"
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })}
              />
            </div>

            {form.tipo_descuento === "porcentaje" && (
              <div>
                <Label>Descuento máximo (S/, opcional)</Label>
                <Input
                  type="number"
                  value={form.descuento_maximo ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      descuento_maximo: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </div>
            )}

            <div>
              <Label>Monto mínimo de compra (S/)</Label>
              <Input
                type="number"
                value={form.monto_minimo_compra}
                onChange={(e) =>
                  setForm({ ...form, monto_minimo_compra: Number(e.target.value) })
                }
              />
            </div>

            <div>
              <Label>Aplica a</Label>
              <Select
                value={form.aplica_a}
                onValueChange={(v: AplicaA) => setForm({ ...form, aplica_a: v })}
              >
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
                <Input
                  value={form.categoria ?? ""}
                  onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                  placeholder="ej. Sofás"
                />
              </div>
            )}
            {form.aplica_a === "producto" && (
              <div>
                <Label>Producto</Label>
                <ProductComboSelector
                  mode="producto"
                  value={form.producto_id}
                  onChange={(id) => setForm({ ...form, producto_id: id })}
                />
              </div>
            )}
            {form.aplica_a === "combo" && (
              <div>
                <Label>Combo</Label>
                <ProductComboSelector
                  mode="combo"
                  value={form.combo_id}
                  onChange={(id) => setForm({ ...form, combo_id: id })}
                />
              </div>
            )}

            <div>
              <Label>Segmento objetivo</Label>
              <Select
                value={form.segmento_objetivo ?? "ninguno"}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    segmento_objetivo: v === "ninguno" ? null : (v as Segmento),
                  })
                }
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
              <Select
                value={form.origen}
                onValueChange={(v: Origen) => setForm({ ...form, origen: v })}
              >
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

            <div>
              <Label>Uso máximo total (vacío = ilimitado)</Label>
              <Input
                type="number"
                value={form.uso_maximo_total ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    uso_maximo_total: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </div>

            <div>
              <Label>Uso máximo por cliente</Label>
              <Input
                type="number"
                value={form.uso_maximo_por_cliente}
                onChange={(e) =>
                  setForm({ ...form, uso_maximo_por_cliente: Number(e.target.value) })
                }
              />
            </div>

            <div>
              <Label>Vigente desde</Label>
              <Input
                type="datetime-local"
                value={form.vigente_desde}
                onChange={(e) => setForm({ ...form, vigente_desde: e.target.value })}
              />
            </div>

            <div>
              <Label>Vence el (opcional)</Label>
              <Input
                type="datetime-local"
                value={form.vence_el ?? ""}
                onChange={(e) => setForm({ ...form, vence_el: e.target.value || null })}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={form.solo_primera_compra}
                onCheckedChange={(v) => setForm({ ...form, solo_primera_compra: v })}
              />
              <Label>Solo primera compra</Label>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={form.activo}
                onCheckedChange={(v) => setForm({ ...form, activo: v })}
              />
              <Label>Activo</Label>
            </div>

            <div className="col-span-2">
              <Label>Notas internas</Label>
              <Textarea
                value={form.notas ?? ""}
                onChange={(e) => setForm({ ...form, notas: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingId ? "Guardar cambios" : "Crear cupón"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}