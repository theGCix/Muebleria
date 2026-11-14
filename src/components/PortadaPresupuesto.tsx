// src/components/PortadaPresupuesto.tsx
// Portada corta del home: título, una línea de apoyo, escena con una pieza real, selector de
// presupuesto y un enlace al catálogo completo. Cada tramo es un enlace a /catalogo?min=…&max=…
// (funciona con teclado y sin JavaScript); al pasar el cursor o enfocar un tramo, la escena
// muestra la pieza que alcanza con ese presupuesto (lib/portada.ts). Los tramos viven en
// lib/presupuesto.ts; el conteo sale de los productos reales (misma consulta y caché que
// Categories y el catálogo del home: no agrega peticiones).
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useCatalogoHome } from "@/hooks/useCatalogoHome";
import { TRAMOS, contarPorTramo, etiquetaRango, precioEnRango } from "@/lib/presupuesto";
import { SelectorSegmento } from "@/components/SelectorSegmento";
import { EscenaPortada, type PiezaEscena } from "@/components/EscenaPortada";
import { useSegmento } from "@/hooks/useSegmento";
import { accionSugerida } from "@/lib/segmentos";
import { elegirPiezaEscena, tramoInicial } from "@/lib/portada";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { ofertaInfo } from "@/lib/pricing";
import { trackSegmento } from "@/lib/analytics";

const plural = (n: number) => `${n} ${n === 1 ? "pieza" : "piezas"}`;

export function PortadaPresupuesto() {
  const { data } = useCatalogoHome(60);
  const conteo = useMemo(() => (data ? contarPorTramo(data) : null), [data]);

  // Con datos cargados, un tramo sin piezas no se ofrece (llevaría a una lista vacía)
  const tramos = TRAMOS.filter((t) => !conteo || conteo[t.id] > 0);

  // «¿Para qué es?»: opcional; prellena los formularios de cotización y mide qué segmentos llegan
  const [segmento, setSegmento] = useSegmento();
  const accion = accionSugerida(segmento);

  // Escena: una pieza real por tramo (la de mayor precio final que tiene foto)
  const [tramoElegido, setTramoElegido] = useState<string | null>(null);
  const piezaPorTramo = useMemo(() => {
    const mapa = new Map<string, PiezaEscena>();
    if (!data) return mapa;
    const candidatas = data.map((p) => ({
      p,
      precioFinal: ofertaInfo(p).precioFinal,
      foto: p.imagen_public_id ? cloudinaryUrl(p.imagen_public_id, { w: 720 }) : p.imagen_url,
    }));
    for (const t of TRAMOS) {
      const c = elegirPiezaEscena(candidatas, (n) => precioEnRango(n, t));
      if (c && c.foto) mapa.set(t.id, { id: c.p.id, nombre: c.p.nombre, precioFinal: c.precioFinal, src: c.foto });
    }
    return mapa;
  }, [data]);

  const tramosConPieza = tramos.filter((t) => piezaPorTramo.has(t.id));
  const activo =
    tramosConPieza.find((t) => t.id === tramoElegido) ?? tramoInicial(tramosConPieza);
  const piezaActiva = activo ? (piezaPorTramo.get(activo.id) ?? null) : null;
  const otras = tramosConPieza.filter((t) => t.id !== activo?.id).map((t) => piezaPorTramo.get(t.id)!.src);

  return (
    <section data-hero className="bg-background">
      <div className="container mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-8 md:grid-cols-2 md:items-center md:gap-x-12 md:gap-y-6 md:py-16">
        <div className="min-w-0 md:col-start-1 md:row-start-1">
          <h1 data-hero-title className="t-titulo text-foreground">
            Muebles hechos a mano, a tu presupuesto
          </h1>
          <p data-hero-item className="t-texto mt-4 max-w-xl text-muted-foreground">
            Elige cuánto quieres invertir y mira lo que el taller puede hacer.
          </p>
        </div>

        {/* Escena: tarjeta compacta, no ocupa todo el ancho ni el alto de la portada */}
        <div data-hero-item className="min-w-0 md:col-start-2 md:row-span-2 md:row-start-1">
          <EscenaPortada
            pieza={piezaActiva}
            etiqueta={activo ? etiquetaRango(activo) : ""}
            precargar={otras}
          />
        </div>

        <div className="min-w-0 md:col-start-1 md:row-start-2">
          <div data-hero-item>
            <p id="presupuesto-etiqueta" className="t-apoyo mb-3 text-muted-foreground">
              ¿Cuánto quieres invertir?
            </p>
            <ul aria-labelledby="presupuesto-etiqueta" className="grid max-w-2xl gap-3 sm:grid-cols-3">
              {tramos.map((t) => (
                <li key={t.id}>
                  <Link
                    to="/catalogo"
                    search={{ min: t.min, max: t.max }}
                    onMouseEnter={() => setTramoElegido(t.id)}
                    onFocus={() => setTramoElegido(t.id)}
                    data-activo={activo?.id === t.id ? "true" : undefined}
                    className="flex h-full min-h-[48px] items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-2 text-foreground transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[activo=true]:border-primary sm:min-h-[64px] sm:flex-col sm:justify-center sm:gap-0 sm:py-3"
                  >
                    <span className="t-producto text-balance">{etiquetaRango(t)}</span>
                    {conteo && <span className="t-apoyo text-muted-foreground">{plural(conteo[t.id])}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <SelectorSegmento
            deslizable
            value={segmento}
            onChange={(v) => {
              setSegmento(v);
              if (v) trackSegmento(v);
            }}
            className="mt-6"
          />
          {accion && (
            <p data-testid="accion-segmento" className="t-texto mt-3">
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

          <div data-hero-item className="mt-4">
            <Link
              to="/catalogo"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full pr-4 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Ver todo el catálogo <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
