// src/routes/_authenticated/gestionar-proyectos.tsx
// Panel "Proyectos": piezas especiales e innovaciones fabricadas por G&M. Se muestran en la página pública /proyectos.
import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, ListSkeleton } from "@/components/states";
import { uploadImage } from "@/lib/cloudinary";
import {
  eliminarProyecto, guardarProyecto, listProyectosAdmin, setPublicadoProyecto, type ProyectoAdmin,
} from "@/lib/proyectos.functions";

export const Route = createFileRoute("/_authenticated/gestionar-proyectos")({
  head: () => ({ meta: [{ title: "Proyectos — G&M" }] }),
  component: ProyectosAdminPage,
});

const MAX_FOTOS = 8;

interface Form {
  id?: string;
  titulo: string;
  descripcion: string;
  etiqueta: string;
  anio: string;
  fotos: string[];
  destacado: boolean;
  publicado: boolean;
  distrito: string;
  tiempo_ejecucion: string;
  /** Materiales separados por coma. */
  materiales: string;
  fotos_antes: string[];
  fotos_despues: string[];
  autorizacion_cliente: boolean;
}
const VACIO: Form = {
  titulo: "", descripcion: "", etiqueta: "", anio: String(new Date().getFullYear()), fotos: [], destacado: false, publicado: true,
  distrito: "", tiempo_ejecucion: "", materiales: "", fotos_antes: [], fotos_despues: [], autorizacion_cliente: false,
};

type CampoFotos = "fotos" | "fotos_antes" | "fotos_despues";
const MAX_ANTES_DESPUES = 4;
const GRUPOS_FOTOS: { campo: CampoFotos; titulo: string; max: number; ayuda: string }[] = [
  { campo: "fotos", titulo: "Fotos del proyecto", max: MAX_FOTOS, ayuda: "la primera es la portada" },
  { campo: "fotos_antes", titulo: "Antes (opcional)", max: MAX_ANTES_DESPUES, ayuda: "cómo estaba el espacio" },
  { campo: "fotos_despues", titulo: "Después (opcional)", max: MAX_ANTES_DESPUES, ayuda: "cómo quedó" },
];

const mini = (url: string, w = 400) =>
  url.includes("res.cloudinary.com") && url.includes("/upload/") && !/\/upload\/[a-z]_/.test(url)
    ? url.replace("/upload/", `/upload/w_${w},q_auto,f_auto/`)
    : url;

function ProyectosAdminPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<Form | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const campoRef = useRef<CampoFotos>("fotos");

  const lista = useQuery({ queryKey: ["proyectos-admin"], queryFn: listProyectosAdmin });

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ["proyectos-admin"] });
    qc.invalidateQueries({ queryKey: ["proyectos-publicos"] });
  };

  const guardar = useMutation({
    mutationFn: (f: Form) =>
      guardarProyecto({
        id: f.id,
        titulo: f.titulo,
        descripcion: f.descripcion || null,
        etiqueta: f.etiqueta || null,
        anio: f.anio ? Number(f.anio) : null,
        fotos: f.fotos,
        destacado: f.destacado,
        publicado: f.publicado,
        distrito: f.distrito.trim() || null,
        tiempo_ejecucion: f.tiempo_ejecucion.trim() || null,
        materiales: f.materiales.split(",").map((m) => m.trim()).filter(Boolean),
        fotos_antes: f.fotos_antes,
        fotos_despues: f.fotos_despues,
        autorizacion_cliente: f.autorizacion_cliente,
      }),
    onSuccess: () => {
      toast.success("Proyecto guardado");
      setForm(null);
      refrescar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const publicar = useMutation({
    mutationFn: ({ id, v }: { id: string; v: boolean }) => setPublicadoProyecto(id, v),
    onSuccess: refrescar,
    onError: (e: Error) => toast.error(e.message),
  });

  const borrar = useMutation({
    mutationFn: (id: string) => eliminarProyecto(id),
    onSuccess: () => {
      toast.success("Proyecto eliminado");
      refrescar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const subirFotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!form || files.length === 0) return;
    const campo = campoRef.current;
    const max = campo === "fotos" ? MAX_FOTOS : MAX_ANTES_DESPUES;
    const cupo = max - form[campo].length;
    if (cupo <= 0) return toast.error(`Máximo ${max} fotos en este grupo`);
    setSubiendo(true);
    try {
      const urls: string[] = [];
      for (const f of files.slice(0, cupo)) {
        const r = await uploadImage(f, "muebleria/proyectos");
        urls.push(r.secure_url);
      }
      setForm((cur) => (cur ? { ...cur, [campo]: [...cur[campo], ...urls] } : cur));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo subir la imagen");
    } finally {
      setSubiendo(false);
    }
  };

  const editar = (p: ProyectoAdmin) =>
    setForm({
      id: p.id,
      titulo: p.titulo,
      descripcion: p.descripcion ?? "",
      etiqueta: p.etiqueta ?? "",
      anio: p.anio ? String(p.anio) : "",
      fotos: p.fotos,
      destacado: p.destacado,
      publicado: p.publicado,
      distrito: p.distrito ?? "",
      tiempo_ejecucion: p.tiempo_ejecucion ?? "",
      materiales: (p.materiales ?? []).join(", "),
      fotos_antes: p.fotos_antes ?? [],
      fotos_despues: p.fotos_despues ?? [],
      autorizacion_cliente: !!p.autorizacion_cliente,
    });

  const items = lista.data ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Proyectos</h1>
          <p className="mt-0.5 max-w-xl text-sm text-muted-foreground">
            Proyectos realizados por G&M: solo trabajos reales. Se muestran en la página pública Proyectos cuando hay al menos uno publicado.
          </p>
        </div>
        <Button onClick={() => setForm({ ...VACIO })}>
          <Plus className="mr-1.5 h-4 w-4" /> Agregar proyecto
        </Button>
      </div>

      {lista.isLoading ? (
        <ListSkeleton />
      ) : lista.isError ? (
        <EmptyState
          title="No se pudo cargar"
          description="Si es la primera vez, ejecuta en Supabase la migración 20261028_testimonios_y_proyectos.sql."
        />
      ) : items.length === 0 ? (
        <EmptyState icon={Sparkles} title="Aún no hay proyectos" description="Agrega la primera pieza que fabricaron con una idea nueva." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <div key={p.id} className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="relative aspect-[4/3] bg-muted">
                {p.fotos[0] && <img src={mini(p.fotos[0], 700)} alt="" loading="lazy" className="h-full w-full object-cover" />}
                <span className="absolute left-2 top-2 flex gap-1.5">
                  {p.destacado && <Badge>Destacado</Badge>}
                  {p.etiqueta && <Badge variant="secondary">{p.etiqueta}</Badge>}
                </span>
              </div>
              <div className="space-y-2 p-3">
                <div>
                  <p className="truncate text-sm font-medium">{p.titulo}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.anio ?? "Sin año"} · {p.fotos.length} {p.fotos.length === 1 ? "foto" : "fotos"}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2">
                  <label className="flex items-center gap-2 text-xs">
                    <Switch checked={p.publicado} onCheckedChange={(v) => publicar.mutate({ id: p.id, v })} />
                    {p.publicado ? "Publicado" : "Oculto"}
                  </label>
                  <div className="flex">
                    <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Editar" onClick={() => editar(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      aria-label="Eliminar"
                      onClick={() => {
                        if (window.confirm(`¿Eliminar el proyecto "${p.titulo}"?`)) borrar.mutate(p.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
          {form && (
            <>
              <DialogHeader>
                <DialogTitle>{form.id ? "Editar proyecto" : "Nuevo proyecto"}</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {GRUPOS_FOTOS.map((g) => (
                  <div key={g.campo} className="space-y-2">
                    <Label>
                      {g.titulo} ({form[g.campo].length}/{g.max}) · {g.ayuda}
                    </Label>
                    <div className="grid grid-cols-4 gap-2">
                      {form[g.campo].map((u, i) => (
                        <div key={u + i} className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
                          <img src={mini(u, 240)} alt="" className="h-full w-full object-cover" />
                          <button
                            type="button"
                            aria-label="Quitar foto"
                            onClick={() => setForm({ ...form, [g.campo]: form[g.campo].filter((_, k) => k !== i) })}
                            className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-background/90 shadow"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                      {form[g.campo].length < g.max && (
                        <button
                          type="button"
                          disabled={subiendo}
                          onClick={() => {
                            campoRef.current = g.campo;
                            inputRef.current?.click();
                          }}
                          className="flex aspect-square flex-col items-center justify-center rounded-lg border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                        >
                          {subiendo && campoRef.current === g.campo ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                          <span className="mt-1 text-[10px]">{subiendo && campoRef.current === g.campo ? "Subiendo…" : "Agregar"}</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={subirFotos} />

                <div className="space-y-1.5">
                  <Label htmlFor="p-titulo">Título</Label>
                  <Input id="p-titulo" value={form.titulo} maxLength={120} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="p-etiqueta">Etiqueta (opcional)</Label>
                    <Input
                      id="p-etiqueta"
                      value={form.etiqueta}
                      maxLength={40}
                      placeholder="Ej. Innovación"
                      onChange={(e) => setForm({ ...form, etiqueta: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="p-anio">Año</Label>
                    <Input
                      id="p-anio"
                      inputMode="numeric"
                      maxLength={4}
                      value={form.anio}
                      onChange={(e) => setForm({ ...form, anio: e.target.value.replace(/\D/g, "") })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="p-distrito">Distrito (opcional)</Label>
                    <Input
                      id="p-distrito"
                      value={form.distrito}
                      maxLength={60}
                      placeholder="Ej. Los Olivos"
                      onChange={(e) => setForm({ ...form, distrito: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="p-tiempo">Tiempo de ejecución (opcional)</Label>
                    <Input
                      id="p-tiempo"
                      value={form.tiempo_ejecucion}
                      maxLength={40}
                      placeholder="Ej. 2 semanas"
                      onChange={(e) => setForm({ ...form, tiempo_ejecucion: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="p-materiales">Materiales utilizados (opcional)</Label>
                  <Input
                    id="p-materiales"
                    value={form.materiales}
                    placeholder="Separados por coma. Ej. Madera tornillo, Velvet, Herrajes"
                    onChange={(e) => setForm({ ...form, materiales: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="p-desc">Qué lo hace especial (opcional)</Label>
                  <Textarea
                    id="p-desc"
                    rows={4}
                    maxLength={1500}
                    value={form.descripcion}
                    placeholder="Cuenta la idea, el reto y cómo lo resolvieron en el taller."
                    onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  />
                </div>

                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={form.publicado} onCheckedChange={(v) => setForm({ ...form, publicado: v })} />
                    Publicado
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={form.destacado} onCheckedChange={(v) => setForm({ ...form, destacado: v })} />
                    Destacado (va primero)
                  </label>
                </div>
                <label className="flex items-start gap-2 rounded-lg border border-border/60 p-3 text-sm">
                  <Switch
                    checked={form.autorizacion_cliente}
                    onCheckedChange={(v) => setForm({ ...form, autorizacion_cliente: v })}
                    className="mt-0.5"
                  />
                  <span>
                    El cliente autorizó mostrar su distrito y las fotos antes/después
                    <span className="block text-xs text-muted-foreground">
                      Sin esta confirmación, el distrito y las fotos antes/después no se publican en la web.
                    </span>
                  </span>
                </label>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
                <Button disabled={guardar.isPending || subiendo} onClick={() => guardar.mutate(form)}>
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