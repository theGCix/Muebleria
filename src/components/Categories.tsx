import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { CATEGORIAS } from "@/lib/categories";
import { useCatalogoHome } from "@/hooks/useCatalogoHome";
import { cloudinaryUrl } from "@/lib/cloudinary";

// Categorías del home (réplica de la portada propuesta): una fila de fotos con el nombre encima y el enlace
// «Ver todas las categorías». Las categorías salen de lib/categories.ts (una sola fuente), no del mockup.
export function Categories() {
  // Misma consulta y caché que el catálogo del home: no agrega peticiones
  const { data = [] } = useCatalogoHome(60);

  // H5: foto de cada categoría = pieza más reciente con imagen (con stock si hay; si no, cualquiera)
  const fotos = useMemo(() => {
    const out: Record<string, string> = {};
    for (const cat of CATEGORIAS) {
      const conFoto = data.filter((p) => p.categoria === cat.slug && (p.imagen_public_id || p.imagen_url));
      const p = conFoto.find((x) => (x.stock ?? 1) > 0) ?? conFoto[0];
      if (p) out[cat.slug] = p.imagen_public_id ? cloudinaryUrl(p.imagen_public_id, { w: 640, h: 480 }) : (p.imagen_url as string);
    }
    return out;
  }, [data]);

  return (
    <section id="categorias" aria-labelledby="categorias-titulo" className="container mx-auto max-w-6xl px-4 py-10 md:py-14">
      <div data-reveal className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h2 id="categorias-titulo" className="t-seccion text-foreground">
            Categorías
          </h2>
          <p className="t-texto mt-1 text-muted-foreground">Encuentra el mueble ideal para cada ambiente</p>
        </div>
        <Link
          to="/catalogo"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-detail px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Ver todas las categorías <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      {/* Móvil: fila deslizable con ajuste al borde (la tercera tarjeta asoma para indicar que hay más). md+: cuadrícula de 5 */}
      <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:grid md:snap-none md:grid-cols-5 md:gap-4 md:overflow-visible md:px-0 md:pb-0">
        {CATEGORIAS.map((cat) => {
          const foto = fotos[cat.slug];
          return (
            <li key={cat.slug} data-reveal className="w-[42%] flex-none snap-start md:w-auto">
              <Link
                to="/categoria/$slug"
                params={{ slug: cat.slug }}
                className="group relative block aspect-[4/3] overflow-hidden rounded-xl border border-border/60 bg-secondary transition-shadow hover:shadow-[var(--shadow-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {foto ? (
                  <img
                    src={foto}
                    alt=""
                    width={640}
                    height={480}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                  />
                ) : (
                  <span aria-hidden className="flex h-full w-full items-center justify-center text-primary/50">
                    <cat.icon className="h-10 w-10" />
                  </span>
                )}
                {/* Blanco sobre degradado oscuro (excepción de las reglas visuales: texto claro sobre fondo oscuro) */}
                <span
                  className={`absolute inset-x-0 bottom-0 flex items-center gap-2 px-3 pb-2.5 pt-8 ${
                    foto ? "bg-gradient-to-t from-black/70 to-transparent text-white" : "text-foreground"
                  }`}
                >
                  <cat.icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="truncate text-sm font-semibold">{cat.nombre}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
