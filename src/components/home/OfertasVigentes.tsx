// src/components/home/OfertasVigentes.tsx
// «Ofertas vigentes» (boceto v3): franja terracota con el conteo real de piezas en oferta, «Ver todas» y las ofertas como
// banners con foto (TarjetaOferta, referencia del dueño 2026-11-16): en móvil/tablet (< lg) una fila que se desliza con
// el dedo (hasta 8, las de mayor descuento); en PC, cuadrícula de 2 columnas con las 4 más fuertes.
// Sin ofertas vigentes no se muestra nada.
// Reemplaza a OfertasSection en el home; conserva id="ofertas" (la portada y el header apuntan a ese ancla).
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useCatalogoHome } from "@/hooks/useCatalogoHome";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { ofertaInfo } from "@/lib/pricing";
import { textoPiezasConDescuento, topOfertas } from "@/lib/seccionesHome";
import { TarjetaOferta } from "./TarjetaOferta";

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
          precioOriginal: p.precio,
          foto: p.imagen_public_id ? cloudinaryUrl(p.imagen_public_id, { w: 900, h: 675 }) : p.imagen_url,
        })),
    [data],
  );
  const destacadas = useMemo(() => topOfertas(ofertas, 4), [ofertas]);
  const deslizables = useMemo(() => topOfertas(ofertas, 8), [ofertas]);

  if (ofertas.length === 0) return null;

  return (
    <section id="ofertas" aria-labelledby="ofertas-titulo" className="scroll-mt-28 py-9 md:py-12">
      <div className="container mx-auto max-w-6xl px-4">
      <div className="grid gap-5 rounded-3xl bg-gm-terracota p-5 text-white md:p-8 lg:gap-6">
        <div>
          <h2 id="ofertas-titulo" className="font-display text-[1.625rem] font-bold leading-tight md:text-[2rem]">
            Ofertas vigentes
          </h2>
          <p className="mt-1 text-sm text-white">{textoPiezasConDescuento(ofertas.length)}</p>
          <Link
            to="/catalogo"
            search={{ oferta: true }}
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-white px-7 text-sm font-semibold text-gm-terracota transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gm-terracota"
          >
            Ver todas
          </Link>
        </div>

        {deslizables.length > 0 && (
          <ul
            aria-label="Piezas en oferta"
            className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 md:-mx-8 md:px-8 [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden"
          >
            {deslizables.map((o) => (
              <li key={o.id} className="w-[88%] flex-none snap-start sm:w-[62%] md:w-[48%]">
                <TarjetaOferta o={o} />
              </li>
            ))}
          </ul>
        )}

        {destacadas.length > 0 && (
          <ul aria-label="Piezas en oferta" className="hidden gap-4 lg:grid lg:grid-cols-2">
            {destacadas.map((o) => (
              <li key={o.id}>
                <TarjetaOferta o={o} />
              </li>
            ))}
          </ul>
        )}
      </div>
      </div>
    </section>
  );
}
