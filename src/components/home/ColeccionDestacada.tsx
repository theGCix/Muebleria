// src/components/home/ColeccionDestacada.tsx
// «Colección destacada»: carrusel 3D de 3 a 5 piezas (la actual al frente, las vecinas giradas) con nombre, precio y «Ver pieza».
// Fuente: 1) las diapositivas publicadas en el panel «Carrusel del home» (/carrusel; foto, título, texto, botón y enlace que
// escribe el dueño), si hay al menos 2; 2) si no, las piezas recientes con foto (saltando las 4 que ya muestra «Directo del
// taller a tu hogar»). Sin dependencias nuevas: CSS 3D + estado. Accesible: botones, flechas del teclado, arrastre táctil, puntos;
// sin giro automático; con «reducir movimiento» no anima.
import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Sofa } from "lucide-react";
import { useCatalogoHome } from "@/hooks/useCatalogoHome";
import { slideImg, useCarruselManual } from "@/hooks/useCarruselHome";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { elegirAutomaticas, mover, offsetCircular, poseTarjeta } from "@/lib/coleccionDestacada";
import { fmtPEN, ofertaInfo } from "@/lib/pricing";

interface Item {
  key: string;
  nombre: string;
  foto: string | null;
  detalle: string | null;
  etiqueta: string | null;
  cta: string;
  destino: { tipo: "pieza"; id: string } | { tipo: "enlace"; href: string } | null;
}

const PILDORA =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-background px-7 text-sm font-semibold text-gm-bosque transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gm-bosque";
const FLECHA =
  "absolute top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-background text-gm-bosque shadow-md transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gm-bosque";

export function ColeccionDestacada() {
  const { data: catalogo = [] } = useCatalogoHome(60);
  const { data: manuales = [] } = useCarruselManual();
  const [cur, setCur] = useState(0);
  const x0 = useRef<number | null>(null);

  const items = useMemo<Item[]>(() => {
    if (manuales.length >= 2) {
      return manuales.slice(0, 6).map((s) => ({
        key: s.id,
        nombre: s.titulo || s.etiqueta || "Pieza destacada",
        foto: slideImg(s.imagen_url, 700),
        detalle: s.bajada,
        etiqueta: null,
        cta: s.cta || "Ver pieza",
        destino: s.enlace ? { tipo: "enlace", href: s.enlace } : null,
      }));
    }
    const conFoto = catalogo.filter((p) => p.imagen_public_id || p.imagen_url);
    return elegirAutomaticas(conFoto, 5, 4).map((p) => {
      const info = ofertaInfo(p);
      return {
        key: p.id,
        nombre: p.nombre,
        foto: p.imagen_public_id ? cloudinaryUrl(p.imagen_public_id, { w: 480, h: 600 }) : p.imagen_url,
        detalle: fmtPEN(info.precioFinal),
        etiqueta: info.activa ? `-${Math.round(p.descuento_porcentaje ?? 0)}%` : null,
        cta: "Ver pieza",
        destino: { tipo: "pieza", id: p.id },
      };
    });
  }, [manuales, catalogo]);

  const n = items.length;
  if (n < 2) return null;

  const c = cur % n;
  const actual = items[c];
  const ir = (d: number) => setCur(mover(c, d, n));

  const alTeclado = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") ir(-1);
    if (e.key === "ArrowRight") ir(1);
  };
  const alBajar = (e: PointerEvent<HTMLDivElement>) => {
    x0.current = e.clientX;
  };
  const alSubir = (e: PointerEvent<HTMLDivElement>) => {
    if (x0.current === null) return;
    const dx = e.clientX - x0.current;
    x0.current = null;
    if (Math.abs(dx) > 40) ir(dx < 0 ? 1 : -1);
  };

  return (
    <section id="coleccion" aria-roledescription="carrusel" aria-labelledby="coleccion-titulo" className="bg-gm-bosque py-10 text-white md:py-14">
      <div className="container mx-auto max-w-6xl px-4">
        <h2 id="coleccion-titulo" className="text-center text-xs font-semibold uppercase tracking-[0.12em] text-gm-salvia md:text-sm">
          Colección destacada
        </h2>

        <div
          role="group"
          aria-label="Piezas destacadas"
          tabIndex={0}
          onKeyDown={alTeclado}
          onPointerDown={alBajar}
          onPointerUp={alSubir}
          className="mt-4 touch-pan-y select-none rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <div className="relative h-[17.5rem] overflow-hidden [perspective:900px] md:h-[23rem]">
            <button type="button" aria-label="Pieza anterior" onClick={() => ir(-1)} className={`${FLECHA} left-2 md:left-6`}>
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <button type="button" aria-label="Pieza siguiente" onClick={() => ir(1)} className={`${FLECHA} right-2 md:right-6`}>
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>

            {items.map((it, i) => {
              const o = offsetCircular(i, c, n);
              const p = poseTarjeta(o);
              const lateral = Math.abs(o) === 1;
              return (
                <div
                  key={it.key}
                  aria-hidden={o !== 0}
                  onClick={lateral ? () => ir(o) : undefined}
                  style={{
                    transform: `translate(-50%, -50%) translateX(${p.x}%) rotateY(${p.rot}deg) scale(${p.escala})`,
                    opacity: p.opacidad,
                    zIndex: p.z,
                    pointerEvents: Math.abs(o) > 1 ? "none" : "auto",
                  }}
                  className={`absolute left-1/2 top-1/2 aspect-[4/5] w-[9.5rem] overflow-hidden rounded-2xl bg-gm-arena shadow-xl transition-[transform,opacity] duration-700 ease-out motion-reduce:transition-none md:w-[14rem] ${
                    lateral ? "cursor-pointer" : ""
                  }`}
                >
                  {it.foto ? (
                    <img
                      src={it.foto}
                      alt=""
                      width={480}
                      height={600}
                      draggable={false}
                      loading={i === 0 ? "eager" : "lazy"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-gm-cafe/30">
                      <Sofa className="h-1/3 w-1/3" aria-hidden />
                    </span>
                  )}
                  {it.etiqueta && (
                    <span className="absolute left-2 top-2 rounded-full bg-gm-terracota px-2.5 py-0.5 text-xs font-semibold text-white">
                      {it.etiqueta}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div aria-live="polite" className="mt-3 text-center">
            <p className="font-display text-[1.375rem] leading-tight md:text-3xl">{actual.nombre}</p>
            {actual.detalle && <p className="mt-1 text-base font-semibold text-gm-durazno md:text-lg">{actual.detalle}</p>}
            {actual.destino && (
              <div className="mt-4 flex justify-center">
                {actual.destino.tipo === "pieza" ? (
                  <Link to="/product/$handle" params={{ handle: actual.destino.id }} className={PILDORA}>
                    {actual.cta}
                  </Link>
                ) : (
                  <a href={actual.destino.href} className={PILDORA}>
                    {actual.cta}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex justify-center">
          {items.map((it, i) => (
            <button
              key={it.key}
              type="button"
              aria-label={`Ir a la pieza ${i + 1}`}
              aria-current={i === c}
              onClick={() => setCur(i)}
              className="flex h-6 w-6 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <span className={`h-2 w-2 rounded-full ${i === c ? "bg-white" : "bg-white/40"}`} />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
