// src/components/EvidenciasCliente.tsx
// Vista del cliente (/perfil/pedidos): fotos del avance de su mueble, en una tira compacta.
// Al tocar una miniatura se abre en grande, con flechas (y teclado) para pasar a la siguiente.
// No renderiza nada si el equipo no subió fotos.
import { useEffect, useState } from "react";
import { Camera, ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { ESTADO_CORTO, ESTADO_LABEL, useEvidencias } from "@/hooks/useEvidencias";

const fmtFecha = (d: string) =>
  new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(d));

export function EvidenciasCliente({
  orderId, enabled = true, className,
}: { orderId: string; enabled?: boolean; className?: string }) {
  const { data: evidencias = [] } = useEvidencias(orderId, enabled);
  const [idx, setIdx] = useState<number | null>(null);
  const total = evidencias.length;
  const actual = idx !== null ? evidencias[idx] : null;

  // Flechas del teclado dentro del visor
  useEffect(() => {
    if (idx === null || total < 2) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setIdx((i) => (i === null ? i : (i - 1 + total) % total));
      if (e.key === "ArrowRight") setIdx((i) => (i === null ? i : (i + 1) % total));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, total]);

  if (total === 0) return null;

  const mover = (d: number) => setIdx((i) => (i === null ? i : (i + d + total) % total));

  return (
    <div className={className ?? "border-t pt-3"}>
      <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        <Camera className="h-3.5 w-3.5" /> Avance de tu mueble
        <span className="text-xs font-normal text-muted-foreground">· {total} {total === 1 ? "foto" : "fotos"}</span>
      </h4>

      <div className="flex flex-wrap gap-2">
        {evidencias.map((f, i) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setIdx(i)}
            className="group w-16 shrink-0 text-left"
            title={ESTADO_LABEL[f.estado] ?? f.estado}
          >
            <img
              src={f.public_id ? cloudinaryUrl(f.public_id, { w: 160 }) : f.foto_url}
              alt={f.nota ?? `Foto del pedido: ${ESTADO_LABEL[f.estado] ?? f.estado}`}
              className="h-16 w-16 rounded-md border object-cover transition-opacity group-hover:opacity-90"
              loading="lazy"
            />
            <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
              {ESTADO_CORTO[f.estado] ?? f.estado}
            </span>
          </button>
        ))}
      </div>

      <Dialog open={idx !== null} onOpenChange={(o) => !o && setIdx(null)}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-3xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base">
              {actual ? `${ESTADO_LABEL[actual.estado] ?? actual.estado} · ${fmtFecha(actual.created_at)}` : ""}
            </DialogTitle>
          </DialogHeader>
          {actual && (
            <div className="space-y-2">
              <div className="relative">
                <img
                  src={actual.public_id ? cloudinaryUrl(actual.public_id, { w: 1400 }) : actual.foto_url}
                  alt={actual.nota ?? "Evidencia del pedido"}
                  className="max-h-[65vh] w-full rounded-lg object-contain"
                />
                {total > 1 && (
                  <>
                    <button
                      type="button"
                      aria-label="Foto anterior"
                      onClick={() => mover(-1)}
                      className="absolute left-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white hover:bg-black/70"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Foto siguiente"
                      onClick={() => mover(1)}
                      className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white hover:bg-black/70"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                )}
              </div>
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-muted-foreground">{actual.nota}</p>
                {total > 1 && idx !== null && (
                  <span className="shrink-0 text-xs text-muted-foreground">{idx + 1} / {total}</span>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}