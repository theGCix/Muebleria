// src/components/home/OfertasVigentes.tsx
// «Ofertas vigentes» (boceto v3): franja terracota con el conteo real de piezas en oferta, «Ver todas» y, en PC, las 3 ofertas
// más fuertes. En móvil solo título, conteo y botón (como el boceto móvil). Sin ofertas vigentes no se muestra nada.
// Reemplaza a OfertasSection en el home; conserva id="ofertas" (la portada y el header apuntan a ese ancla).
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Sofa } from "lucide-react";
import { useCatalogoHome } from "@/hooks/useCatalogoHome";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { fmtPEN, ofertaInfo } from "@/lib/pricing";
import { textoPiezasConDescuento, topOfertas } from "@/lib/seccionesHome";

export function OfertasVigentes() {
  const { data = [] } = useCatalogoHome(60);

  const ofertas = useMemo(
    () =>
      data
        .map((p) => ({ p, info: ofertaInfo(p) }))
        .filter((x) => x.info.activa)
        .map(({ p, info }) => ({
          id: p.id,
          nombre: p.nombre,
          descuento: Math.round(p.descuento_porcentaje ?? 0),
          precioFinal: info.precioFinal,
          foto: p.imagen_public_id ? cloudinaryUrl(p.imagen_public_id, { w: 200, h: 200 }) : p.imagen_url,
        })),
    [data],
  );
  const destacadas = useMemo(() => topOfertas(ofertas, 3), [ofertas]);

  if (ofertas.length === 0) return null;

  return (
    <section id="ofertas" aria-labelledby="ofertas-titulo" className="scroll-mt-28 bg-gm-terracota text-white">
      <div className="container mx-auto grid max-w-6xl items-center gap-5 px-4 py-9 md:py-10 lg:grid-cols-[auto_1fr] lg:gap-12">
        <div>
          <h2 id="ofertas-titulo" className="font-display text-[1.625rem] font-normal leading-tight md:text-[2rem]">
            Ofertas vigentes
          </h2>
          <p className="mt-1 text-sm text-white/90">{textoPiezasConDescuento(ofertas.length)}</p>
          <Link
            to="/catalogo"
            search={{ oferta: true }}
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-white px-7 text-sm font-semibold text-gm-terracota transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gm-terracota"
          >
            Ver todas
          </Link>
        </div>

        {destacadas.length > 0 && (
          <ul className="hidden gap-4 lg:grid lg:grid-cols-3">
            {destacadas.map((o) => (
              <li key={o.id}>
                <Link
                  to="/product/$handle"
                  params={{ handle: o.id }}
                  className="flex h-full gap-3 rounded-2xl bg-card p-3 text-foreground shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gm-terracota"
                >
                  <span className="h-[72px] w-[72px] flex-none overflow-hidden rounded-xl bg-gm-arena">
                    {o.foto ? (
                      <img src={o.foto} alt="" width={144} height={144} loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-gm-cafe/30">
                        <Sofa className="h-1/2 w-1/2" aria-hidden />
                      </span>
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="line-clamp-2 block text-xs font-semibold leading-snug">{o.nombre}</span>
                    <span className="mt-1 block font-display text-base font-bold text-primary">{fmtPEN(o.precioFinal)}</span>
                    <span className="mt-1 inline-block rounded-full bg-gm-terracota px-2.5 py-0.5 text-xs font-semibold text-white">
                      -{o.descuento}%
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
