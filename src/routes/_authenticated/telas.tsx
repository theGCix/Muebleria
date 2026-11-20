// src/routes/_authenticated/telas.tsx
// Panel "Telas y tapizados": categorías y telas (nombre, foto, color base, con diseño) que ve el cliente en el selector 3D.
// Las fotos se recortan cuadradas (512 px, webp), se suben a Cloudinary y se propone el color base a partir de la foto.
import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, Palette, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, ListSkeleton } from "@/components/states";
import { uploadImage } from "@/lib/cloudinary";
import {
  eliminarCategoria, eliminarTela, guardarCategoria, guardarTela, listCatalogoAdmin, setActivoTela,
  type TelaAdmin,
} from "@/lib/telas.functions";

export const Route = createFileRoute("/_authenticated/telas")({
  head: () => ({ meta: [{ title: "Telas y tapizados — G&M" }] }),
  component: TelasAdminPage,
});

interface Form {
  id?: string;
  nombre: string;
  categoria_id: number;
  descripcion: string;
  imagen: string;
  hex: string;
  patron: boolean;
  activo: boolean;
}

const hex2 = (n: number) => Math.round(n).toString(16).padStart(2, "0");

/** Recorta la foto a cuadrado 512×512 (webp) y calcula su color promedio. */
async function prepararMuestra(file: File): Promise<{ archivo: File; hex: string }> {
  const bmp = await createImageBitmap(file);
  const lado = Math.min(bmp.width, bmp.height);
  const sx = (bmp.width - lado) / 2;
  const sy = (bmp.height - lado) / 2;
  const cv = document.createElement("canvas");
  cv.width = cv.height = 512;
  const cx = cv.getContext("2d", { willReadFrequently: true })!;
  cx.drawImage(bmp, sx, sy, lado, lado, 0, 0, 512, 512);
  bmp.close();

  // Color promedio sobre una versión pequeña
  const mini = document.createElement("canvas");
  mini.width = mini.height = 32;
  const mc = mini.getContext("2d", { willReadFrequently: true })!;
  mc.drawImage(cv, 0, 0, 32, 32);
  const px = mc.getImageData(0, 0, 32, 32).data;
  let r = 0, g = 0, b = 0;
  const n = px.length / 4;
  for (let i = 0; i < px.length; i += 4) { r += px[i]; g += px[i + 1]; b += px[i + 2]; }
  const hex = `#${hex2(r / n)}${hex2(g / n)}${hex2(b / n)}`;

  const blob: Blob = await new Promise((ok, ko) => cv.toBlob((x) => (x ? ok(x) : ko(new Error("No se pudo procesar la foto"))), "image/webp", 0.85));
  return { archivo: new File([blob], "tela.webp", { type: "image/webp" }), hex };
}

function TelasAdminPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<Form | null>(null);
  const [cat, setCat] = useState<{ id?: number; nombre: string } | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const lista = useQuery({ queryKey: ["telas-admin"], queryFn: listCatalogoAdmin });
  const categorias = lista.data?.categorias ?? [];
  const telas = lista.data?.telas ?? [];

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ["telas-admin"] });
    qc.invalidateQueries({ queryKey: ["telas-publico"] });
  };
  const onError = (e: Error) => toast.error(e.message);

  const guardar = useMutation({
    mutationFn: (f: Form) => guardarTela({ ...f }),
    onSuccess: () => { toast.success("Tela guardada"); setForm(null); refrescar(); },
    onError,
  });
  const activar = useMutation({ mutationFn: ({ id, v }: { id: string; v: boolean }) => setActivoTela(id, v), onSuccess: refrescar, onError });
  const borrar = useMutation({ mutationFn: (id: string) => eliminarTela(id), onSuccess: () => { toast.success("Tela eliminada"); refrescar(); }, onError });
  const guardarCat = useMutation({
    mutationFn: (c: { id?: number; nombre: string }) => guardarCategoria(c),
    onSuccess: () => { toast.success("Categoría guardada"); setCat(null); refrescar(); },
    onError,
  });
  const borrarCat = useMutation({ mutationFn: (id: number) => eliminarCategoria(id), onSuccess: () => { toast.success("Categoría eliminada"); refrescar(); }, onError });

  const nueva = (categoria_id: number): Form => ({ nombre: "", categoria_id, descripcion: "", imagen: "", hex: "#9e8a7f", patron: false, activo: true });
  const editar = (t: TelaAdmin): Form => ({
    id: t.id, nombre: t.nombre, categoria_id: t.categoria_id, descripcion: t.descripcion, imagen: t.imagen, hex: t.hex, patron: t.patron, activo: t.activo,
  });

  const subirFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!form || !file) return;
    setSubiendo(true);
    try {
      const { archivo, hex } = await prepararMuestra(file);
      const r = await uploadImage(archivo, "muebleria/telas");
      // El color base se propone desde la foto solo si es una tela nueva o si todavía no se tocó
      setForm((cur) => (cur ? { ...cur, imagen: r.secure_url, hex } : cur));
      toast.success("Foto subida. Revisa el color base.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo subir la foto");
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Telas y tapizados</h1>
          <p className="mt-0.5 max-w-xl text-sm text-muted-foreground">
            Lo que agregues aquí aparece en el selector de tapizado de la vista 3D y la sala virtual. Desactiva una tela
            en vez de borrarla si solo quieres ocultarla.
          </p>
        </div>
        <Button variant="outline" onClick={() => setCat({ nombre: "" })}>
          <Plus className="mr-1.5 h-4 w-4" /> Nueva categoría
        </Button>
      </div>

      {lista.isLoading ? (
        <ListSkeleton />
      ) : lista.isError ? (
        <EmptyState title="No se pudo cargar" description="Si es la primera vez, ejecuta la migración 20261120_catalogo_telas.sql en Supabase." />
      ) : categorias.length === 0 ? (
        <EmptyState icon={Palette} title="Aún no hay categorías" description="Crea una categoría para empezar a agregar telas." />
      ) : (
        categorias.map((c) => {
          const delaCat = telas.filter((t) => t.categoria_id === c.id);
          return (
            <section key={c.id} className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold">
                  {c.nombre} <span className="text-xs font-normal text-muted-foreground">({delaCat.length})</span>
                </h2>
                <div className="flex">
                  <Button size="sm" variant="ghost" onClick={() => setForm(nueva(c.id))}>
                    <Plus className="mr-1 h-4 w-4" /> Tela
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Renombrar categoría" onClick={() => setCat({ id: c.id, nombre: c.nombre })}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" aria-label="Eliminar categoría"
                    onClick={() => { if (window.confirm(`¿Eliminar la categoría «${c.nombre}»?`)) borrarCat.mutate(c.id); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {delaCat.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">Sin telas en esta categoría.</p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {delaCat.map((t) => (
                    <li key={t.id} className={`flex items-center gap-3 rounded-xl border border-border bg-card p-2.5 ${t.activo ? "" : "opacity-60"}`}>
                      <img src={t.imagen} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-lg border border-border bg-muted object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{t.nombre}</p>
                        <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                          <span className="inline-block h-3 w-3 shrink-0 rounded-full border border-border" style={{ background: t.hex }} aria-hidden />
                          {t.descripcion || "Sin descripción"}{t.patron ? " · con diseño" : ""}
                        </p>
                      </div>
                      <Switch checked={t.activo} aria-label="Activa" onCheckedChange={(v) => activar.mutate({ id: t.id, v })} />
                      <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Editar" onClick={() => setForm(editar(t))}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" aria-label="Eliminar"
                        onClick={() => { if (window.confirm(`¿Eliminar «${t.nombre}»? Si solo quieres ocultarla, desactívala.`)) borrar.mutate(t.id); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })
      )}

      {/* Categoría */}
      <Dialog open={!!cat} onOpenChange={(o) => !o && setCat(null)}>
        <DialogContent className="sm:max-w-sm">
          {cat && (
            <>
              <DialogHeader><DialogTitle>{cat.id ? "Renombrar categoría" : "Nueva categoría"}</DialogTitle></DialogHeader>
              <div className="space-y-1.5">
                <Label htmlFor="c-nombre">Nombre</Label>
                <Input id="c-nombre" maxLength={50} value={cat.nombre} onChange={(e) => setCat({ ...cat, nombre: e.target.value })} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCat(null)}>Cancelar</Button>
                <Button disabled={guardarCat.isPending || cat.nombre.trim().length < 2} onClick={() => guardarCat.mutate(cat)}>
                  {guardarCat.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Guardar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Tela */}
      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
          {form && (
            <>
              <DialogHeader><DialogTitle>{form.id ? "Editar tela" : "Nueva tela"}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <button
                    type="button"
                    disabled={subiendo}
                    onClick={() => inputRef.current?.click()}
                    aria-label="Subir foto de la tela"
                    className="relative flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted text-muted-foreground transition-colors hover:border-primary/50"
                  >
                    {form.imagen ? (
                      <img src={form.imagen} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex flex-col items-center text-xs"><ImagePlus className="mb-1 h-5 w-5" /> Subir foto</span>
                    )}
                    {subiendo && <span className="absolute inset-0 grid place-items-center bg-background/70"><Loader2 className="h-5 w-5 animate-spin" /></span>}
                  </button>
                  <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={subirFoto} />
                  <p className="text-xs text-muted-foreground">
                    Foto de cerca de la tela, sin sombras ni bordes. Se recorta cuadrada y se comprime sola. Al subirla se propone el color base.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="t-nombre">Nombre</Label>
                  <Input id="t-nombre" maxLength={60} placeholder="Ej. Velvet (Terciopelo)" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="t-cat">Categoría</Label>
                    <select id="t-cat" value={form.categoria_id} onChange={(e) => setForm({ ...form, categoria_id: Number(e.target.value) })}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                      {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="t-desc">Descripción corta</Label>
                    <Input id="t-desc" maxLength={80} placeholder="Ej. Suave y elegante" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="t-hex">Color base (con el que se pinta el sofá en 3D)</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" aria-label="Elegir color" value={/^#[0-9a-f]{6}$/i.test(form.hex) ? form.hex : "#9e8a7f"}
                      onChange={(e) => setForm({ ...form, hex: e.target.value })} className="h-10 w-12 cursor-pointer rounded-md border border-input bg-background p-1" />
                    <Input id="t-hex" maxLength={7} value={form.hex} onChange={(e) => setForm({ ...form, hex: e.target.value })} className="max-w-32 font-mono" />
                  </div>
                </div>

                <label className="flex items-start gap-2 text-sm">
                  <Switch checked={form.patron} onCheckedChange={(v) => setForm({ ...form, patron: v })} />
                  <span>Tela con diseño (estampada, floral, jacquard…)<span className="block text-xs text-muted-foreground">El 3D conserva todo el contraste de la muestra.</span></span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={form.activo} onCheckedChange={(v) => setForm({ ...form, activo: v })} />
                  Activa (visible para el cliente)
                </label>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
                <Button disabled={guardar.isPending || subiendo || !form.imagen || form.nombre.trim().length < 2} onClick={() => guardar.mutate(form)}>
                  {guardar.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Guardar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
