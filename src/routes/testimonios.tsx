// src/routes/testimonios.tsx
// Testimonios: fotos reales de clientes con su mueble + reseñas verificadas.
// (Antes este archivo tenía por error el contenido de /terminos.)
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BadgeCheck, Star } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Estrellas, Tarjeta } from "@/components/Testimonials";
import { liviana } from "@/components/ClientesSatisfechos";
import { useGaleriaClientes } from "@/hooks/useGaleriaClientes";
import { fetchCalificacionGlobal, fetchResenasDestacadas } from "@/lib/resenas.functions";

export const Route = createFileRoute("/testimonios")({
  head: () => ({
    meta: [
      { title: "Testimonios — G&M Mueblería" },
      { name: "description", content: "Fotos reales y reseñas verificadas de clientes con sus muebles G&M." },
      { property: "og:title", content: "Testimonios — G&M Mueblería" },
      { property: "og:description", content: "Lo que dicen quienes ya tienen un G&M en casa." },
    ],
  }),
  component: TestimoniosPage,
});

function TestimoniosPage() {
  const { data: fotos } = useGaleriaClientes();
  const { data: resumen } = useQuery({
    queryKey: ["testimonios-page"],
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: async () => {
      const [resenas, global] = await Promise.all([fetchResenasDestacadas(30), fetchCalificacionGlobal()]);
      return { resenas, ...global };
    },
  });

  const galeria = fotos ?? [];
  const resenas = resumen?.resenas ?? [];
  const vacio = galeria.length === 0 && resenas.length === 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <section className="px-4 pb-10 pt-16 md:pt-24">
          <div className="container mx-auto max-w-7xl">
            <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
              <div className="max-w-2xl">
                <p className="mb-3 text-xs font-medium uppercase tracking-[0.25em] text-accent">Testimonios</p>
                <h1 className="font-display text-4xl font-semibold leading-[1.05] md:text-6xl">
                  Lo que dicen quienes ya tienen un G&amp;M en casa
                </h1>
                <p className="mt-4 text-muted-foreground">
                  Fotos reales y reseñas de clientes que compraron y recibieron su mueble.
                </p>
              </div>

              {resumen && resumen.total > 0 && (
                <div className="flex items-center gap-5 rounded-2xl border border-border/60 bg-card px-6 py-4 shadow-[var(--shadow-soft)]">
                  <span className="font-display text-6xl font-semibold leading-none">{resumen.promedio.toFixed(1)}</span>
                  <span className="flex flex-col gap-1.5">
                    <Estrellas valor={resumen.promedio} size={18} />
                    <span className="text-sm text-muted-foreground">
                      {resumen.total} {resumen.total === 1 ? "reseña" : "reseñas"} de compras verificadas
                    </span>
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>

        {vacio && (
          <section className="px-4 py-16 text-center">
            <p className="text-muted-foreground">Estamos reuniendo las primeras opiniones de nuestros clientes.</p>
            <Link to="/catalogo" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
              Ver el catálogo <ArrowRight className="h-4 w-4" />
            </Link>
          </section>
        )}

        {galeria.length > 0 && (
          <section className="px-4 py-10">
            <div className="container mx-auto max-w-7xl">
              <h2 className="mb-6 font-display text-2xl font-semibold md:text-3xl">Nuestros muebles en sus hogares</h2>
              <div className="flex flex-wrap gap-4 md:gap-5">
                {galeria.map((f) => (
                  <figure
                    key={f.id}
                    className="group relative w-[calc(50%-0.5rem)] overflow-hidden rounded-2xl bg-muted shadow-[var(--shadow-soft)] md:w-[calc(33.333%-0.85rem)] lg:w-[calc(25%-0.95rem)]"
                  >
                    <div className="aspect-[4/5]">
                      <img
                        src={liviana(f.fotos[0], 700)}
                        alt={`${f.autor_nombre}${f.producto_nombre ? ` con su ${f.producto_nombre}` : " con su mueble G&M"}`}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                      />
                    </div>
                    <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent p-4 pt-12 text-white">
                      <p className="text-sm font-medium leading-tight">{f.autor_nombre}</p>
                      {f.producto_nombre && <p className="mt-0.5 line-clamp-1 text-xs text-white/80">{f.producto_nombre}</p>}
                      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-white/85">
                        {f.calificacion > 0 && (
                          <span className="inline-flex items-center gap-0.5" aria-label={`${f.calificacion} de 5 estrellas`}>
                            <Star className="h-3 w-3 fill-[var(--color-gold)] text-[var(--color-gold)]" /> {f.calificacion}
                          </span>
                        )}
                        {f.origen !== "panel" && (
                          <span className="inline-flex items-center gap-1">
                            <BadgeCheck className="h-3 w-3" /> Compra verificada
                          </span>
                        )}
                      </div>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          </section>
        )}

        {resenas.length > 0 && (
          <section className="px-4 py-10 pb-20">
            <div className="container mx-auto max-w-7xl">
              <h2 className="mb-6 font-display text-2xl font-semibold md:text-3xl">Reseñas de clientes</h2>
              <div className="flex flex-col gap-5 md:block md:columns-2 md:gap-5 lg:columns-3 [&>article]:w-full">
                {resenas.map((r) => (
                  <Tarjeta key={r.id} r={r} />
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}
