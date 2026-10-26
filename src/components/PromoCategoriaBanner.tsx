// src/components/PromoCategoriaBanner.tsx
// Banner horizontal de categoría ("JUEGOS DE SALA desde S/ 1,199").
// Todo sale de datos reales: precio mínimo (con oferta activa) y fotos de los productos.
// Si no hay productos en esa categoría/subcategoría, no se muestra.
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useProductsByCategory } from "@/hooks/useProducts";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { fmtPEN, ofertaInfo } from "@/lib/pricing";

interface Props {
  categoria?: string;
  subcategoria?: string;
  /** Texto grande del banner */
  titulo?: string;
  /** Texto antes del precio */
  prefijo?: string;
}

export function PromoCategoriaBanner({
  categoria = "muebles",
  subcategoria = "sala",
  titulo = "Juegos de sala",
  prefijo = "Desde",
}: Props) {
  const { data = [] } = useProductsByCategory({ categoria, subcategoria });

  const { desde, fotos } = useMemo(() => {
    const conPrecio = data.filter((p) => p.precio > 0);
    const desde = conPrecio.length
      ? Math.min(...conPrecio.map((p) => ofertaInfo(p).precioFinal))
      : 0;
    const fotos = conPrecio
      .filter((p) => p.imagen_public_id || p.imagen_url)
      .slice(0, 2)
      .map((p) =>
        p.imagen_public_id
          ? cloudinaryUrl(p.imagen_public_id, { w: 600, h: 400 })
          : (p.imagen_url as string),
      );
    return { desde, fotos };
  }, [data]);

  if (!desde) return null;

  return (
    <section className="px-4 pt-10" aria-label={titulo}>
      <div className="container mx-auto max-w-7xl" data-reveal="panel">
        <Link
          to="/categoria/$slug"
          params={{ slug: categoria }}
          search={{ sub: subcategoria }}
          className="group relative flex min-h-[9.5rem] items-center overflow-hidden rounded-2xl text-primary-foreground shadow-[var(--shadow-elegant)] sm:min-h-[11rem]"
          style={{ background: "var(--gradient-warm)" }}
        >
          {/* Texto */}
          <div className="relative z-10 flex-1 p-5 sm:p-8 lg:pl-12">
           
            <h2 className="font-display text-3xl font-bold uppercase leading-none sm:text-5xl lg:text-6xl">
              {titulo}
            </h2>
            <p className="mt-2 font-display text-2xl font-semibold sm:text-4xl">
              {prefijo.toLowerCase()} {fmtPEN(desde)}
            </p>
            <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-background px-5 py-2 text-sm font-bold uppercase tracking-wide text-primary transition-transform group-hover:translate-x-1">
              Ver productos <ArrowRight className="h-4 w-4" />
            </span>
          </div>

          {/* Fotos (solo ≥ sm, para no saturar el móvil) */}
          {fotos.length > 0 && (
            <div className="relative hidden h-full min-h-[11rem] flex-1 items-center justify-end gap-3 py-3 pr-4 sm:flex lg:pr-8">
              <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-black/10 to-transparent" />
              {fotos.map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt=""
                  loading="lazy"
                  className="relative h-36 w-44 rounded-xl border-2 border-white/60 object-cover shadow-lg transition-transform duration-500 group-hover:scale-105 lg:h-40 lg:w-56"
                />
              ))}
            </div>
          )}
        </Link>
      </div>
    </section>
  );
}