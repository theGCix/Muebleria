// src/components/admin/EvidenciasPedido.tsx
// Sección opcional del diálogo de pedido: el equipo sube fotos del avance según el estado actual.
// Flujo: elegir fotos → vista previa → (nota + aviso opcional) → Guardar o Cancelar.
import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cloudinaryUrl } from "@/lib/cloudinary";
import {
  ESTADO_LABEL, MAX_FOTO_MB, agruparPorEstado, useBorrarEvidencia, useEvidencias, useSubirEvidencias,
} from "@/hooks/useEvidencias";

const MAX_POR_ENVIO = 6;

interface Props {
  order: {
    id: string;
    order_number: string;
    status: string;
    email?: string | null;
    nombre?: string | null;
  };
}

const fmtFecha = (d: string) =>
  new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(d));

const miniatura = (e: { foto_url: string; public_id: string | null }) =>
  e.public_id ? cloudinaryUrl(e.public_id, { w: 400 }) : e.foto_url;

export function EvidenciasPedido({ order }: Props) {
  const { data: evidencias = [], isLoading } = useEvidencias(order.id);
  const subir = useSubirEvidencias();
  const borrar = useBorrarEvidencia(order.id);
  const inputRef = useRef<HTMLInputElement>(null);

  const [pendientes, setPendientes] = useState<File[]>([]);
  const [nota, setNota] = useState("");
  const [avisar, setAvisar] = useState(false);

  // Vistas previas locales (aún no se sube nada a Cloudinary)
  const previews = useMemo(() => pendientes.map((f) => URL.createObjectURL(f)), [pendientes]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const limpiar = () => {
    setPendientes([]);
    setNota("");
    setAvisar(false);
  };

  const onFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    const validas = files.filter((f) => {
      if (f.size > MAX_FOTO_MB * 1024 * 1024) {
        toast.error(`"${f.name}" pesa más de ${MAX_FOTO_MB} MB`);
        return false;
      }
      return true;
    });
    setPendientes((cur) => {
      const todas = [...cur, ...validas];
      if (todas.length > MAX_POR_ENVIO) toast.error(`Máximo ${MAX_POR_ENVIO} fotos por envío`);
      return todas.slice(0, MAX_POR_ENVIO);
    });
  };

  const guardar = () => {
    subir.mutate(
      {
        orderId: order.id,
        orderNumber: order.order_number,
        estado: order.status,
        files: pendientes,
        nota,
        avisar,
        email: order.email,
        nombre: order.nombre,
      },
      {
        onSuccess: (n) => {
          limpiar();
          toast.success(n === 1 ? "Foto publicada para el cliente" : `${n} fotos publicadas para el cliente`);
        },
        onError: (err: Error) => toast.error(err.message),
      },
    );
  };

  const grupos = agruparPorEstado(evidencias);
  const hayPendientes = pendientes.length > 0;

  return (
    <section className="space-y-3">
      <div>
        <h3 className="font-semibold text-sm">Evidencia fotográfica (opcional)</h3>
        <p className="text-xs text-muted-foreground">
          Las fotos se guardan con el estado actual: <b>{ESTADO_LABEL[order.status] ?? order.status}</b>. Al guardar, el cliente las verá en su perfil.
        </p>
      </div>

      <div className="space-y-3 rounded-lg border border-dashed border-border p-3">
        <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={onFiles} />

        {hayPendientes && (
          <>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {previews.map((src, i) => (
                <div key={src} className="relative overflow-hidden rounded-lg border bg-muted/30">
                  <img src={src} alt={`Vista previa ${i + 1}`} className="aspect-square w-full object-cover" />
                  <button
                    type="button"
                    title="Quitar"
                    disabled={subir.isPending}
                    onClick={() => setPendientes((cur) => cur.filter((_, j) => j !== i))}
                    className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>

            <Textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Nota para el cliente (opcional). Ej: Ya está armado el marco, falta el barniz."
              rows={2}
              maxLength={300}
              disabled={subir.isPending}
            />

            {order.email && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`avisar-${order.id}`}
                  checked={avisar}
                  disabled={subir.isPending}
                  onCheckedChange={(v) => setAvisar(v === true)}
                />
                <Label htmlFor={`avisar-${order.id}`} className="cursor-pointer text-xs">
                  Avisar al cliente por correo
                </Label>
              </div>
            )}
          </>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {hayPendientes ? (
            <>
              <Button type="button" size="sm" disabled={subir.isPending} onClick={guardar}>
                {subir.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {subir.isPending
                  ? "Guardando…"
                  : `Guardar ${pendientes.length === 1 ? "foto" : `${pendientes.length} fotos`}`}
              </Button>
              <Button type="button" size="sm" variant="ghost" disabled={subir.isPending} onClick={limpiar}>
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={subir.isPending || pendientes.length >= MAX_POR_ENVIO}
                onClick={() => inputRef.current?.click()}
              >
                <Camera className="mr-2 h-4 w-4" /> Agregar otra
              </Button>
            </>
          ) : (
            <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
              <Camera className="mr-2 h-4 w-4" /> Agregar foto
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        grupos.map(([estado, fotos]) => (
          <div key={estado}>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">{ESTADO_LABEL[estado] ?? estado}</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {fotos.map((f) => (
                <figure key={f.id} className="group relative overflow-hidden rounded-lg border bg-muted/30">
                  <a href={f.foto_url} target="_blank" rel="noreferrer">
                    <img src={miniatura(f)} alt={f.nota ?? "Evidencia"} className="aspect-square w-full object-cover" loading="lazy" />
                  </a>
                  <button
                    type="button"
                    title="Eliminar foto"
                    disabled={borrar.isPending}
                    onClick={() => {
                      if (confirm("¿Eliminar esta foto? El cliente dejará de verla.")) {
                        borrar.mutate(f.id, { onError: (e: Error) => toast.error(e.message) });
                      }
                    }}
                    className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                  <figcaption className="px-1.5 py-1 text-[10px] leading-tight text-muted-foreground">
                    {fmtFecha(f.created_at)}
                    {f.nota && <span className="block text-foreground">{f.nota}</span>}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        ))
      )}
    </section>
  );
}