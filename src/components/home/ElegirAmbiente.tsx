// src/components/home/ElegirAmbiente.tsx
// «Elige tu ambiente» (mockup azul marino): tarjetas blancas con una ilustración y el nombre debajo; 5 en una fila en
// PC y 2×2 en móvil con Salas, Comedores, Recámaras y Separadores (Accesorios solo en PC, sin ilustración: usa la foto
// de su pieza más reciente). Las ilustraciones son de public/ambientes (decisión del dueño, 2026-11-16: «ilustración
// siempre»). Las categorías salen de lib/categories.ts; el conteo, de las piezas reales (misma consulta y caché que el
// resto del home). «Muebles» se muestra como «Salas» y «Separadores de ambiente» como «Separadores» (boceto).
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { CATEGORIAS, getCategoria } from "@/lib/categories";
import { useCatalogoHome } from "@/hooks/useCatalogoHome";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { textoPiezas } from "@/lib/armadorPresupuesto";

const ETIQUETA: Record<string, string> = { muebles: "Salas", separadores: "Separadores" };

// Ilustración por categoría (public/ambientes). Sin entrada: se usa la foto de la pieza o el ícono.
const ILUSTRACION: Record<string, string> = {
  muebles: "/ambientes/salas.webp",
  comedores: "/ambientes/comedores.webp",
  recamaras: "/ambientes/recamaras.webp",
  separadores: "/ambientes/separadores.webp",
};

// Orden del DOM = orden móvil.
const TARJETAS = [
  { slug: "muebles", movil: true },
  { slug: "comedores", movil: true },
  { slug: "recamaras", movil: true },
  { slug: "separadores", movil: true },
  { slug: "accesorios", movil: false },
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
        <div>
          <h2 id="ambientes-titulo" className="t-seccion text-foreground">
            Elige tu ambiente
          </h2>
          <p className="mt-1 text-sm text-muted-foreground md:text-base">Encuentra el estilo perfecto para cada espacio.</p>
        </div>
        <Link
          to="/catalogo"
          className="hidden min-h-[44px] items-center gap-1.5 text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:inline-flex"
        >
          Ver todas <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      <ul className="grid grid-cols-2 gap-3 md:grid-cols-5 md:gap-4">
        {TARJETAS.map(({ slug, movil }) => {
          const cat = getCategoria(slug);
          if (!cat) return null;
          const { n, foto } = porCategoria[slug] ?? { n: 0, foto: null };
          const nombre = ETIQUETA[slug] ?? cat.nombre;
          const ilustracion = ILUSTRACION[slug];
          return (
            <li key={slug} className={`${movil ? "" : "hidden md:block"} min-h-0`}>
              <Link
                to="/categoria/$slug"
                params={{ slug }}
                className="group flex h-full flex-col rounded-[20px] border border-border/40 bg-card p-3 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:rounded-[24px] md:p-4"
              >
                <span className="relative block aspect-[4/3] w-full overflow-hidden rounded-xl">
                  {ilustracion ? (
                    <img
                      src={ilustracion}
                      alt=""
                      width={540}
                      height={405}
                      loading="lazy"
                      className="h-full w-full object-contain mix-blend-multiply transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                    />
                  ) : foto ? (
                    <img
                      src={foto}
                      alt=""
                      width={900}
                      height={700}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                    />
                  ) : (
                    <span aria-hidden className="flex h-full w-full items-center justify-center bg-gm-arena text-gm-cafe/40">
                      <cat.icon className="h-1/4 w-1/4" />
                    </span>
                  )}
                </span>
                <span className="mt-2 flex items-baseline justify-between gap-3 px-1 md:mt-3">
                  <span className="truncate text-base font-bold text-foreground md:text-lg">{nombre}</span>
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
