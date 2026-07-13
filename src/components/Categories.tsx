import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { CATEGORIAS } from "@/lib/categories";

export function Categories() {
  return (
    <section id="categorias" className="container mx-auto px-6 py-24">
      <div className="text-center max-w-2xl mx-auto mb-16">
        <p className="text-xs uppercase tracking-[0.25em] text-accent font-medium mb-4">
          Nuestras colecciones
        </p>
        <h2 className="font-display text-4xl md:text-5xl font-semibold text-foreground">
          Piezas para cada rincón de tu hogar
        </h2>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {CATEGORIAS.map((cat) => (
          <Link
            key={cat.slug}
            to="/categoria/$slug"
            params={{ slug: cat.slug }}
            className="group p-8 rounded-xl bg-card border border-border/60 hover:shadow-[var(--shadow-soft)] hover:-translate-y-1 transition-all duration-300 text-left"
          >
            <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center mb-6 group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
              <cat.icon className="h-6 w-6" />
            </div>
            <h3 className="font-display text-2xl font-semibold mb-2 text-foreground">{cat.nombre}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">{cat.descripcion}</p>
            <span className="inline-flex items-center gap-1 text-sm font-medium text-accent opacity-0 group-hover:opacity-100 transition-opacity">
              Ver colección <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}