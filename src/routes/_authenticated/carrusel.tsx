// src/routes/_authenticated/carrusel.tsx
// Panel "Carrusel del home": diapositivas manuales (foto + texto opcional + enlace opcional).
// Se muestran ANTES de las automáticas (combo, salas, a medida), que siguen funcionando igual.
import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, CalendarClock, ImagePlus, Loader2, Pencil, Plus, Trash2, GalleryHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, ListSkeleton } from "@/components/states";
import { uploadImage } from "@/lib/cloudinary";
import { slideImg } from "@/hooks/useCarruselHome";
import {
  eliminarSlide, guardarOrden, guardarSlide, listSlidesAdmin, setPublicadoSlide, type SlideAdmin,
} from "@/lib/carrusel.functions";

export const Route = createFileRoute("/_authenticated/carrusel")({
  head: () => ({ meta: [{ title: "Carrusel — G&M" }] }),
  component: CarruselAdminPage,
});

const MAX_SLIDES = 8;

interface Form {
  id?: string;
  imagen_url: string;
  etiqueta: string;
  titulo: string;
  bajada: string;
  cta: string;
  enlace: string;
  publicado: boolean;
  desde: string; // datetime-local
  hasta: string;
}
const VACIO: Form = {
  imagen_url: "", etiqueta: "", titulo: "", bajada: "", cta: "", enlace: "", publicado: true, desde: "", hasta: "",
};

// ISO (UTC) -> valor para <input type="datetime-local"> en hora local
const aLocal = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

function estado(s: SlideAdmin): string {
  const ahora = Date.now();
  if (!s.publicado) return "Oculta";
  if (s.desde && new Date(s.desde).getTime() > ahora) return "Programada";
  if (s.hasta && new Date(s.hasta).getTime() < ahora) return "Vencida";
  return "Visible";
}

function CarruselAdminPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<Form | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const lista = useQuery({ queryKey: ["carrusel-admin"], queryFn: listSlidesAdmin });
  const items = lista.data ?? [];

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ["carrusel-admin"] });
    qc.invalidateQueries({ queryKey: ["carrusel-publico"] });
  };

  const guardar = useMutation({
    mutationFn: (f: Form) =>
      guardarSlide(
        {
          id: f.id,
          imagen_url: f.imagen_url,
          etiqueta: f.etiqueta || null,
          titulo: f.titulo || null,
          bajada: f.bajada || null,
          cta: f.cta || null,
          enlace: f.enlace || null,
          publicado: f.publicado,
          desde: f.desde || null,
          hasta: f.hasta || null,
        },
        items.length ? Math.max(...items.map((i) => i.orden)) + 1 : 0,
      ),
    onSuccess: () => {
      toast.success("Diapositiva guardada");
      setForm(null);
      refrescar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const publicar = useMutation({
    mutationFn: ({ id, v }: { id: string; v: boolean }) => setPublicadoSlide(id, v),
    onSuccess: refrescar,
    onError: (e: Error) => toast.error(e.message),
  });

  const mover = useMutation({
    mutationFn: ({ i, dir }: { i: number; dir: -1 | 1 }) => {
      const ids = items.map((s) => s.id);
      [ids[i], ids[i + dir]] = [ids[i + dir], ids[i]];
      return guardarOrden(ids);
    },
    onSuccess: refrescar,
    onError: (e: Error) => toast.error(e.message),
  });

  const borrar = useMutation({
    mutationFn: (id: string) => eliminarSlide(id),
    onSuccess: () => {
      toast.success("Diapositiva eliminada");
      refrescar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const subirFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!form || !file) return;
    setSubiendo(true);
    try {
      const r = await uploadImage(file, "muebleria/carrusel");
      setForm((cur) => (cur ? { ...cur, imagen_url: r.secure_url } : cur));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo subir la imagen");
    } finally {
      setSubiendo(false);
    }
  };

  const editar = (s: SlideAdmin) =>
    setForm({
      id: s.id,
      imagen_url: s.imagen_url,
      etiqueta: s.etiqueta ?? "",
      titulo: s.titulo ?? "",
      bajada: s.bajada ?? "",
      cta: s.cta ?? "",
      enlace: s.enlace ?? "",
      publicado: s.publicado,
      desde: aLocal(s.desde),
      hasta: aLocal(s.hasta),
    });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Carrusel del home</h1>
          <p className="mt-0.5 max-w-xl text-sm text-muted-foreground">
            Las diapositivas que agregues aquí aparecen primero. Las automáticas (combo destacado, juegos de sala y
            “a medida”) se siguen mostrando después. Medida recomendada: 1600 × 700 px.
          </p>
        </div>
        <Button disabled={items.length >= MAX_SLIDES} onClick={() => setForm({ ...VACIO })}>
          <Plus className="mr-1.5 h-4 w-4" /> Agregar diapositiva
        </Button>
      </div>

      {lista.isLoading ? (
        <ListSkeleton />
      ) : lista.isError ? (
        <EmptyState
          title="No se pudo cargar"
          description="Si es la primera vez, ejecuta la migración 20261028_carrusel_slides.sql en Supabase."
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={GalleryHorizontal}
          title="Aún no hay diapositivas manuales"
          description="Mientras tanto, el home muestra solo las automáticas."
        />
      ) : (
        <ul className="space-y-3">
          {items.map((s, i) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
              <img
                src={slideImg(s.imagen_url, 400)}
                alt=""
                loading="lazy"
                className="h-16 w-36 shrink-0 rounded-lg bg-muted object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{s.titulo || "(solo imagen)"}</p>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {estado(s)}
                  {(s.desde || s.hasta) && <CalendarClock className="h-3.5 w-3.5" aria-label="Con fechas" />}
                  {s.enlace && <span className="truncate">· {s.enlace}</span>}
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <Switch checked={s.publicado} onCheckedChange={(v) => publicar.mutate({ id: s.id, v })} />
                Publicada
              </label>
              <div className="flex">
                <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Subir"
                  disabled={i === 0 || mover.isPending} onClick={() => mover.mutate({ i, dir: -1 })}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Bajar"
                  disabled={i === items.length - 1 || mover.isPending} onClick={() => mover.mutate({ i, dir: 1 })}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Editar" onClick={() => editar(s)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" aria-label="Eliminar"
                  onClick={() => { if (window.confirm("¿Eliminar esta diapositiva?")) borrar.mutate(s.id); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
          {form && (
            <>
              <DialogHeader>
                <DialogTitle>{form.id ? "Editar diapositiva" : "Nueva diapositiva"}</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Imagen</Label>
                  <button
                    type="button"
                    disabled={subiendo}
                    onClick={() => inputRef.current?.click()}
                    className="relative flex aspect-[16/7] w-full items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-border bg-muted text-muted-foreground transition-colors hover:border-primary/50"
                  >
                    {form.imagen_url ? (
                      <img src={slideImg(form.imagen_url, 800)} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex flex-col items-center text-xs">
                        <ImagePlus className="mb-1 h-5 w-5" /> Subir imagen
                      </span>
                    )}
                    {subiendo && (
                      <span className="absolute inset-0 grid place-items-center bg-background/70">
                        <Loader2 className="h-5 w-5 animate-spin" />
                      </span>
                    )}
                  </button>
                  <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={subirFoto} />
                </div>

                <p className="text-xs text-muted-foreground">
                  Texto y botón son opcionales. Si dejas el título vacío, se muestra solo la imagen.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="s-etiqueta">Etiqueta</Label>
                    <Input id="s-etiqueta" maxLength={40} placeholder="Ej. Día del mueble" value={form.etiqueta}
                      onChange={(e) => setForm({ ...form, etiqueta: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="s-cta">Texto del botón</Label>
                    <Input id="s-cta" maxLength={30} placeholder="Ej. Ver ofertas" value={form.cta}
                      onChange={(e) => setForm({ ...form, cta: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="s-titulo">Título</Label>
                  <Input id="s-titulo" maxLength={90} value={form.titulo}
                    onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="s-bajada">Bajada</Label>
                  <Input id="s-bajada" maxLength={160} value={form.bajada}
                    onChange={(e) => setForm({ ...form, bajada: e.target.value })} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="s-enlace">Enlace del botón</Label>
                  <Input id="s-enlace" maxLength={300} placeholder="/catalogo, /categoria/muebles o #a-medida"
                    value={form.enlace} onChange={(e) => setForm({ ...form, enlace: e.target.value })} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="s-desde">Mostrar desde (opcional)</Label>
                    <Input id="s-desde" type="datetime-local" value={form.desde}
                      onChange={(e) => setForm({ ...form, desde: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="s-hasta">Mostrar hasta (opcional)</Label>
                    <Input id="s-hasta" type="datetime-local" value={form.hasta}
                      onChange={(e) => setForm({ ...form, hasta: e.target.value })} />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={form.publicado} onCheckedChange={(v) => setForm({ ...form, publicado: v })} />
                  Publicada
                </label>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
                <Button disabled={guardar.isPending || subiendo || !form.imagen_url} onClick={() => guardar.mutate(form)}>
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
