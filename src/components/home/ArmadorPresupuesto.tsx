// src/components/home/ArmadorPresupuesto.tsx
// «Tu presupuesto manda» (boceto v3): «¿Para qué es?» + deslizador de presupuesto con las piezas que alcanzan al
// instante. El botón lleva a /catalogo?max=… (filtro ya soportado). Reemplaza a PresupuestoHome en el home; los tramos
// fijos (lib/presupuesto.ts) siguen siendo la fuente del catálogo y el valor inicial sale del tramo del medio.
// Todo sale de los precios finales reales (con oferta vigente): límites, conteo, «desde» y miniaturas.
// «¿Para qué es?» es opcional y NO viene preseleccionado (guarda un dato del visitante: no se asume).
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { ArrowRight, Sofa } from "lucide-react";
import { useCatalogoHome } from "@/hooks/useCatalogoHome";
import { useSegmento } from "@/hooks/useSegmento";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { ofertaInfo } from "@/lib/pricing";
import { TRAMOS } from "@/lib/presupuesto";
import { montoCorto } from "@/lib/portadaCarrusel";
import {
  limitesSlider,
  piezasQueAlcanzan,
  textoOpciones,
  textoPiezas,
  valorInicial,
} from "@/lib/armadorPresupuesto";
import { accionSugerida, type SegmentoId } from "@/lib/segmentos";
import { trackSegmento } from "@/lib/analytics";

// Chips del boceto: 4 en PC y 3 en móvil. Los otros dos segmentos siguen en los formularios de cotización.
const CHIPS: { id: SegmentoId; texto: string; soloPc?: boolean }[] = [
  { id: "primer-hogar", texto: "Primer hogar" },
  { id: "familia", texto: "Familia" },
  { id: "regalo", texto: "Regalo" },
  { id: "negocio", texto: "Negocio", soloPc: true },
];

// Tope del tramo del medio (hoy S/ 2,000): con él abre el deslizador, como en el boceto.
const PREFERIDO = TRAMOS[1]?.max ?? null;

export function ArmadorPresupuesto() {
  const { data, isLoading } = useCatalogoHome(60);
  const [elegido, setElegido] = useState<number | null>(null);
  const [segmento, setSegmento] = useSegmento();
  const accion = accionSugerida(segmento);

  const piezas = useMemo(
    () =>
      (data ?? []).map((p) => ({
        id: p.id,
        nombre: p.nombre,
        precioFinal: ofertaInfo(p).precioFinal,
        foto: p.imagen_public_id ? cloudinaryUrl(p.imagen_public_id, { w: 160, h: 160 }) : p.imagen_url,
      })),
    [data],
  );
  const limites = useMemo(() => limitesSlider(piezas.map((p) => p.precioFinal)), [piezas]);

  // Catálogo cargado y sin piezas: no hay nada que armar
  if (!isLoading && data && !limites) return null;

  const valor = limites ? (elegido != null ? Math.min(limites.max, Math.max(limites.min, elegido)) : valorInicial(limites, PREFERIDO)) : 0;
  const alcance = piezasQueAlcanzan(piezas, valor, 3);
  const cta = textoOpciones(alcance.total);

  return (
    <section id="presupuesto" aria-labelledby="presupuesto-titulo" className="bg-gm-salvia">
      <div className="container mx-auto grid max-w-6xl items-center gap-6 px-4 py-10 md:py-16 lg:grid-cols-[1fr_1.1fr] lg:gap-14">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gm-terracota md:text-sm">Tu estilo no tiene límites.</p>
          <h2
            id="presupuesto-titulo"
            className="mt-2 font-display font-normal leading-[1.15] tracking-tight text-foreground md:mt-3"
            style={{ fontSize: "clamp(1.625rem, 3.3vw, 3rem)" }}
          >
            Dinos cuánto quieres invertir y te mostramos lo que el taller tiene.
          </h2>
          <p className="t-texto mt-6 hidden max-w-sm text-foreground/80 lg:mt-10 lg:block">
            Elige para qué es, mueve el deslizador y mira las piezas al instante.
          </p>
        </div>

        <div className="rounded-3xl bg-card p-5 shadow-[var(--shadow-soft)] md:p-8">
          {/* 1 · ¿Para qué es? */}
          <p id="armador-paraque" className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <span aria-hidden className="hidden text-muted-foreground md:inline">1</span>
            ¿Para qué es? <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
          </p>
          <div role="group" aria-labelledby="armador-paraque" className="mt-3 flex flex-wrap gap-2">
            {CHIPS.map(({ id, texto, soloPc }) => {
              const activo = segmento === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={activo}
                  onClick={() => {
                    const nuevo = activo ? null : id;
                    setSegmento(nuevo);
                    if (nuevo) trackSegmento(nuevo);
                  }}
                  className={`min-h-[44px] rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    soloPc ? "hidden md:inline-flex md:items-center" : ""
                  } ${
                    activo
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground hover:border-primary"
                  }`}
                >
                  {texto}
                </button>
              );
            })}
          </div>

          {/* 2 · ¿Cuánto quieres invertir? */}
          <div className="mt-6 flex items-baseline justify-between gap-3 md:mt-8">
            <p id="armador-cuanto" className="hidden items-center gap-2 text-sm font-semibold text-foreground md:flex">
              <span aria-hidden className="text-muted-foreground">2</span>
              ¿Cuánto quieres invertir?
            </p>
            <p aria-hidden className="font-display text-xl text-primary md:text-2xl">
              Hasta {montoCorto(valor)}
            </p>
          </div>

          <SliderPrimitive.Root
            className="relative mt-3 flex h-11 w-full touch-none select-none items-center"
            min={limites?.min ?? 0}
            max={limites?.max ?? 1}
            step={limites?.paso ?? 1}
            value={[valor]}
            disabled={!limites}
            onValueChange={([v]) => setElegido(v)}
            aria-labelledby="armador-cuanto"
          >
            <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-gm-arena">
              <SliderPrimitive.Range className="absolute h-full bg-primary" />
            </SliderPrimitive.Track>
            <SliderPrimitive.Thumb
              aria-label="Presupuesto máximo"
              aria-valuetext={`Hasta ${montoCorto(valor)}`}
              className="block h-7 w-7 rounded-full border-[3px] border-primary bg-white shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
            />
          </SliderPrimitive.Root>

          {/* Piezas que alcanzan */}
          <div className="mt-4 flex items-center gap-4 md:mt-6" aria-live="polite">
            <ul aria-hidden className="flex gap-2">
              {[0, 1, 2].map((i) => {
                const p = alcance.vista[i];
                return (
                  <li key={i} className="h-12 w-12 overflow-hidden rounded-xl bg-gm-arena md:h-[60px] md:w-[60px]">
                    {p?.foto ? (
                      <img src={p.foto} alt="" width={120} height={120} loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-gm-cafe/30">
                        <Sofa className="h-1/2 w-1/2" />
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="min-w-0">
              {limites && alcance.total > 0 ? (
                <>
                  <span className="block text-sm font-semibold text-foreground md:text-base">{textoPiezas(alcance.total)} para ti</span>
                  {alcance.desde != null && (
                    <span className="block text-xs text-muted-foreground">desde {montoCorto(alcance.desde)}</span>
                  )}
                </>
              ) : (
                <span className="block text-sm text-muted-foreground">
                  {limites ? "Aún no hay piezas con este presupuesto: súbelo un poco." : "Buscando piezas…"}
                </span>
              )}
            </p>
          </div>

          {cta ? (
            <Link
              to="/catalogo"
              search={{ max: valor }}
              className="mt-5 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:mt-6"
            >
              {cta} <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : (
            <span
              aria-disabled="true"
              className="mt-5 inline-flex min-h-[52px] w-full cursor-not-allowed items-center justify-center rounded-full bg-primary/40 px-6 text-sm font-semibold text-primary-foreground md:mt-6"
            >
              Elige un presupuesto
            </span>
          )}

          {accion && (
            <p data-testid="accion-segmento" className="t-texto mt-4">
              {accion.destino === "medida" ? (
                <a href="#a-medida" className="font-semibold text-primary underline underline-offset-4">
                  {accion.texto}
                </a>
              ) : (
                <Link to="/envios" className="font-semibold text-primary underline underline-offset-4">
                  {accion.texto}
                </Link>
              )}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
