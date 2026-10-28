// src/components/ClientesSatisfechos.tsx
// Página principal: fotos reales de clientes con su mueble (testimonios aprobados desde el panel,
// fotos enviadas por clientes al recibir su pedido y reseñas con foto). Si no hay ninguna, no se muestra.
import { Link } from "@tanstack/react-router";
import { ArrowRight, BadgeCheck, Star } from "lucide-react";
import { MIN_GALERIA, useGaleriaClientes } from "@/hooks/useGaleriaClientes";

const MAX_HOME = 8;

/** Versión liviana de la foto si es de Cloudinary. */
function liviana(url: string, w: number) {
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/") || /\/upload\/[a-z]_/.test(url)) return url;
  return url.replace("/upload/", `/upload/w_${w},q_auto,f_auto/`);
}

export function ClientesSatisfechos() {
  const { data } = useGaleriaClientes();
  const fotos = (data ?? []).slice(0, MAX_HOME);
  if (fotos.length === 0) return null;

  return (
    <section id="clientes-satisfechos" className="scroll-mt-28 bg-secondary/30 px-4 py-20 md:py-24">
      <div className="container mx-auto max-w-7xl">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.25em] text-accent">Clientes satisfechos</p>
          <h2 className="font-display text-4xl font-semibold leading-[1.05] md:text-5xl">
            Algunos de nuestros clientes satisfechos con su compra
          </h2>
          <p className="mt-4 text-muted-foreground">Fotos reales de muebles G&amp;M en los hogares de quienes ya los eligieron.</p>
        </div>

        <div className="flex flex-wrap justify-center gap-4 md:gap-5">
          {fotos.map((f) => (
            <figure
              key={f.id}
              className="group relative w-[calc(50%-0.5rem)] overflow-hidden rounded-2xl bg-muted shadow-[var(--shadow-soft)] md:w-[calc(33.333%-0.85rem)] lg:w-[calc(25%-0.95rem)]"
            >
              <div className="aspect-[4/5]">
                <img
                  src={liviana(f.fotos[0], 700)}
                  alt={`${f.autor_nombre}${f.producto_nombre ? ` con su ${f.producto_nombre}` : " con su mueble G&M"}`}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                />
              </div>
              <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent p-4 pt-12 text-white">
                <p className="text-sm font-medium leading-tight">{f.autor_nombre}</p>
                {f.producto_nombre && <p className="mt-0.5 line-clamp-1 text-xs text-white/80">{f.producto_nombre}</p>}
                <div className="mt-1.5 flex items-center gap-2 text-[11px] text-white/85">
                  {f.calificacion > 0 && (
                    <span className="inline-flex items-center gap-0.5" aria-label={`${f.calificacion} de 5 estrellas`}>
                      <Star className="h-3 w-3 fill-[var(--color-gold)] text-[var(--color-gold)]" /> {f.calificacion}
                    </span>
                  )}
                  {f.origen !== "panel" && (
                    <span className="inline-flex items-center gap-1">
                      <BadgeCheck className="h-3 w-3" /> Compra verificada
                    </span>
                  )}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>

        {(data?.length ?? 0) >= MIN_GALERIA && (
          <div className="mt-10 text-center">
            <Link to="/testimonios" className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
              Ver todos los testimonios <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}