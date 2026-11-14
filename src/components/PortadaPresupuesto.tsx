// src/components/PortadaPresupuesto.tsx
// Portada del home a todo el ancho (estilo "hero"): foto de ambiente de fondo, título grande,
// selector de presupuesto y una tarjeta con la pieza real que alcanza con el tramo elegido.
// Cada tramo es un enlace a /catalogo?min=…&max=… (funciona con teclado y sin JavaScript); al pasar
// el cursor o enfocar un tramo, la tarjeta muestra la pieza de ese presupuesto (lib/portada.ts).
// Los tramos viven en lib/presupuesto.ts; el conteo sale de los productos reales (misma consulta
// y caché que Categories y el catálogo del home: no agrega peticiones).
// Los atributos data-hero* los anima useHomeCinema (entrada del título y parallax de la foto).
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import heroImg from "@/assets/hero-furniture.jpg";
import { useCatalogoHome } from "@/hooks/useCatalogoHome";
import { TRAMOS, contarPorTramo, etiquetaRango, precioEnRango } from "@/lib/presupuesto";
import { SelectorSegmento } from "@/components/SelectorSegmento";
import { useSegmento } from "@/hooks/useSegmento";
import { accionSugerida } from "@/lib/segmentos";
import { elegirPiezaEscena, tramoInicial } from "@/lib/portada";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { fmtPEN, ofertaInfo } from "@/lib/pricing";
import { trackSegmento } from "@/lib/analytics";

const plural = (n: number) => `${n} ${n === 1 ? "pieza" : "piezas"}`;

interface PiezaPortada {
  id: string;
  nombre: string;
  precioFinal: number;
  src: string;
}

export function PortadaPresupuesto() {
  const { data } = useCatalogoHome(60);
  const conteo = useMemo(() => (data ? contarPorTramo(data) : null), [data]);

  // Con datos cargados, un tramo sin piezas no se ofrece (llevaría a una lista vacía)
  const tramos = TRAMOS.filter((t) => !conteo || conteo[t.id] > 0);

  // «¿Para qué es?»: opcional; prellena los formularios de cotización y mide qué segmentos llegan
  const [segmento, setSegmento] = useSegmento();
  const accion = accionSugerida(segmento);

  // Tarjeta de pieza: una pieza real por tramo (la de mayor precio final que tiene foto)
  const [tramoElegido, setTramoElegido] = useState<string | null>(null);
  const piezaPorTramo = useMemo(() => {
    const mapa = new Map<string, PiezaPortada>();
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
  const activo = tramosConPieza.find((t) => t.id === tramoElegido) ?? tramoInicial(tramosConPieza);
  const piezaActiva = activo ? (piezaPorTramo.get(activo.id) ?? null) : null;

  return (
    <section
      data-hero
      aria-labelledby="portada-titulo"
      className="relative isolate flex min-h-[calc(100svh-7rem)] items-center overflow-hidden bg-background md:min-h-[min(calc(100svh-7rem),720px)]"
    >
      {/* Foto de fondo a todo el ancho */}
      <div data-hero-img aria-hidden className="absolute inset-0 -z-20 overflow-hidden">
        <img
          src={heroImg}
          alt=""
          width={1920}
          height={1080}
          fetchPriority="high"
          className="h-full w-full object-cover object-[65%_50%]"
        />
      </div>
      {/* Velo crema: da contraste al texto sin tapar la foto en el lado derecho */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-background/80 md:bg-transparent md:bg-gradient-to-r md:from-background/95 md:via-background/70 md:to-background/0"
      />

      <div className="container mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-10 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] md:items-end md:gap-12 md:py-20">
        <div className="min-w-0">
          <h1
            id="portada-titulo"
            data-hero-title
            className="t-titulo text-foreground"
            style={{ fontSize: "clamp(2.25rem, 5vw, 3.75rem)", lineHeight: 1.05 }}
          >
            Muebles hechos a mano para tu hogar
          </h1>
          <p data-hero-item className="mt-5 max-w-xl text-base text-foreground/80 md:text-lg">
            Piezas en madera natural, hechas con cuidado en nuestro taller. Encuentra la que mejor se acomode a tu espacio.
          </p>

          <div data-hero-item className="mt-8">
            <p id="presupuesto-etiqueta" className="t-apoyo mb-3 text-foreground/70">
              Explora según el rango que te acomode
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
                    className="flex h-full min-h-[48px] items-center justify-between gap-3 rounded-2xl border border-border bg-card/90 px-4 py-2 text-foreground shadow-sm backdrop-blur transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[activo=true]:border-primary sm:min-h-[64px] sm:flex-col sm:justify-center sm:gap-0 sm:py-3"
                  >
                    <span className="t-producto text-balance">{etiquetaRango(t)}</span>
                    {conteo && <span className="t-apoyo text-muted-foreground">{plural(conteo[t.id])}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <SelectorSegmento
            label="Cuéntanos para qué lo buscas"
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

          <div data-hero-item className="mt-5">
            <Link
              to="/catalogo"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-lg transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Conocer el catálogo <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>

        {/* Pieza que alcanza con el tramo elegido: tarjeta flotante sobre la foto */}
        {piezaActiva && activo && (
          <div data-hero-item className="min-w-0 md:justify-self-end">
            <Link
              to="/product/$handle"
              params={{ handle: piezaActiva.id }}
              data-testid="pieza-portada"
              className="group block w-full max-w-sm overflow-hidden rounded-3xl border border-border bg-card/95 shadow-xl backdrop-blur transition-transform hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
            >
              <div className="relative aspect-[4/3] bg-muted">
                <img
                  key={piezaActiva.id}
                  src={piezaActiva.src}
                  alt={piezaActiva.nombre}
                  className="h-full w-full object-contain p-3"
                />
                <p className="t-apoyo absolute left-3 top-3 rounded-full bg-card px-3 py-1.5 text-foreground shadow">
                  Una idea en este rango
                </p>
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <span className="t-producto block truncate">{piezaActiva.nombre}</span>
                  <span className="t-precio block text-primary">{fmtPEN(piezaActiva.precioFinal)}</span>
                </span>
                <span
                  aria-hidden
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform group-hover:translate-x-0.5"
                >
                  <ArrowRight className="h-4 w-4" />
                </span>
                <span className="sr-only">Ver pieza</span>
              </div>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}