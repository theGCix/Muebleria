// src/components/EvidenciasCliente.tsx
// Vista del cliente (/perfil/pedidos): fotos del avance de su mueble. No renderiza nada si no hay fotos.
import { useState } from "react";
import { Camera } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { ESTADO_LABEL, agruparPorEstado, useEvidencias, type Evidencia } from "@/hooks/useEvidencias";

const fmtFecha = (d: string) =>
  new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(d));

export function EvidenciasCliente({ orderId, enabled = true }: { orderId: string; enabled?: boolean }) {
  const { data: evidencias = [] } = useEvidencias(orderId, enabled);
  const [abierta, setAbierta] = useState<Evidencia | null>(null);

  if (evidencias.length === 0) return null;

  return (
    <div className="border-t pt-3">
      <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        <Camera className="h-3.5 w-3.5" /> Avance de tu mueble
      </h4>

      <div className="space-y-3">
        {agruparPorEstado(evidencias).map(([estado, fotos]) => (
          <div key={estado}>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">{ESTADO_LABEL[estado] ?? estado}</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {fotos.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setAbierta(f)}
                  className="overflow-hidden rounded-lg border bg-muted/30 text-left transition-opacity hover:opacity-90"
                >
                  <img
                    src={f.public_id ? cloudinaryUrl(f.public_id, { w: 400 }) : f.foto_url}
                    alt={f.nota ?? `Foto del pedido: ${ESTADO_LABEL[estado] ?? estado}`}
                    className="aspect-square w-full object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!abierta} onOpenChange={(o) => !o && setAbierta(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-base">
              {abierta ? `${ESTADO_LABEL[abierta.estado] ?? abierta.estado} · ${fmtFecha(abierta.created_at)}` : ""}
            </DialogTitle>
          </DialogHeader>
          {abierta && (
            <div className="space-y-2">
              <img
                src={abierta.public_id ? cloudinaryUrl(abierta.public_id, { w: 1400 }) : abierta.foto_url}
                alt={abierta.nota ?? "Evidencia del pedido"}
                className="max-h-[70vh] w-full rounded-lg object-contain"
              />
              {abierta.nota && <p className="text-sm text-muted-foreground">{abierta.nota}</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}