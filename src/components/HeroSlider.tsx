// src/components/HeroSlider.tsx
// Carrusel principal del home (estilo mallhogar.com). Va justo debajo del Header, a todo el ancho.
// Las diapositivas salen de datos reales (combo destacado, precio mínimo de salas); la campaña
// con reloj ya la cubre <Hero /> justo debajo, así que aquí no se repite;
// la de marca y la de "a medida" siempre existen, así nunca queda vacío ni con una sola imagen rota.
// Autoplay sin dependencias extra: se pausa al pasar el mouse, al tocar, con la pestaña oculta
// y no corre si el usuario tiene activado "reducir movimiento".
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import useEmblaCarousel from "embla-carousel-react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import heroImg from "@/assets/hero-furniture.jpg";
import { comboDestacado, precioNormalCombo, useCombos } from "@/hooks/useCombos";
import { useProductsByCategory } from "@/hooks/useProducts";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { fmtPEN, ofertaInfo } from "@/lib/pricing";
import { cn } from "@/lib/utils";

const INTERVALO_MS = 6000;

type Destino =
  | { tipo: "ancla"; href: string }
  | { tipo: "combo"; id: string }
  | { tipo: "categoria"; slug: string; sub?: string };

interface Slide {
  id: string;
  etiqueta: string;
  titulo: string;
  bajada: string;
  cta: string;
  destino: Destino;
  imagen: string;
}

function CtaLink({ destino, children }: { destino: Destino; children: React.ReactNode }) {
  const clase =
    "inline-flex h-12 items-center gap-2 rounded-full bg-[var(--color-gold)] px-7 text-sm font-semibold uppercase tracking-wide text-[var(--color-walnut)] shadow-lg transition-colors hover:bg-[var(--color-gold-light)]";
  if (destino.tipo === "combo")
    return (
      <Link to="/combo/$id" params={{ id: destino.id }} className={clase}>
        {children}
      </Link>
    );
  if (destino.tipo === "categoria")
    return (
      <Link
        to="/categoria/$slug"
        params={{ slug: destino.slug }}
        search={destino.sub ? { sub: destino.sub } : undefined}
        className={clase}
      >
        {children}
      </Link>
    );
  return (
    <a href={destino.href} className={clase}>
      {children}
    </a>
  );
}

function useSlides(): Slide[] {
  const { data: combos = [] } = useCombos(6);
  const { data: salas = [] } = useProductsByCategory({ categoria: "muebles", subcategoria: "sala" });

  return useMemo(() => {
    const foto = (publicId: string | null | undefined, url: string | null | undefined) =>
      publicId ? cloudinaryUrl(publicId, { w: 1600 }) : (url ?? heroImg);

    const slides: Slide[] = [];

    const combo = comboDestacado(combos);
    if (combo) {
      const ahorro = precioNormalCombo(combo) - combo.precio_combo;
      const primero = combo.combo_items[0]?.products;
      slides.push({
        id: "combo",
        etiqueta: "Combo",
        titulo: combo.nombre,
        bajada: `Llévalo completo por ${fmtPEN(combo.precio_combo)} y ahorra ${fmtPEN(ahorro)}.`,
        cta: "Ver combo",
        destino: { tipo: "combo", id: combo.id },
        imagen: foto(combo.imagen_public_id ?? primero?.imagen_public_id, combo.imagen_url ?? primero?.imagen_url),
      });
    }

    const conPrecio = salas.filter((p) => p.precio > 0);
    if (conPrecio.length) {
      const desde = Math.min(...conPrecio.map((p) => ofertaInfo(p).precioFinal));
      const p = conPrecio.find((x) => x.imagen_public_id || x.imagen_url);
      slides.push({
        id: "salas",
        etiqueta: "Juegos de sala",
        titulo: `Juegos de sala desde ${fmtPEN(desde)}`,
        bajada: "Madera natural, fabricados por artesanos y con delivery a Lima.",
        cta: "Comprar ahora",
        destino: { tipo: "categoria", slug: "muebles", sub: "sala" },
        imagen: foto(p?.imagen_public_id, p?.imagen_url),
      });
    }

    slides.push({
      id: "medida",
      etiqueta: "A medida",
      titulo: "Tu mueble, con tus medidas",
      bajada: "Cuéntanos qué necesitas y te cotizamos sin compromiso.",
      cta: "Cotizar",
      destino: { tipo: "ancla", href: "#a-medida" },
      imagen: heroImg,
    });

    return slides;
  }, [combos, salas]);
}

export function HeroSlider() {
  const slides = useSlides();
  const [emblaRef, embla] = useEmblaCarousel({ loop: true, duration: 28 });
  const [actual, setActual] = useState(0);
  const [pausado, setPausado] = useState(false);

  useEffect(() => {
    if (!embla) return;
    const onSelect = () => setActual(embla.selectedScrollSnap());
    onSelect();
    embla.on("select", onSelect).on("reInit", onSelect);
    return () => {
      embla.off("select", onSelect).off("reInit", onSelect);
    };
  }, [embla]);

  // Si cambia la cantidad de diapositivas (llegan datos de Supabase), recalcular
  useEffect(() => {
    embla?.reInit();
  }, [embla, slides.length]);

  // Autoplay
  useEffect(() => {
    if (!embla || pausado || slides.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(() => {
      if (!document.hidden) embla.scrollNext();
    }, INTERVALO_MS);
    return () => window.clearInterval(t);
  }, [embla, pausado, slides.length, actual]);

  const prev = useCallback(() => embla?.scrollPrev(), [embla]);
  const next = useCallback(() => embla?.scrollNext(), [embla]);
  const varias = slides.length > 1;

  return (
    <section
      aria-roledescription="carrusel"
      aria-label="Promociones destacadas"
      className="relative w-full overflow-hidden bg-[var(--color-walnut)]"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onTouchStart={() => setPausado(true)}
      onTouchEnd={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={() => setPausado(false)}
    >
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex">
          {slides.map((s, i) => (
            <div
              key={s.id}
              role="group"
              aria-roledescription="diapositiva"
              aria-label={`${i + 1} de ${slides.length}`}
              className="relative h-[420px] min-w-0 shrink-0 grow-0 basis-full sm:h-[500px] lg:h-[560px]"
            >
              <img
                src={s.imagen}
                alt=""
                width={1600}
                height={700}
                // La primera se carga con prioridad (es lo primero que ve el visitante)
                loading={i === 0 ? "eager" : "lazy"}
                fetchPriority={i === 0 ? "high" : "auto"}
                className="absolute inset-0 h-full w-full object-cover"
              />
              {/* Degradado para que el texto se lea sobre cualquier foto */}
              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-r from-[var(--color-walnut)]/90 via-[var(--color-walnut)]/55 to-transparent"
              />
              <div className="container relative mx-auto flex h-full items-center px-6 md:px-10">
                <div className="max-w-xl space-y-4 text-[var(--color-warm-white)] sm:space-y-5">
                  <span className="inline-block rounded-full border border-[var(--color-gold)]/60 px-3 py-1 text-xs font-medium uppercase tracking-widest text-[var(--color-gold-light)]">
                    {s.etiqueta}
                  </span>
                  <h2 className="hero-display text-4xl font-semibold leading-[1.05] sm:text-5xl lg:text-6xl">
                    {s.titulo}
                  </h2>
                  <p className="text-base text-[var(--color-gold-light)]/90 sm:text-lg">{s.bajada}</p>
                  <CtaLink destino={s.destino}>
                    {s.cta} <ArrowRight className="h-4 w-4" />
                  </CtaLink>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {varias && (
        <>
          <button
            type="button"
            onClick={prev}
            aria-label="Diapositiva anterior"
            className="absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur transition-colors hover:bg-black/55 md:flex"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Diapositiva siguiente"
            className="absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur transition-colors hover:bg-black/55 md:flex"
          >
            <ChevronRight className="h-6 w-6" />
          </button>

          <div className="absolute inset-x-0 bottom-4 flex justify-center gap-2">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => embla?.scrollTo(i)}
                aria-label={`Ir a la diapositiva ${i + 1}`}
                aria-current={i === actual ? "true" : undefined}
                className={cn(
                  "h-2.5 rounded-full transition-all",
                  i === actual ? "w-7 bg-[var(--color-gold)]" : "w-2.5 bg-white/55 hover:bg-white/80",
                )}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
