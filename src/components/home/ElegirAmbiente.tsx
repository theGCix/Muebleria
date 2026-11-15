// src/components/home/ElegirAmbiente.tsx
// «Elige tu ambiente» (boceto v3): collage con Salas grande a la izquierda y 4 ambientes a la derecha (2×2); en móvil,
// 2×2 con Salas, Comedores, Recámaras y Separadores (el boceto móvil no muestra Accesorios; sigue en «Ver todas»).
// Las categorías salen de lib/categories.ts; el conteo y la foto, de las piezas reales (misma consulta y caché que el
// resto del home). En la vista pública «Muebles» se llama «Salas» y «Separadores de ambiente», «Separadores» (boceto).
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { CATEGORIAS, getCategoria } from "@/lib/categories";
import { useCatalogoHome } from "@/hooks/useCatalogoHome";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { textoPiezas } from "@/lib/armadorPresupuesto";

const ETIQUETA: Record<string, string> = { muebles: "Salas", separadores: "Separadores" };

// Orden del DOM = orden móvil. En PC cada tarjeta ocupa su lugar del boceto con posiciones explícitas.
const TARJETAS = [
  { slug: "muebles", fondo: "bg-gm-arena", sitio: "md:col-start-1 md:row-start-1 md:row-span-2", movil: true },
  { slug: "comedores", fondo: "bg-gm-salvia", sitio: "md:col-start-2 md:row-start-1", movil: true },
  { slug: "recamaras", fondo: "bg-gm-salvia", sitio: "md:col-start-2 md:row-start-2", movil: true },
  { slug: "separadores", fondo: "bg-gm-arena", sitio: "md:col-start-3 md:row-start-1", movil: true },
  { slug: "accesorios", fondo: "bg-gm-arena", sitio: "md:col-start-3 md:row-start-2", movil: false },
] as const;

export function ElegirAmbiente() {
  const { data = [] } = useCatalogoHome(60);

  const porCategoria = useMemo(() => {
    const out: Record<string, { n: number; foto: string | null }> = {};
    for (const c of CATEGORIAS) {
      const piezas = data.filter((p) => p.categoria === c.slug);
      const conFoto = piezas.filter((p) => p.imagen_public_id || p.imagen_url);
      const p = conFoto.find((x) => (x.stock ?? 1) > 0) ?? conFoto[0];
      out[c.slug] = {
        n: piezas.length,
        foto: p ? (p.imagen_public_id ? cloudinaryUrl(p.imagen_public_id, { w: 900, h: 700 }) : p.imagen_url) : null,
      };
    }
    return out;
  }, [data]);

  return (
    <section id="categorias" aria-labelledby="ambientes-titulo" className="container mx-auto max-w-6xl px-4 py-10 md:py-14">
      <div className="mb-5 flex items-end justify-between gap-4 md:mb-6">
        <h2 id="ambientes-titulo" className="t-seccion text-foreground">
          Elige tu ambiente
        </h2>
        <Link
          to="/catalogo"
          className="hidden min-h-[44px] items-center gap-1.5 text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:inline-flex"
        >
          Ver todas <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      <ul className="grid grid-cols-2 gap-3 md:grid-cols-[1.5fr_1fr_1fr] md:grid-rows-2 md:gap-4 md:h-[420px] lg:h-[460px]">
        {TARJETAS.map(({ slug, fondo, sitio, movil }) => {
          const cat = getCategoria(slug);
          if (!cat) return null;
          const { n, foto } = porCategoria[slug] ?? { n: 0, foto: null };
          const nombre = ETIQUETA[slug] ?? cat.nombre;
          return (
            <li key={slug} className={`${sitio} ${movil ? "" : "hidden md:block"} min-h-0`}>
              <Link
                to="/categoria/$slug"
                params={{ slug }}
                className={`group relative block aspect-[226/190] overflow-hidden rounded-2xl md:aspect-auto md:h-full md:rounded-[28px] ${fondo} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}
              >
                {foto ? (
                  <img
                    src={foto}
                    alt=""
                    width={900}
                    height={700}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                  />
                ) : (
                  <span aria-hidden className="flex h-full w-full items-center justify-center text-gm-cafe/40">
                    <cat.icon className="h-1/4 w-1/4" />
                  </span>
                )}
                <span className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-3 rounded-xl bg-card px-3 py-2.5 md:inset-x-3 md:bottom-3 md:px-4 md:py-3">
                  <span className="truncate text-sm font-semibold text-foreground">{nombre}</span>
                  <span className="hidden shrink-0 text-xs text-muted-foreground md:block">{textoPiezas(n)}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
