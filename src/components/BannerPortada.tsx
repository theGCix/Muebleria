// src/components/BannerPortada.tsx
// Banner principal del home (réplica de la portada propuesta por el dueño): frase, título, línea de apoyo y botón
// «Ver colección» a la izquierda y, a la derecha, la foto del banner.
//  · Con fotos en src/assets/portada/ (lib/portadaBanners.ts): foto a todo el ancho con el texto encima (en móvil, la
//    foto arriba y el texto debajo). Una foto = fija; varias = carrusel con fundido.
//  · Sin fotos: carrusel de piezas reales, una por tramo de presupuesto (lib/portada.ts), sobre la escena pastel.
// Carrusel accesible: flechas y puntos de 44 px, pausa al pasar el cursor o enfocar, se detiene al usarlo a mano y no
// avanza solo con «reducir movimiento». Los data-hero* los anima useHomeCinema.
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { EscenaPortada } from "@/components/EscenaPortada";
import { usePiezasPorTramo } from "@/hooks/usePiezasPorTramo";
import { BANNERS_PORTADA } from "@/lib/portadaBanners";
import { etiquetaRango } from "@/lib/presupuesto";
import { moverIndice, tramoInicial } from "@/lib/portada";

const CADA_MS = 6000;

const reducirMovimiento = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Estado común del carrusel: índice, pausa (cursor/foco), avance automático y modo manual. */
function useCarrusel(total: number, inicio: number) {
  const [elegida, setElegida] = useState<number | null>(null);
  const [pausa, setPausa] = useState(false);
  const [manual, setManual] = useState(false); // si la persona lo usa a mano, ya no avanza solo
  const idx = Math.min(elegida ?? inicio, Math.max(total - 1, 0));

  useEffect(() => {
    if (total < 2 || pausa || manual || reducirMovimiento()) return;
    const t = window.setInterval(() => setElegida((e) => moverIndice(e ?? inicio, 1, total)), CADA_MS);
    return () => window.clearInterval(t);
  }, [total, pausa, manual, inicio]);

  return {
    idx,
    manual,
    ir: (n: number) => { setManual(true); setElegida(n); },
    mover: (paso: 1 | -1) => { setManual(true); setElegida(moverIndice(idx, paso, total)); },
    pausar: {
      onMouseEnter: () => setPausa(true),
      onMouseLeave: () => setPausa(false),
      onFocusCapture: () => setPausa(true),
      onBlurCapture: () => setPausa(false),
    },
  };
}

function Controles({
  total, idx, etiquetas, ir, mover, className = "",
}: {
  total: number;
  idx: number;
  etiquetas: string[];
  ir: (n: number) => void;
  mover: (paso: 1 | -1) => void;
  className?: string;
}) {
  if (total < 2) return null;
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <button
        type="button"
        onClick={() => mover(-1)}
        aria-label="Anterior"
        className="flex h-11 w-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronLeft className="h-5 w-5" aria-hidden />
      </button>
      <div className="flex items-center">
        {etiquetas.map((et, i) => (
          <button
            key={i}
            type="button"
            onClick={() => ir(i)}
            aria-label={`Ver ${i + 1} de ${total}${et ? `: ${et}` : ""}`}
            aria-current={i === idx ? "true" : undefined}
            className="group flex h-11 w-8 items-center justify-center focus-visible:outline-none"
          >
            <span
              aria-hidden
              className={`block h-2 rounded-full transition-all group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2 ${
                i === idx ? "w-6 bg-primary" : "w-2 bg-detail/50 group-hover:bg-detail"
              }`}
            />
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => mover(1)}
        aria-label="Siguiente"
        className="flex h-11 w-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronRight className="h-5 w-5" aria-hidden />
      </button>
    </div>
  );
}

function Texto() {
  return (
    <div className="min-w-0">
      <p data-hero-item className="flex items-center gap-3 text-sm font-medium text-foreground/80">
        Diseña tu espacio, vive mejor
        <span aria-hidden className="h-px w-12 bg-detail" />
      </p>
      <h1
        id="portada-titulo"
        data-hero-title
        className="t-titulo mt-3 text-foreground"
        style={{ fontSize: "clamp(2.25rem, 5vw, 3.75rem)", lineHeight: 1.05 }}
      >
        Muebles hechos a mano para tu hogar
      </h1>
      <p data-hero-item className="mt-5 max-w-xl text-base text-foreground/80 md:text-lg">
        Piezas en madera natural, hechas con cuidado en nuestro taller. Encuentra la que mejor se acomode a tu espacio.
      </p>
      <div data-hero-item className="mt-7">
        <Link
          to="/catalogo"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-lg transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Ver colección <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

/** Foto(s) a todo el ancho con el texto encima (móvil: foto arriba, texto debajo). */
function BannerFoto() {
  const total = BANNERS_PORTADA.length;
  const { idx, ir, mover, pausar } = useCarrusel(total, 0);

  return (
    <section
      data-hero
      aria-labelledby="portada-titulo"
      className="relative isolate overflow-hidden bg-background"
      {...(total > 1 ? { ...pausar, role: "group", "aria-roledescription": "carrusel", "aria-label": "Fotos de la portada" } : {})}
    >
      {/* Foto: arriba en móvil (proporción fija, sin saltos al cargar); de fondo a todo el ancho desde 768 px */}
      <div aria-hidden className="relative aspect-[16/10] w-full md:absolute md:inset-0 md:-z-20 md:aspect-auto">
        {BANNERS_PORTADA.map((b, i) => (
          <img
            key={b.src}
            src={b.src}
            alt=""
            fetchPriority={i === 0 ? "high" : "low"}
            loading={i === 0 ? "eager" : "lazy"}
            className={`absolute inset-0 h-full w-full object-cover object-[70%_50%] transition-opacity duration-700 motion-reduce:transition-none ${
              i === idx ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}
      </div>
      {/* Velo crema a la izquierda: contraste del texto sobre la foto */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 hidden md:block md:bg-gradient-to-r md:from-background/95 md:via-background/70 md:to-background/0"
      />

      <div className="container relative mx-auto max-w-6xl px-4 py-8 md:flex md:min-h-[460px] md:items-center md:py-16">
        <div className="md:max-w-[min(34rem,50%)]">
          <Texto />
        </div>
      </div>

      {total > 1 && (
        <Controles
          total={total}
          idx={idx}
          etiquetas={BANNERS_PORTADA.map(() => "")}
          ir={ir}
          mover={mover}
          className="absolute right-3 top-3 rounded-full bg-background/80 backdrop-blur md:bottom-4 md:right-6 md:top-auto"
        />
      )}
    </section>
  );
}

/** Sin fotos: una pieza real por tramo de presupuesto sobre la escena pastel. */
function BannerEscena() {
  const { diapositivas, cargando } = usePiezasPorTramo();
  const total = diapositivas.length;

  // Abre en el tramo del medio (decisión del dueño); el resto sigue el orden de los tramos.
  const inicio = useMemo(() => {
    const t = tramoInicial(diapositivas.map((d) => d.tramo));
    return t ? Math.max(0, diapositivas.findIndex((d) => d.tramo.id === t.id)) : 0;
  }, [diapositivas]);
  const { idx, manual, ir, mover, pausar } = useCarrusel(total, inicio);

  const actual = diapositivas[idx];
  const hayCarrusel = cargando || total > 0;

  return (
    <section data-hero aria-labelledby="portada-titulo" className="relative isolate overflow-hidden bg-background">
      <div
        className={`container mx-auto grid max-w-6xl grid-cols-1 items-center gap-6 px-4 py-8 md:gap-10 md:py-14 ${
          hayCarrusel ? "md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]" : ""
        }`}
      >
        <Texto />

        {hayCarrusel && (
          <div
            data-hero-item
            role="group"
            aria-roledescription="carrusel"
            aria-label="Piezas que alcanzan con cada presupuesto"
            className="min-w-0"
            {...pausar}
          >
            {/* Mientras carga, la escena vacía ya ocupa su alto: la página no salta al llegar la pieza */}
            <EscenaPortada
              pieza={actual?.pieza ?? null}
              etiqueta={actual ? etiquetaRango(actual.tramo) : ""}
              precargar={diapositivas.filter((_, i) => i !== idx).map((d) => d.pieza.src)}
            />
            <Controles
              total={total}
              idx={idx}
              etiquetas={diapositivas.map((d) => etiquetaRango(d.tramo))}
              ir={ir}
              mover={mover}
              className="mt-3 justify-center"
            />
            {/* Solo se anuncia el cambio cuando lo hace la persona; el avance automático no interrumpe al lector de pantalla */}
            <p className="sr-only" aria-live={manual ? "polite" : "off"}>
              {actual ? `Pieza ${idx + 1} de ${total}: ${actual.pieza.nombre}` : ""}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

export function BannerPortada() {
  return BANNERS_PORTADA.length > 0 ? <BannerFoto /> : <BannerEscena />;
}
