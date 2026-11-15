// src/components/ProductsSection.tsx
// Catálogo del home: acceso corto a /catalogo. Los atajos (categoría, presupuesto, ofertas) son
// enlaces con el filtro ya puesto y una fila corta muestra las piezas más recientes con foto.
// El filtrado en sí vive en /catalogo (filtros en la URL). Conserva id="catalogo": el Footer, el
// Header y Hero.tsx apuntan a ese ancla. Todo sale de datos reales (productos activos y ofertas vigentes).
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Flame } from "lucide-react";
import { CATEGORIAS } from "@/lib/categories";
import { ofertaInfo } from "@/lib/pricing";
import { TRAMOS, contarPorTramo, etiquetaRango } from "@/lib/presupuesto";
import { useCatalogoHome } from "@/hooks/useCatalogoHome";
import { ProductCard } from "./ProductCard";

/** Piezas de la fila: 4 en PC; las dos últimas se ocultan en móvil (queda 1 fila de 2). */
const PIEZAS = 4;

const atajo =
  "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border/60 bg-card px-4 text-sm font-medium text-foreground/80 transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function ProductsSection() {
  const { data = [], isLoading } = useCatalogoHome(60);

  const porCategoria = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of data) if (p.categoria) m.set(p.categoria, (m.get(p.categoria) ?? 0) + 1);
    return m;
  }, [data]);
  const porTramo = useMemo(() => contarPorTramo(data), [data]);
  const ofertas = useMemo(() => data.filter((p) => ofertaInfo(p).activa).length, [data]);

  // Ya viene por created_at desc: las más recientes que tengan foto
  const recientes = useMemo(
    () => data.filter((p) => p.imagen_public_id || p.imagen_url).slice(0, PIEZAS),
    [data],
  );

  return (
    <section id="catalogo" className="scroll-mt-28 px-4 py-16 md:py-20">
      <div className="container mx-auto max-w-7xl">
        {/* ── Encabezado ── */}
        <div data-reveal className="mb-6 max-w-2xl md:mb-8">
          <p className="mb-3 text-sm font-medium text-accent-strong">Catálogo G&amp;M</p>
          <h2 className="t-seccion">Define tu presupuesto y descubre las opciones para tu hogar</h2>
          <p className="mt-3 text-muted-foreground">
            Elige tu ambiente o tu presupuesto y mira lo que el taller tiene para ti.
          </p>
        </div>

        {/* ── Atajos: cada uno abre /catalogo con el filtro ya puesto ── */}
        {isLoading ? (
          <div className="mb-8 flex flex-wrap gap-2" aria-hidden>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-11 w-28 animate-pulse rounded-full bg-muted" />
            ))}
          </div>
        ) : (
          data.length > 0 && (
            <nav aria-label="Atajos del catálogo" className="mb-8 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-sm font-medium text-muted-foreground">Ambiente</span>
                {CATEGORIAS.filter((c) => (porCategoria.get(c.slug) ?? 0) > 0).map((c) => (
                  <Link key={c.slug} to="/catalogo" search={{ cat: c.slug }} className={atajo}>
                    <c.icon className="h-4 w-4 text-detail" aria-hidden />
                    {c.nombre}
                    <span className="text-muted-foreground">· {porCategoria.get(c.slug)}</span>
                  </Link>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-sm font-medium text-muted-foreground">Presupuesto</span>
                {TRAMOS.filter((t) => (porTramo[t.id] ?? 0) > 0).map((t) => (
                  <Link key={t.id} to="/catalogo" search={{ min: t.min, max: t.max }} className={atajo}>
                    {etiquetaRango(t)}
                    <span className="text-muted-foreground">· {porTramo[t.id]}</span>
                  </Link>
                ))}
                {ofertas > 0 && (
                  <Link
                    to="/catalogo"
                    search={{ oferta: true }}
                    className={`${atajo} border-accent/40 bg-accent-soft text-accent-strong hover:text-accent-strong`}
                  >
                    <Flame className="h-4 w-4" aria-hidden />
                    Solo ofertas
                    <span>· {ofertas}</span>
                  </Link>
                )}
              </div>
            </nav>
          )
        )}

        {/* ── Piezas más recientes ── */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-4">
            {Array.from({ length: PIEZAS }).map((_, i) => (
              <div key={i} className={`h-72 animate-pulse rounded-2xl bg-muted ${i > 1 ? "hidden md:block" : ""}`} />
            ))}
          </div>
        ) : (
          recientes.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-4">
              {recientes.map((p, i) => (
                <div key={p.id} className={i > 1 ? "hidden md:block" : undefined}>
                  <ProductCard product={p} />
                </div>
              ))}
            </div>
          )
        )}

        {/* ── Ver todo ── */}
        {!isLoading && data.length > 0 && (
          <div className="mt-8 flex justify-center md:mt-10">
            <Link
              to="/catalogo"
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Ver todo el catálogo ({data.length} {data.length === 1 ? "pieza" : "piezas"})
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
