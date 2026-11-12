import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { CATEGORIAS } from "@/lib/categories";
import { useCatalogoHome } from "@/hooks/useCatalogoHome";
import { cloudinaryUrl } from "@/lib/cloudinary";

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
    <section data-cat-section id="categorias" className="container mx-auto px-6 py-24">
      <div data-reveal className="text-center max-w-2xl mx-auto mb-16">
        <p className="text-xs uppercase tracking-[0.25em] text-accent-strong font-medium mb-4">
          Nuestras colecciones
        </p>
        <h2 className="font-display text-4xl md:text-5xl font-semibold text-foreground">
          Piezas para cada rincón de tu hogar
        </h2>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {CATEGORIAS.map((cat) => {
          const foto = fotos[cat.slug];
          return (
            <Link
              data-cat-card
              key={cat.slug}
              to="/categoria/$slug"
              params={{ slug: cat.slug }}
              className="group overflow-hidden rounded-xl bg-card border border-border/60 hover:shadow-[var(--shadow-soft)] hover:-translate-y-1 transition-[translate,box-shadow] duration-300 text-left"
            >
              {foto ? (
                <div className="aspect-[4/3] overflow-hidden bg-muted">
                  <img
                    src={foto}
                    alt=""
                    width={640}
                    height={480}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                  />
                </div>
              ) : null}
              <div className="p-6 sm:p-8">
                {!foto && (
                  <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center mb-6 group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
                    <cat.icon className="h-6 w-6" />
                  </div>
                )}
                <h3 className="font-display text-2xl font-semibold mb-2 text-foreground">{cat.nombre}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">{cat.descripcion}</p>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-accent-strong opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity">
                  Ver colección <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
