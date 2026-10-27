// src/routes/_authenticated/fotos-clientes.tsx
// Panel "Testimonios": fotos de clientes con sus muebles.
//  · Lo que envía el cliente al recibir su pedido llega como PENDIENTE y solo se publica si lo apruebas.
//  · También puedes cargar fotos tú mismo (quedan aprobadas).
// Se publican en la página pública /testimonios.
import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ImagePlus, Loader2, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, ListSkeleton } from "@/components/states";
import { uploadImage } from "@/lib/cloudinary";
import {
  eliminarGaleria, guardarGaleria, listGaleriaAdmin, listProductosBasico, moderarGaleria, setPublicadoGaleria,
  type GaleriaEstado, type GaleriaItem,
} from "@/lib/galeria.functions";

export const Route = createFileRoute("/_authenticated/fotos-clientes")({
  head: () => ({ meta: [{ title: "Testimonios — G&M" }] }),
  component: TestimoniosAdminPage,
});

const NINGUNO = "none";
const MAX_FOTOS = 6;

const TABS: { key: GaleriaEstado | "todas"; label: string }[] = [
  { key: "pendiente", label: "Por aprobar" },
  { key: "aprobada", label: "Aprobados" },
  { key: "rechazada", label: "Rechazados" },
  { key: "todas", label: "Todos" },
];

interface Form {
  id?: string;
  autor_nombre: string;
  fotos: string[];
  comentario: string;
  calificacion: string; // "none" | "1".."5"
  product_id: string; // "none" | id
  publicado: boolean;
}
const VACIO: Form = { autor_nombre: "", fotos: [], comentario: "", calificacion: NINGUNO, product_id: NINGUNO, publicado: true };

/** Miniatura liviana si la foto es de Cloudinary. */
const mini = (url: string, w = 400) =>
  url.includes("res.cloudinary.com") && url.includes("/upload/") && !/\/upload\/[a-z]_/.test(url)
    ? url.replace("/upload/", `/upload/w_${w},q_auto,f_auto/`)
    : url;

function TestimoniosAdminPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<GaleriaEstado | "todas">("pendiente");
  const [form, setForm] = useState<Form | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const lista = useQuery({ queryKey: ["galeria-admin"], queryFn: listGaleriaAdmin });
  const productos = useQuery({ queryKey: ["productos-basico"], queryFn: listProductosBasico, staleTime: 10 * 60_000 });

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ["galeria-admin"] });
    qc.invalidateQueries({ queryKey: ["galeria-publica"] });
    qc.invalidateQueries({ queryKey: ["sidebar-counts"] });
  };

  const guardar = useMutation({
    mutationFn: async (f: Form) => {
      const prod = productos.data?.find((p) => p.id === f.product_id);
      await guardarGaleria({
        id: f.id,
        autor_nombre: f.autor_nombre,
        fotos: f.fotos,
        comentario: f.comentario || null,
        calificacion: f.calificacion === NINGUNO ? null : Number(f.calificacion),
        product_id: prod?.id ?? null,
        producto_nombre: prod?.nombre ?? null,
        publicado: f.publicado,
      });
    },
    onSuccess: () => {
      toast.success("Testimonio guardado");
      setForm(null);
      refrescar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const moderar = useMutation({
    mutationFn: (v: { id: string; accion: "aprobar" | "rechazar"; motivo?: string }) => moderarGaleria(v),
    onSuccess: (_d, v) => {
      toast.success(v.accion === "aprobar" ? "Aprobado: ya se muestra en la web" : "Rechazado: no se mostrará");
      refrescar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const publicar = useMutation({
    mutationFn: ({ id, v }: { id: string; v: boolean }) => setPublicadoGaleria(id, v),
    onSuccess: refrescar,
    onError: (e: Error) => toast.error(e.message),
  });

  const borrar = useMutation({
    mutationFn: (id: string) => eliminarGaleria(id),
    onSuccess: () => {
      toast.success("Testimonio eliminado");
      refrescar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const subirFotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!form || files.length === 0) return;
    const cupo = MAX_FOTOS - form.fotos.length;
    if (cupo <= 0) return toast.error(`Máximo ${MAX_FOTOS} fotos por testimonio`);
    setSubiendo(true);
    try {
      const urls: string[] = [];
      for (const f of files.slice(0, cupo)) {
        const r = await uploadImage(f, "muebleria/testimonios");
        urls.push(r.secure_url);
      }
      setForm((cur) => (cur ? { ...cur, fotos: [...cur.fotos, ...urls] } : cur));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo subir la imagen");
    } finally {
      setSubiendo(false);
    }
  };

  const editar = (g: GaleriaItem) =>
    setForm({
      id: g.id,
      autor_nombre: g.autor_nombre,
      fotos: g.fotos,
      comentario: g.comentario ?? "",
      calificacion: g.calificacion ? String(g.calificacion) : NINGUNO,
      product_id: g.product_id ?? NINGUNO,
      publicado: g.publicado,
    });

  const todos = lista.data ?? [];
  const cuenta = useMemo(
    () => ({
      pendiente: todos.filter((g) => g.estado === "pendiente").length,
      aprobada: todos.filter((g) => g.estado === "aprobada").length,
      rechazada: todos.filter((g) => g.estado === "rechazada").length,
      todas: todos.length,
    }),
    [todos],
  );
  const items = tab === "todas" ? todos : todos.filter((g) => g.estado === tab);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Testimonios</h1>
          <p className="mt-0.5 max-w-xl text-sm text-muted-foreground">
            Las fotos que tus clientes envían al recibir su pedido llegan aquí y solo se publican si las apruebas. También
            puedes cargar fotos tú mismo.
          </p>
        </div>
        <Button onClick={() => setForm({ ...VACIO })}>
          <Plus className="mr-1.5 h-4 w-4" /> Agregar testimonio
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-pressed={tab === t.key}
            className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm transition-colors ${
              tab === t.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted"
            }`}
          >
            {t.label}
            <span className={`text-xs ${tab === t.key ? "opacity-80" : "text-muted-foreground"}`}>{cuenta[t.key]}</span>
          </button>
        ))}
      </div>

      {lista.isLoading ? (
        <ListSkeleton />
      ) : lista.isError ? (
        <EmptyState
          title="No se pudo cargar"
          description="Si es la primera vez, ejecuta la migración 20261028_testimonios_y_proyectos.sql en Supabase."
        />
      ) : items.length === 0 ? (
        <EmptyState
          title={tab === "pendiente" ? "No hay fotos por aprobar" : "No hay testimonios aquí"}
          description={tab === "pendiente" ? "Cuando un cliente envíe fotos de su pedido, aparecerán en esta pestaña." : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((g) => (
            <div key={g.id} className="overflow-hidden rounded-xl border border-border bg-card">
              <a href={g.fotos[0]} target="_blank" rel="noopener noreferrer" className="relative block aspect-[4/3] bg-muted">
                {g.fotos[0] && <img src={mini(g.fotos[0], 700)} alt="" loading="lazy" className="h-full w-full object-cover" />}
                <span className="absolute left-2 top-2 flex gap-1.5">
                  {g.estado === "pendiente" && <Badge className="bg-amber-500 text-white hover:bg-amber-500">Por aprobar</Badge>}
                  {g.estado === "rechazada" && <Badge variant="destructive">Rechazado</Badge>}
                  {g.origen === "cliente" && <Badge variant="secondary">Enviado por el cliente</Badge>}
                </span>
              </a>

              {g.fotos.length > 1 && (
                <div className="flex gap-1.5 overflow-x-auto p-2">
                  {g.fotos.slice(1).map((f, i) => (
                    <a key={f + i} href={f} target="_blank" rel="noopener noreferrer" className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-md bg-muted">
                      <img src={mini(f, 120)} alt="" loading="lazy" className="h-full w-full object-cover" />
                    </a>
                  ))}
                </div>
              )}

              <div className="space-y-2 p-3">
                <div>
                  <p className="truncate text-sm font-medium">{g.autor_nombre}</p>
                  <p className="truncate text-xs text-muted-foreground">{g.producto_nombre ?? "Sin mueble asignado"}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    {g.calificacion ? (
                      <>
                        <Star className="h-3 w-3 fill-current" /> {g.calificacion} ·{" "}
                      </>
                    ) : null}
                    {format(new Date(g.created_at), "d MMM yyyy, HH:mm", { locale: es })}
                  </p>
                </div>
                {g.comentario && <p className="line-clamp-3 text-sm text-muted-foreground">{g.comentario}</p>}
                {g.estado === "rechazada" && g.motivo_rechazo && (
                  <p className="text-xs text-destructive">Motivo: {g.motivo_rechazo}</p>
                )}

                {g.estado === "pendiente" ? (
                  <div className="flex gap-2 border-t border-border/60 pt-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      disabled={moderar.isPending}
                      onClick={() => moderar.mutate({ id: g.id, accion: "aprobar" })}
                    >
                      <Check className="mr-1 h-4 w-4" /> Aprobar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      disabled={moderar.isPending}
                      onClick={() => {
                        const motivo = window.prompt("Motivo del rechazo (opcional, solo lo ves tú):") ;
                        if (motivo === null) return;
                        moderar.mutate({ id: g.id, accion: "rechazar", motivo });
                      }}
                    >
                      <X className="mr-1 h-4 w-4" /> Rechazar
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Editar" onClick={() => editar(g)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2">
                    {g.estado === "aprobada" ? (
                      <label className="flex items-center gap-2 text-xs">
                        <Switch checked={g.publicado} onCheckedChange={(v) => publicar.mutate({ id: g.id, v })} />
                        {g.publicado ? "Publicado" : "Oculto"}
                      </label>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => moderar.mutate({ id: g.id, accion: "aprobar" })}>
                        <Check className="mr-1 h-4 w-4" /> Aprobar igual
                      </Button>
                    )}
                    <div className="flex">
                      <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Editar" onClick={() => editar(g)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        aria-label="Eliminar"
                        onClick={() => {
                          if (window.confirm(`¿Eliminar el testimonio de ${g.autor_nombre}?`)) borrar.mutate(g.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
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
                <DialogTitle>{form.id ? "Editar testimonio" : "Nuevo testimonio"}</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Fotos ({form.fotos.length}/{MAX_FOTOS})</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {form.fotos.map((f, i) => (
                      <div key={f + i} className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
                        <img src={mini(f, 240)} alt="" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          aria-label="Quitar foto"
                          onClick={() => setForm({ ...form, fotos: form.fotos.filter((_, k) => k !== i) })}
                          className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-background/90 shadow"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    {form.fotos.length < MAX_FOTOS && (
                      <button
                        type="button"
                        disabled={subiendo}
                        onClick={() => inputRef.current?.click()}
                        className="flex aspect-square flex-col items-center justify-center rounded-lg border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                      >
                        {subiendo ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                        <span className="mt-1 text-[10px]">{subiendo ? "Subiendo…" : "Agregar"}</span>
                      </button>
                    )}
                  </div>
                  <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={subirFotos} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="t-nombre">Nombre del cliente</Label>
                  <Input
                    id="t-nombre"
                    value={form.autor_nombre}
                    maxLength={80}
                    placeholder="Ej. María P."
                    onChange={(e) => setForm({ ...form, autor_nombre: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Mueble (opcional)</Label>
                  <Select value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Sin mueble asignado" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NINGUNO}>Sin mueble asignado</SelectItem>
                      {(productos.data ?? []).map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="t-comentario">Lo que dijo el cliente (opcional)</Label>
                  <Textarea
                    id="t-comentario"
                    rows={3}
                    maxLength={600}
                    value={form.comentario}
                    onChange={(e) => setForm({ ...form, comentario: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Calificación (opcional)</Label>
                    <Select value={form.calificacion} onValueChange={(v) => setForm({ ...form, calificacion: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NINGUNO}>Sin calificación</SelectItem>
                        {[5, 4, 3, 2, 1].map((n) => (
                          <SelectItem key={n} value={String(n)}>{n} {n === 1 ? "estrella" : "estrellas"}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <label className="flex items-end gap-2 pb-2 text-sm">
                    <Switch checked={form.publicado} onCheckedChange={(v) => setForm({ ...form, publicado: v })} />
                    Publicado
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Si lo que editas lo envió un cliente y sigue por aprobar, se publica recién cuando lo apruebas.
                </p>
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