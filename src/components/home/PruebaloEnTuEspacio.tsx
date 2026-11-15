// src/components/home/PruebaloEnTuEspacio.tsx
// «Pruébalo en tu espacio» (boceto v3): franja café con «Probar ahora». El probador ya existe en la ficha de cada pieza
// (botón bajo la galería), así que «Probar ahora» abre la ficha de la pieza más reciente con foto; sin piezas va al catálogo.
// Es el destino del ancla #pruebalo de la portada. Recuadros: «TU FOTO» (la foto del cliente se sube en la ficha; aquí solo se
// ilustra) y «CON LA PIEZA» (foto real de la pieza). Si hay fotos en src/assets/portada/04-pruebalo-* se usan en su lugar.
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Camera } from "lucide-react";
import { useCatalogoHome } from "@/hooks/useCatalogoHome";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { fotosPortada } from "@/lib/portadaFotos";

const BOTON =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-white px-7 text-sm font-semibold text-gm-cafe transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gm-cafe";

export function PruebaloEnTuEspacio() {
  const { data = [] } = useCatalogoHome(60);
  const pieza = useMemo(() => data.find((p) => p.imagen_public_id || p.imagen_url) ?? null, [data]);
  const propias = useMemo(() => fotosPortada("04-pruebalo"), []);

  const fotoPieza = pieza?.imagen_public_id ? cloudinaryUrl(pieza.imagen_public_id, { w: 600, h: 450 }) : pieza?.imagen_url ?? null;
  const fotoTuya = propias[0] ?? null;
  const fotoCon = propias[1] ?? fotoPieza;

  return (
    <section id="pruebalo" aria-labelledby="pruebalo-titulo" className="scroll-mt-28 bg-gm-cafe text-white">
      <div className="container mx-auto grid max-w-6xl items-center gap-5 px-4 py-9 md:py-10 lg:grid-cols-[1fr_auto] lg:gap-12">
        <div className="grid grid-cols-[1fr_auto] items-center gap-4 lg:block">
          <div>
            <h2 id="pruebalo-titulo" className="font-display text-[1.625rem] font-normal leading-tight md:text-[2rem]">
              Pruébalo en tu espacio
            </h2>
            <p className="mt-1 text-sm text-white/90 md:text-base">
              Sube una foto de tu sala<span className="hidden md:inline"> y mira cómo queda la pieza</span>.
            </p>
            {pieza ? (
              <Link to="/product/$handle" params={{ handle: pieza.id }} className={`${BOTON} mt-5`}>
                Probar ahora
              </Link>
            ) : (
              <Link to="/catalogo" className={`${BOTON} mt-5`}>
                Probar ahora
              </Link>
            )}
            <p className="mt-3 hidden text-xs text-white/80 lg:block">
              Se abre una pieza: ahí pulsa «Pruébalo en tu espacio» y sube tu foto.
            </p>
          </div>
          {/* Móvil: un solo recuadro, como el boceto móvil */}
          <Recuadro etiqueta="TU FOTO" foto={fotoTuya} className="w-36 sm:w-44 lg:hidden" />
        </div>

        <div className="hidden items-center gap-4 lg:flex">
          <Recuadro etiqueta="TU FOTO" foto={fotoTuya} className="w-60" />
          <ArrowRight className="h-5 w-5 flex-none text-white/80" aria-hidden />
          <Recuadro etiqueta="CON LA PIEZA" foto={fotoCon} className="w-60" />
        </div>
      </div>
    </section>
  );
}

function Recuadro({ etiqueta, foto, className }: { etiqueta: string; foto: string | null; className: string }) {
  return (
    <div className={`relative aspect-[4/3] overflow-hidden rounded-2xl bg-gm-arena ${className}`} aria-hidden>
      {foto ? (
        <img src={foto} alt="" width={480} height={360} loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-gm-cafe/40">
          <Camera className="h-1/3 w-1/3" />
        </span>
      )}
      <span className="absolute right-2 top-1.5 rounded bg-gm-cafe/80 px-1.5 py-0.5 text-xs font-medium text-white">{etiqueta}</span>
    </div>
  );
}
