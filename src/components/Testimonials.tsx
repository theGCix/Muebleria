// src/components/Testimonials.tsx
// Reseñas reales y aprobadas de clientes. Si todavía no hay suficientes
// (MIN_RESENAS_HOME), la sección no se muestra: nunca verás tarjetas vacías.
import { Link } from "@tanstack/react-router";
import { ArrowRight, BadgeCheck, MessageCircle, Star } from "lucide-react";
import { MIN_RESENAS_HOME, useResenasDestacadas } from "@/hooks/useResenasDestacadas";
import { useHayGaleria } from "@/hooks/useGaleriaClientes";
import type { ResenaDestacada } from "@/lib/resenas.functions";

const fechaCorta = (iso: string) =>
  new Intl.DateTimeFormat("es-PE", { month: "long", year: "numeric" }).format(new Date(iso));

function Estrellas({ valor, size = 16 }: { valor: number; size?: number }) {
  return (
    <span
      className="inline-flex gap-0.5"
      role="img"
      aria-label={`${valor.toFixed(1)} de 5 estrellas`}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={size}
          className={
            i < Math.round(valor)
              ? "fill-[var(--color-gold)] text-[var(--color-gold)]"
              : "text-border"
          }
        />
      ))}
    </span>
  );
}

export function Testimonials() {
  const { data } = useResenasDestacadas();
  const resenas = data?.resenas ?? [];
  const hayGaleria = useHayGaleria();

  if (resenas.length < MIN_RESENAS_HOME) return null;

  return (
    <section id="testimonios" className="scroll-mt-28 px-4 py-20 md:py-24">
      <div className="container mx-auto max-w-7xl">
        <div
          data-reveal
          className="mb-12 flex flex-col gap-8 md:flex-row md:items-end md:justify-between"
        >
          <div className="max-w-xl">
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.25em] text-accent">
              Testimonios
            </p>
            <h2 className="font-display text-4xl font-semibold leading-[1.02] md:text-5xl">
              Lo que dicen quienes ya tienen un G&amp;M en casa
            </h2>
          </div>

          {data && data.total > 0 && (
            <div className="flex items-center gap-5 rounded-2xl border border-border/60 bg-card px-6 py-4 shadow-[var(--shadow-soft)]">
              <span className="font-display text-6xl font-semibold leading-none">
                {data.promedio.toFixed(1)}
              </span>
              <span className="flex flex-col gap-1.5">
                <Estrellas valor={data.promedio} size={18} />
                <span className="text-sm text-muted-foreground">
                  {data.total} {data.total === 1 ? "reseña" : "reseñas"} de compras verificadas
                </span>
              </span>
            </div>
          )}
        </div>

        <div
          data-reveal
          className="no-scrollbar -mx-4 flex snap-x snap-mandatory items-start gap-5 overflow-x-auto px-4 pb-2 md:mx-0 md:block md:columns-2 md:gap-5 md:overflow-visible md:px-0 lg:columns-3">
          {resenas.map((r) => (
            <Tarjeta key={r.id} r={r} />
          ))}
        </div>

        {hayGaleria && (
          <div className="mt-8 text-center">
            <Link
              to="/testimonios"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
            >
              Ver más testimonios <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

function Tarjeta({ r }: { r: ResenaDestacada }) {
  const foto = r.fotos?.[0];
  return (
    <article className="flex w-[85%] shrink-0 snap-center flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[var(--shadow-soft)] sm:w-[60%] md:mb-5 md:w-auto md:break-inside-avoid">
      {foto && (
        <div className="aspect-[16/10] overflow-hidden bg-muted">
          <img
            src={foto}
            alt={`Foto de ${r.autor_nombre} con su compra`}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-3 p-6">
        <Estrellas valor={r.calificacion} />
        {r.titulo && (
          <h3 className="font-display text-2xl font-semibold leading-tight">{r.titulo}</h3>
        )}
        <p className="line-clamp-6 text-sm leading-relaxed text-muted-foreground">{r.comentario}</p>

        {r.respuesta_tienda && (
          <div className="rounded-xl bg-secondary/60 p-3 text-xs leading-relaxed">
            <span className="mb-1 flex items-center gap-1.5 font-semibold text-foreground">
              <MessageCircle className="h-3.5 w-3.5 text-accent" /> Respuesta de G&amp;M
            </span>
            <span className="line-clamp-3 text-muted-foreground">{r.respuesta_tienda}</span>
          </div>
        )}

        <div className="mt-auto border-t border-border/60 pt-4 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium text-foreground">{r.autor_nombre}</span>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
              <BadgeCheck className="h-3.5 w-3.5" /> Compra verificada
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
            {r.producto_nombre ? (
              <Link
                to="/product/$handle"
                params={{ handle: r.product_id }}
                className="line-clamp-1 hover:text-foreground hover:underline"
              >
                {r.producto_nombre}
              </Link>
            ) : (
              <span />
            )}
            <span className="shrink-0 first-letter:uppercase">{fechaCorta(r.created_at)}</span>
          </div>
        </div>
      </div>
    </article>
  );
}