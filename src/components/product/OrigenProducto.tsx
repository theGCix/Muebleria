// src/components/product/OrigenProducto.tsx
// «De dónde viene»: taller y pasos de fabricación (productos propios) o marca/procedencia (de proveedor).
// Solo muestra lo que está cargado: la lógica está en src/lib/origen.ts.
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { EMPRESA } from "@/config";
import { resolverOrigen } from "@/lib/origen";
import { TALLER_PASOS } from "@/lib/taller";

interface Props {
  producto: { tipo_gestion?: string | null; origen?: unknown; categoria?: string | null } | null | undefined;
}

export function OrigenProducto({ producto }: Props) {
  const origen = useMemo(
    () =>
      producto
        ? resolverOrigen(producto, {
            direccion: EMPRESA.direccion,
            pasos: TALLER_PASOS.map((p) => ({ id: p.id, titulo: p.titulo })),
          })
        : null,
    [producto],
  );
  if (!origen) return null;

  return (
    <section aria-labelledby="origen-titulo" className="mt-6 rounded-xl border border-border bg-card p-4 sm:p-5">
      <h3 id="origen-titulo" className="gm-section-h3">De dónde viene</h3>
      <p className="t-producto">{origen.titulo}</p>
      {origen.subtitulo && (
        <p className="t-apoyo mt-0.5 flex items-center gap-1.5 text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden /> {origen.subtitulo}
        </p>
      )}

      {origen.filas.length > 0 && (
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          {origen.filas.map((f) => (
            <div key={f.etiqueta} className="contents">
              <dt className="text-muted-foreground">{f.etiqueta}</dt>
              <dd className="font-medium">{f.valor}</dd>
            </div>
          ))}
        </dl>
      )}

      {origen.pasos.length > 0 && (
        <>
          <p className="t-apoyo mt-4 text-muted-foreground">Cómo se hace</p>
          <ol className="mt-1.5 grid gap-1.5 text-sm sm:grid-cols-2">
            {origen.pasos.map((p, i) => (
              <li key={p.id} className="flex items-baseline gap-2">
                <span aria-hidden className="w-4 shrink-0 text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                {p.titulo}
              </li>
            ))}
          </ol>
          <Link to="/nosotros" className="t-apoyo mt-3 inline-block min-h-[44px] pt-3 font-medium text-primary underline underline-offset-4">
            Ver cómo trabajamos
          </Link>
        </>
      )}
    </section>
  );
}
