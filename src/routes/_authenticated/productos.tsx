import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Pencil, Trash2, Upload, Image } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { uploadImage, cloudinaryUrl } from "@/lib/cloudinary";

export const Route = createFileRoute("/_authenticated/productos")({
  head: () => ({ meta: [{ title: "Productos — G&M POS" }] }),
  component: ProductosPage,
});

const fmt = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n);

async function listProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function upsertProduct(product: any) {
  const { data, error } = await supabase
    .from("products")
    .upsert(product)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function deleteProduct(id: string) {
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

type ProductForm = {
  id?: string;
  nombre: string;
  descripcion: string;
  sku: string;
  precio: string;
  stock: string;
  categoria: string;
  imagen_url: string;
  imagen_public_id: string;
};

const emptyForm = (): ProductForm => ({
  nombre: "", descripcion: "", sku: "", precio: "",
  stock: "", categoria: "", imagen_url: "", imagen_public_id: "",
});

function ProductFormModal({
  initial, onClose,
}: {
  initial?: ProductForm | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<ProductForm>(initial ?? emptyForm());
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (k: keyof ProductForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadImage(file, "muebleria/productos");
      setForm((f) => ({
        ...f,
        imagen_url: result.secure_url,
        imagen_public_id: result.public_id,
      }));
      toast.success("Imagen subida correctamente");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const saveMut = useMutation({
    mutationFn: () =>
      upsertProduct({
        ...form,
        precio: parseFloat(form.precio),
        stock: parseInt(form.stock, 10),
        ...(form.id ? { id: form.id } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success(form.id ? "Producto actualizado" : "Producto creado");
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{form.id ? "Editar producto" : "Nuevo producto"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div>
          <Label>Imagen</Label>
          <div className="mt-1 flex gap-3 items-start">
            {form.imagen_url ? (
              <img
                src={form.imagen_public_id
                  ? cloudinaryUrl(form.imagen_public_id, { w: 80, h: 80 })
                  : form.imagen_url}
                alt=""
                className="w-20 h-20 object-cover rounded border"
              />
            ) : (
              <div className="w-20 h-20 rounded border border-dashed flex items-center justify-center text-muted-foreground">
                <Image className="h-6 w-6" />
              </div>
            )}
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                <span className="ml-1">{uploading ? "Subiendo…" : "Subir imagen"}</span>
              </Button>
              <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WEBP. Sube a Cloudinary.</p>
            </div>
          </div>
        </div>

        <div>
          <Label htmlFor="nombre">Nombre *</Label>
          <Input id="nombre" required value={form.nombre} onChange={set("nombre")} />
        </div>
        <div>
          <Label htmlFor="descripcion">Descripción</Label>
          <Textarea id="descripcion" rows={3} value={form.descripcion} onChange={set("descripcion")} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="sku">SKU</Label>
            <Input id="sku" value={form.sku} onChange={set("sku")} />
          </div>
          <div>
            <Label htmlFor="categoria">Categoría</Label>
            <Input id="categoria" value={form.categoria} onChange={set("categoria")} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="precio">Precio (S/) *</Label>
            <Input id="precio" type="number" step="0.01" min="0" required value={form.precio} onChange={set("precio")} />
          </div>
          <div>
            <Label htmlFor="stock">Stock</Label>
            <Input id="stock" type="number" min="0" value={form.stock} onChange={set("stock")} />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !form.nombre || !form.precio}>
            {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}

function ProductosPage() {
  const { data = [], isLoading } = useQuery({ queryKey: ["products"], queryFn: listProducts });
  const qc = useQueryClient();
  const [editItem, setEditItem] = useState<ProductForm | null | undefined>(undefined);
  const [search, setSearch] = useState("");

  const delMut = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); toast.success("Eliminado"); },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = data.filter((p: any) =>
    !search || p.nombre?.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-semibold">Productos</h1>
          <p className="text-muted-foreground">Catálogo propio con imágenes Cloudinary</p>
        </div>
        <Button onClick={() => setEditItem(null)}>
          <Plus className="h-4 w-4 mr-1" /> Nuevo producto
        </Button>
      </div>

      <Input
        placeholder="Buscar por nombre o SKU…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-xs"
      />

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3">Imagen</th>
                <th className="px-4 py-3">Producto</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3 text-right">Precio</th>
                <th className="px-4 py-3 text-right">Stock</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p: any) => (
                <tr key={p.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-3">
                    {p.imagen_url ? (
                      <img
                        src={p.imagen_public_id
                          ? cloudinaryUrl(p.imagen_public_id, { w: 48, h: 48 })
                          : p.imagen_url}
                        alt=""
                        className="w-12 h-12 object-cover rounded"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                        <Image className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium">{p.nombre}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono">{p.sku || "—"}</td>
                  <td className="px-4 py-3">
                    {p.categoria ? <Badge variant="outline">{p.categoria}</Badge> : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{fmt(Number(p.precio))}</td>
                  <td className="px-4 py-3 text-right">
                    <Badge variant={Number(p.stock) > 0 ? "default" : "destructive"}>
                      {p.stock ?? 0}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditItem({
                        id: p.id, nombre: p.nombre, descripcion: p.descripcion ?? "",
                        sku: p.sku ?? "", precio: String(p.precio), stock: String(p.stock ?? 0),
                        categoria: p.categoria ?? "", imagen_url: p.imagen_url ?? "",
                        imagen_public_id: p.imagen_public_id ?? "",
                      })}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm" variant="ghost"
                        onClick={() => { if (confirm("¿Eliminar producto?")) delMut.mutate(p.id); }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-muted-foreground">
                    Sin productos. ¡Crea el primero!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </Card>

      <Dialog open={editItem !== undefined} onOpenChange={(v) => !v && setEditItem(undefined)}>
        {editItem !== undefined && (
          <ProductFormModal initial={editItem} onClose={() => setEditItem(undefined)} />
        )}
      </Dialog>
    </div>
  );
}
