// src/components/home/PortadaCarrusel.tsx
// Portada v3 (boceto del dueño, PC y móvil): carrusel de 4 diapositivas a todo el ancho sobre verde bosque, con
// pestañas debajo que saltan a cualquier diapositiva y la franja de envíos y pagos.
//  · Diapositiva 1 = campaña («Días de locura»): nombre, reloj, descuento máximo y precio «desde» REALES (useCampana).
//    Sin campaña vigente no hay diapositiva ni pestaña y quedan las otras tres.
//  · Diapositivas 2-4 (Salas, A medida, Pruébalo): mismo diseño; el boceto solo dibuja la primera.
//  · Las tarjetas usan las fotos de src/assets/portada/ si existen (lib/portadaFotos.ts) y, si no, la foto real de
//    cada pieza del catálogo. Nada se inventa: nombres, precios y conteos salen de los productos.
// Accesible: flechas y puntos de 44 px, pausa con cursor o foco, se detiene al usarlo a mano, sin avance
// automático con «reducir movimiento», diapositivas inactivas con aria-hidden + inert.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { CampanaTicker } from "@/components/CampanaTicker";
import { TendederoPiezas } from "@/components/home/TendederoPiezas";
import { useCampana } from "@/hooks/useCampana";
import { useCatalogoHome } from "@/hooks/useCatalogoHome";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { fmtPEN, ofertaInfo } from "@/lib/pricing";
import { fotosPortada } from "@/lib/portadaFotos";
import {
  diapositivasActivas,
  diasRestantes,
  montoCorto,
  precioMinimo,
  siguiente,
  textoTermina,
  type DiapositivaId,
} from "@/lib/portadaCarrusel";
import type { Product } from "@/hooks/useProducts";

const CADA_MS = 7000;

const reducirMovimiento = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ───────────────────────── Datos de cada diapositiva ───────────────────────── */

type Destino =
  | { tipo: "oferta" }
  | { tipo: "categoria"; slug: string }
  | { tipo: "hash"; hash: string };

interface Pieza {
  src: string | null;
  nombre: string;
  id?: string;
  precio: string | null; // precio final real (con oferta vigente si la hay)
}

interface Diapositiva {
  id: DiapositivaId;
  pestana: string;
  etiqueta: string | null; // «TERMINA EN 13 DÍAS»
  reloj?: boolean; // true: la etiqueta se reemplaza por el reloj visual de la campaña (CampanaTicker)
  titulo: string;
  fantasma: string[]; // palabra grande de fondo, una por línea
  pre: string; // «Hasta» / «Desde»
  valor: string; // «30%» / «S/ 1,485»
  detalle: ReactNode;
  boton: string;
  destino: Destino;
  nota: string | null;
  piezas: Pieza[]; // hasta 3
  insignia: { pre: string; valor: string } | null;
}

/** Palabra fantasma en dos líneas como el boceto: «DÍAS DE» / «LOCURA». */
function lineasFantasma(texto: string): string[] {
  const p = texto.toUpperCase().split(/\s+/).filter(Boolean);
  return p.length >= 3 ? [p.slice(0, 2).join(" "), p.slice(2).join(" ")] : p;
}

const imagenDe = (p: Product, w: number, h: number) =>
  p.imagen_public_id ? cloudinaryUrl(p.imagen_public_id, { w, h }) : p.imagen_url;

const aPieza = (p: Product): Pieza => ({
  src: imagenDe(p, 720, 540),
  nombre: p.nombre,
  id: p.id,
  precio: fmtPEN(ofertaInfo(p).precioFinal),
});

/** Foto propia (src/assets/portada) si existe; si no, la de la pieza. */
function conFotos(piezas: Pieza[], propias: string[]): Pieza[] {
  return piezas.map((p, i) => ({ ...p, src: propias[i] ?? p.src }));
}

function useDiapositivas(): { lista: Diapositiva[]; hayCampana: boolean } {
  const { campana } = useCampana();
  const { data: catalogo = [] } = useCatalogoHome(60);
  const ahora = useMemo(() => Date.now(), []);

  return useMemo(() => {
    const hayCampana = !!campana;
    const ids = diapositivasActivas(hayCampana);
    const conFoto = catalogo.filter((p) => p.imagen_public_id || p.imagen_url);
    const salas = catalogo.filter((p) => p.categoria === "muebles");
    const salasFoto = conFoto.filter((p) => p.categoria === "muebles");
    const masNuevas = conFoto.slice(0, 3);
    const rellenar = (principal: Product[]): Product[] => [
      ...principal,
      ...conFoto.filter((p) => !principal.some((q) => q.id === p.id)),
    ].slice(0, 3);

    const lista: Diapositiva[] = ids.map((id): Diapositiva => {
      switch (id) {
        case "locura": {
          const c = campana!;
          const piezas = c.ofertas.filter((p) => p.imagen_public_id || p.imagen_url);
          const desde = precioMinimo(c.ofertas.map((p) => ofertaInfo(p).precioFinal));
          return {
            id,
            pestana: c.nombre ?? "Ofertas vigentes",
            etiqueta: textoTermina(diasRestantes(c.venceMs, ahora)),
            reloj: c.venceMs != null,
            titulo: c.nombre ?? "Ofertas vigentes",
            fantasma: lineasFantasma(c.nombre ?? "Ofertas vigentes"),
            pre: "Hasta",
            valor: `${c.maxDescuento}%`,
            detalle: (
              <>
                <span className="block whitespace-nowrap font-display text-sm font-bold md:text-2xl">de descuento</span>
                <span className="hidden text-xs italic opacity-90 md:block md:text-sm">en piezas seleccionadas del taller</span>
              </>
            ),
            boton: "Ver ofertas",
            destino: { tipo: "oferta" },
            nota: "*Precios con oferta vigente. Envío a todo el Perú.",
            piezas: conFotos(rellenar(piezas).map(aPieza), fotosPortada("01-locura")),
            insignia: desde != null ? { pre: "desde", valor: montoCorto(desde) } : null,
          };
        }
        case "salas": {
          const desde = precioMinimo(salas.map((p) => ofertaInfo(p).precioFinal));
          return {
            id,
            pestana: desde != null ? `Salas desde ${montoCorto(desde)}` : "Salas",
            etiqueta: "NUESTRAS SALAS",
            titulo: "Salas hechas a mano",
            fantasma: ["SALAS"],
            pre: "Desde",
            valor: desde != null ? montoCorto(desde) : "Salas",
            detalle: (
              <span className="block text-xs italic opacity-90 md:text-sm">
                {salas.length > 0 ? `${salas.length} ${salas.length === 1 ? "pieza" : "piezas"} en madera, hechas en nuestro taller` : "Hechas en nuestro taller"}
              </span>
            ),
            boton: "Ver salas",
            destino: { tipo: "categoria", slug: "muebles" },
            nota: null,
            piezas: conFotos(rellenar(salasFoto.slice(0, 3)).map(aPieza), fotosPortada("02-salas")),
            insignia: null,
          };
        }
        case "medida":
          return {
            id,
            pestana: "Hecho a tu medida",
            etiqueta: "A MEDIDA",
            titulo: "Hecho a tu medida",
            fantasma: ["A MEDIDA"],
            pre: "El taller",
            valor: "A tu medida",
            detalle: (
              <span className="block text-xs italic opacity-90 md:text-sm">
                Cuéntanos tu espacio y un asesor te contacta.
              </span>
            ),
            boton: "Cotizar a medida",
            destino: { tipo: "hash", hash: "a-medida" },
            nota: null,
            piezas: conFotos(rellenar(masNuevas).map(aPieza), fotosPortada("03-a-medida")),
            insignia: null,
          };
        case "pruebalo":
          return {
            id,
            pestana: "Pruébalo en tu espacio",
            etiqueta: "PRUÉBALO",
            titulo: "Pruébalo en tu espacio",
            fantasma: ["PRUÉBALO"],
            pre: "Sube una foto",
            valor: "de tu sala",
            detalle: (
              <span className="block text-xs italic opacity-90 md:text-sm">y mira cómo queda la pieza.</span>
            ),
            boton: "Probar ahora",
            destino: { tipo: "hash", hash: "pruebalo" },
            nota: null,
            piezas: conFotos(rellenar(masNuevas).map(aPieza), fotosPortada("04-pruebalo")),
            insignia: null,
          };
      }
    });
    return { lista, hayCampana };
  }, [campana, catalogo, ahora]);
}

function Boton({ d, texto }: { d: Destino; texto: string }) {
  const cls =
    "inline-flex min-h-[48px] items-center gap-2 rounded-full bg-white px-6 text-sm font-semibold uppercase tracking-wide text-gm-bosque shadow-lg transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gm-bosque md:min-h-[56px] md:px-8";
  const flecha = <ArrowRight className="h-4 w-4" aria-hidden />;
  if (d.tipo === "categoria")
    return (
      <Link to="/categoria/$slug" params={{ slug: d.slug }} className={cls}>
        {texto} {flecha}
      </Link>
    );
  if (d.tipo === "hash")
    return (
      <Link to="/" hash={d.hash} className={cls}>
        {texto} {flecha}
      </Link>
    );
  return (
    <Link to="/" hash="ofertas" className={cls}>
      {texto} {flecha}
    </Link>
  );
}

function Slide({ d, activa, indice, total }: { d: Diapositiva; activa: boolean; indice: number; total: number }) {
  return (
    <div
      id={`portada-slide-${d.id}`}
      role="tabpanel"
      aria-roledescription="diapositiva"
      aria-label={`${indice + 1} de ${total}: ${d.titulo}`}
      aria-hidden={!activa}
      // @ts-expect-error `inert` aún no está en los tipos de React 18
      inert={activa ? undefined : ""}
      className={`relative col-start-1 row-start-1 h-full transition-opacity duration-700 motion-reduce:transition-none ${
        activa ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      {/* Palabra fantasma de fondo */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-[5%] top-[6%] select-none font-display font-bold uppercase leading-[0.86] tracking-tight text-gm-bosque-2/70"
        style={{ fontSize: "clamp(4.25rem, 13.5vw, 12.5rem)" }}
      >
        {d.fantasma.map((l) => (
          <span key={l} className="block">
            {l}
          </span>
        ))}
      </div>

      {/* Texto */}
      <div className="relative z-10 flex h-full max-w-[60%] flex-col px-5 pb-12 pt-6 md:max-w-[46%] md:justify-center md:px-0 md:pb-10 md:pl-[6%] md:pt-0">
        {(() => {
          const etiqueta = d.etiqueta ? (
            <p className="text-xs font-semibold uppercase tracking-wide text-gm-durazno md:text-sm">{d.etiqueta}</p>
          ) : null;
          // Campaña con vencimiento: reloj visual en vivo; si ya terminó, queda la etiqueta de texto.
          return d.reloj ? <CampanaTicker variante="portada" fallback={etiqueta} /> : etiqueta;
        })()}
        <h2
          className="mt-2 font-display font-normal leading-[1.05] tracking-tight text-background md:mt-3"
          style={{ fontSize: "clamp(1.75rem, 4.4vw, 4rem)" }}
        >
          {d.titulo}
        </h2>
        <p className="mt-5 text-sm font-semibold uppercase tracking-wide text-background/90 md:mt-10 md:text-lg">
          {d.pre}
        </p>
        <div className="flex items-end gap-2 md:gap-4">
          <span
            className="whitespace-nowrap font-display font-normal leading-none text-gm-durazno"
            style={{ fontSize: d.valor.length > 5 ? "clamp(2.25rem, 5.6vw, 5.25rem)" : "clamp(3.25rem, 8vw, 7.25rem)" }}
          >
            {d.valor}
          </span>
          <span className="mb-1 min-w-0 max-w-[13rem] text-background md:mb-3">{d.detalle}</span>
        </div>
        <div className="mt-5 md:mt-9">
          <Boton d={d.destino} texto={d.boton} />
        </div>
        {d.nota && <p className="mt-4 hidden text-xs text-background/75 lg:block lg:mt-8">{d.nota}</p>}
      </div>

      {/* Tendedero */}
      <div className="absolute inset-0 md:inset-auto md:right-[7%] md:top-1/2 md:w-[50%] lg:w-[52%] md:max-w-[760px] md:-translate-y-1/2 md:aspect-[570/450]">
        {/* PC: una cuerda con hasta 3 piezas. Móvil: dos cuerdas cortas, una pieza en cada una. */}
        <TendederoPiezas variante="pc" piezas={d.piezas} className="hidden md:block inset-x-0 top-[14%]" />
        <TendederoPiezas variante="movil" indice={0} piezas={d.piezas.slice(0, 1)} className="md:hidden right-1 top-3 w-[48%]" />
        <TendederoPiezas variante="movil" indice={1} piezas={d.piezas.slice(1, 2)} className="md:hidden right-1 top-[40%] w-[48%]" />
        {d.insignia && (
          <div
            aria-hidden
            className="absolute bottom-[4%] right-[2%] hidden aspect-square w-[15%] lg:w-[12.3%] flex-col items-center justify-center rounded-full bg-gm-terracota text-center text-white shadow-lg md:flex"
          >
            <span className="text-xs leading-none">{d.insignia.pre}</span>
            <span className="mt-1 text-xs font-bold leading-none lg:text-lg">{d.insignia.valor}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── Carrusel ───────────────────────── */

function useCarrusel(total: number) {
  const [idx, setIdx] = useState(0);
  const [pausa, setPausa] = useState(false);
  const [manual, setManual] = useState(false);
  const actual = Math.min(idx, Math.max(total - 1, 0));

  useEffect(() => {
    if (total < 2 || pausa || manual || reducirMovimiento()) return;
    const t = window.setInterval(() => setIdx((i) => siguiente(i, 1, total)), CADA_MS);
    return () => window.clearInterval(t);
  }, [total, pausa, manual]);

  return {
    idx: actual,
    manual,
    ir: (n: number) => {
      setManual(true);
      setIdx(n);
    },
    mover: (paso: 1 | -1) => {
      setManual(true);
      setIdx(siguiente(actual, paso, total));
    },
    pausar: {
      onMouseEnter: () => setPausa(true),
      onMouseLeave: () => setPausa(false),
      onFocusCapture: () => setPausa(true),
      onBlurCapture: () => setPausa(false),
    },
  };
}

export function PortadaCarrusel() {
  const { lista } = useDiapositivas();
  const total = lista.length;
  const { idx, manual, ir, mover, pausar } = useCarrusel(total);

  return (
    <>
      <h1 className="sr-only">G&amp;M Mueblería: muebles hechos a mano para tu hogar</h1>
      <section
        aria-roledescription="carrusel"
        aria-label="Portada"
        className="relative isolate overflow-hidden bg-gm-bosque"
        {...pausar}
      >
        {/* Mismo alto en todas las diapositivas: se apilan en una sola celda de la cuadrícula */}
        <div className="grid h-[400px] md:h-[540px] lg:h-[620px] xl:h-[640px]" aria-live={manual ? "polite" : "off"}>
          {lista.map((d, i) => (
            <Slide key={d.id} d={d} activa={i === idx} indice={i} total={total} />
          ))}
        </div>

        {total > 1 && (
          <>
            <button
              type="button"
              onClick={() => mover(-1)}
              aria-label="Anterior"
              className="absolute left-3 top-1/2 z-20 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white text-gm-carbon shadow-md transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gm-bosque md:flex"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => mover(1)}
              aria-label="Siguiente"
              className="absolute right-3 top-1/2 z-20 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white text-gm-carbon shadow-md transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gm-bosque md:flex"
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
            <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-center">
              {lista.map((d, i) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => ir(i)}
                  aria-label={`Ver ${i + 1} de ${total}: ${d.titulo}`}
                  aria-current={i === idx ? "true" : undefined}
                  className="group flex h-11 w-7 items-center justify-center focus-visible:outline-none"
                >
                  <span
                    aria-hidden
                    className={`block h-2 rounded-full bg-white transition-all group-focus-visible:ring-2 group-focus-visible:ring-white group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-gm-bosque ${
                      i === idx ? "w-10" : "w-2 opacity-40 group-hover:opacity-70"
                    }`}
                  />
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Pestañas (solo PC/tablet): saltan a cualquier diapositiva */}
      {total > 1 && (
        <div className="hidden border-b border-border bg-card md:block">
          <div role="tablist" aria-label="Diapositivas de la portada" className="mx-auto grid max-w-[1280px]" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}>
            {lista.map((d, i) => (
              <button
                key={d.id}
                type="button"
                role="tab"
                aria-selected={i === idx}
                aria-controls={`portada-slide-${d.id}`}
                onClick={() => ir(i)}
                className={`relative min-h-[56px] px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
                  i === idx ? "font-semibold text-gm-terracota" : "text-foreground/70 hover:text-foreground"
                }`}
              >
                {d.pestana}
                <span
                  aria-hidden
                  className={`absolute inset-x-0 bottom-0 h-[3px] bg-gm-terracota transition-transform duration-300 ${
                    i === idx ? "scale-x-100" : "scale-x-0"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>
      )}

      <FranjaEnvios />
    </>
  );
}

/* ───────────────────────── Franja de envíos y pagos ───────────────────────── */

// Solo lo que el sitio ya ofrece (regla 15): envíos a todo el Perú, Yape/Plin/tarjeta, pago con Niubiz, WhatsApp.
export function FranjaEnvios() {
  const sep = (
    <span aria-hidden className="mx-2 opacity-50 md:mx-3">
      ·
    </span>
  );
  return (
    <div aria-label="Beneficios de comprar en G&M" role="group" className="bg-gm-arena px-4 py-3 text-center text-xs font-semibold text-primary md:py-4 md:text-sm">
      <p className="md:hidden">
        Envíos a todo el Perú{sep}Yape, Plin{sep}WhatsApp
      </p>
      <p className="hidden md:block">
        Envíos a todo el Perú{sep}Yape, Plin o tarjeta{sep}Compra segura con Niubiz{sep}Asesor por WhatsApp
      </p>
    </div>
  );
}