import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Pencil, Trash2, Image } from "lucide-react";
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

// ─── Tipos ───────────────────────────────────────────────────────────────────

type ProductImage = {
  url: string;
  public_id: string;
};

type ProductForm = {
  id?: string;
  nombre: string;
  descripcion: string;
  sku: string;
  precio: string;
  stock: string;
  categoria: string;
  // Campos legacy (se mantienen sincronizados con imagenes[0])
  imagen_url: string;
  imagen_public_id: string;
  // Galería completa
  imagenes: ProductImage[];
};

const emptyForm = (): ProductForm => ({
  nombre: "", descripcion: "", sku: "", precio: "",
  stock: "", categoria: "",
  imagen_url: "", imagen_public_id: "",
  imagenes: [],
});

// ─── Helpers Supabase ─────────────────────────────────────────────────────────

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

// ─── Modal de formulario ──────────────────────────────────────────────────────

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

  const set = (k: keyof ProductForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const MAX_IMAGES = 7;

  // Sube una o varias imágenes secuencialmente
  const handleMultiUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    // Reset input para permitir seleccionar el mismo archivo de nuevo
    e.target.value = "";

    // Calcular cuántos slots quedan
    const available = MAX_IMAGES - form.imagenes.length;
    if (available <= 0) {
      toast.error(`Máximo ${MAX_IMAGES} imágenes permitidas`);
      return;
    }
    const filesToUpload = files.slice(0, available);
    if (files.length > available) {
      toast.warning(`Solo se subirán ${available} imagen(es) — límite de ${MAX_IMAGES}`);
    }

    setUploading(true);
    try {
      for (const file of filesToUpload) {
        const result = await uploadImage(file, "muebleria/productos");
        setForm((f) => {
          const updated = [...f.imagenes, { url: result.secure_url, public_id: result.public_id }];
          return {
            ...f,
            imagenes: updated,
            // La primera imagen siempre sincroniza los campos legacy
            imagen_url: updated[0].url,
            imagen_public_id: updated[0].public_id,
          };
        });
      }
      toast.success(filesToUpload.length > 1 ? `${filesToUpload.length} imágenes subidas` : "Imagen subida correctamente");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  // Elimina una imagen de la galería por índice
  const removeImage = (idx: number) => {
    setForm((f) => {
      const updated = f.imagenes.filter((_, i) => i !== idx);
      return {
        ...f,
        imagenes: updated,
        imagen_url: updated[0]?.url ?? "",
        imagen_public_id: updated[0]?.public_id ?? "",
      };
    });
  };

  // Mueve una imagen a la posición 0 (imagen principal)
  const setMainImage = (idx: number) => {
    if (idx === 0) return;
    setForm((f) => {
      const updated = [...f.imagenes];
      const [moved] = updated.splice(idx, 1);
      updated.unshift(moved);
      return {
        ...f,
        imagenes: updated,
        imagen_url: updated[0].url,
        imagen_public_id: updated[0].public_id,
      };
    });
  };

  const saveMut = useMutation({
    mutationFn: () =>
      upsertProduct({
        ...form,
        precio: parseFloat(form.precio),
        stock: parseInt(form.stock, 10),
        imagenes: form.imagenes,
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

        {/* ── Galería de imágenes ── */}
        <div>
          <Label>Imágenes</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {form.imagenes.map((img, idx) => (
              <div
                key={idx}
                className="relative group w-20 h-20 cursor-pointer"
                title={idx === 0 ? "Imagen principal" : "Clic para hacer principal"}
                onClick={() => setMainImage(idx)}
              >
                <img
                  src={img.public_id
                    ? cloudinaryUrl(img.public_id, { w: 80, h: 80 })
                    : img.url}
                  alt=""
                  className={`w-20 h-20 object-cover rounded border-2 transition-all ${
                    idx === 0 ? "border-primary" : "border-transparent group-hover:border-primary/50"
                  }`}
                />
                {/* Badge principal */}
                {idx === 0 && (
                  <span className="absolute bottom-0 left-0 right-0 text-center text-[10px] bg-primary/80 text-primary-foreground rounded-b py-0.5 leading-tight">
                    Principal
                  </span>
                )}
                {/* Botón eliminar */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeImage(idx); }}
                  className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}

            {/* Botón agregar más fotos — oculto al llegar al límite */}
            {form.imagenes.length < MAX_IMAGES && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-20 h-20 rounded border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
              >
                {uploading
                  ? <Loader2 className="h-5 w-5 animate-spin" />
                  : <Plus className="h-5 w-5" />}
                <span className="text-[10px] mt-1">{uploading ? "Subiendo…" : "Agregar"}</span>
              </button>
            )}

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleMultiUpload}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            JPG, PNG, WEBP · Máx. {MAX_IMAGES} imágenes · Clic para hacer principal · Hover para eliminar
            {form.imagenes.length >= MAX_IMAGES && (
              <span className="text-amber-600 font-medium"> · Límite alcanzado</span>
            )}
          </p>
        </div>

        {/* ── Campos del producto ── */}
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
          <Button
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending || !form.nombre || !form.precio}
          >
            {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Guardar
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

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
    !search ||
    p.nombre?.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase())
  );

  // Normaliza las imagenes de un producto de BD al tipo ProductImage[]
  const parseImagenes = (p: any): ProductImage[] => {
    if (Array.isArray(p.imagenes) && p.imagenes.length > 0) return p.imagenes;
    if (p.imagen_url) return [{ url: p.imagen_url, public_id: p.imagen_public_id ?? "" }];
    return [];
  };

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
          <div className="overflow-x-auto -mx-px">
            <table className="w-full min-w-[600px] text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-3">Imágenes</th>
                  <th className="px-4 py-3">Producto</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Categoría</th>
                  <th className="px-4 py-3 text-right">Precio</th>
                  <th className="px-4 py-3 text-right">Stock</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p: any) => {
                  const imgs = parseImagenes(p);
                  return (
                    <tr key={p.id} className="border-t hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {imgs.length > 0 ? (
                            <>
                              {/* Miniatura principal */}
                              <img
                                src={imgs[0].public_id
                                  ? cloudinaryUrl(imgs[0].public_id, { w: 48, h: 48 })
                                  : imgs[0].url}
                                alt=""
                                className="w-12 h-12 object-cover rounded"
                              />
                              {/* Contador de fotos adicionales */}
                              {imgs.length > 1 && (
                                <div className="w-12 h-12 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground font-medium">
                                  +{imgs.length - 1}
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                              <Image className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                        </div>
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
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditItem({
                              id: p.id,
                              nombre: p.nombre,
                              descripcion: p.descripcion ?? "",
                              sku: p.sku ?? "",
                              precio: String(p.precio),
                              stock: String(p.stock ?? 0),
                              categoria: p.categoria ?? "",
                              imagen_url: p.imagen_url ?? "",
                              imagen_public_id: p.imagen_public_id ?? "",
                              imagenes: parseImagenes(p),
                            })}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { if (confirm("¿Eliminar producto?")) delMut.mutate(p.id); }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-muted-foreground">
                      Sin productos. ¡Crea el primero!
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
          <ProductFormModal initial={editItem} onClose={() => setEditItem(undefined)} />
        )}
      </Dialog>
    </div>
  );
}