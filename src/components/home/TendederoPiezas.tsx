// src/components/home/TendederoPiezas.tsx
// Las piezas de la portada colgadas de una cuerda con pinzas, como fotos en un tendedero (boceto aprobado).
//  · PC: una cuerda con hasta 3 piezas, bien separadas y casi al unísono para que no se tapen al balancearse.
//  · Móvil: dos cuerdas cortas, una pieza en cada una (solo el precio, sin nombre).
// Cada pieza es un péndulo (lib/tendedero.ts): se mece sola, se inclina con el celular, reacciona a sacudidas y
// al toque (hooks/useInclinacion.ts). Con «reducir movimiento» queda quieta y apenas ladeada. Cada pieza sigue
// siendo un enlace a su ficha.
import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Sofa } from "lucide-react";
import { alTocar, empujar, inclinacion, useInclinacion } from "@/hooks/useInclinacion";
import {
  caida,
  disposicionPC,
  DISPOSICION_MOVIL,
  paramsPendulo,
  pasoPendulo,
  type Aspecto,
} from "@/lib/tendedero";

export interface PiezaColgante {
  src: string | null;
  nombre: string;
  id?: string;
  precio: string | null;
}

const ASPECTO: Record<Aspecto, string> = {
  "4/5": "aspect-[4/5]",
  "7/10": "aspect-[7/10]",
  "4/3": "aspect-[4/3]",
};

function Colgante({ indice, pc, children }: { indice: number; pc: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const inicial = indice % 2 === 0 ? -1.5 : 1.5;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.style.transform = `rotate(${inicial}deg)`;
      return;
    }

    const par = paramsPendulo(indice, pc);
    const e = { a: inicial, v: 0 };
    let golpeVisto = inclinacion.golpe.n;
    let anterior = performance.now();
    let raf = 0;
    let timer = 0;
    let vivo = true;

    const paso = (ahora: number) => {
      if (!vivo) return;
      // Pestaña oculta, versión no visible (PC/móvil) o diapositiva inactiva: se duerme y se revisa de vez en cuando.
      if (document.hidden || el.offsetParent === null || el.closest('[role="tabpanel"][aria-hidden="true"]')) {
        anterior = performance.now();
        timer = window.setTimeout(() => {
          raf = requestAnimationFrame(paso);
        }, 400);
        return;
      }
      const dt = Math.min((ahora - anterior) / 1000, 0.032);
      anterior = ahora;
      if (inclinacion.golpe.n !== golpeVisto) {
        golpeVisto = inclinacion.golpe.n;
        e.v += inclinacion.golpe.fuerza * par.s * par.g;
      }
      pasoPendulo(e, par, inclinacion.objetivo, ahora / 1000, dt);
      el.style.transform = `rotate(${e.a.toFixed(2)}deg)`;
      raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);

    return () => {
      vivo = false;
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [indice, pc]);

  return (
    <div ref={ref} className="relative origin-top will-change-transform">
      {[24, 76].map((x) => (
        <span
          key={x}
          aria-hidden
          style={{ left: `${x}%` }}
          className="absolute -top-2 z-10 h-4 w-[9px] -translate-x-1/2 rounded-[2px] border border-gm-cafe/60 bg-gm-madera after:absolute after:inset-x-0 after:top-1/2 after:h-px after:bg-gm-cafe/60 after:content-['']"
        />
      ))}
      {children}
    </div>
  );
}

function Marco({ pieza, aspecto, pc }: { pieza: PiezaColgante; aspecto: Aspecto; pc: boolean }) {
  const cls =
    "block rounded-lg bg-[#F7F4EF] p-1.5 pb-2 shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gm-bosque";
  const contenido = (
    <>
      <span className={`relative block w-full overflow-hidden rounded bg-gm-arena ${ASPECTO[aspecto]}`}>
        {pieza.src ? (
          <img
            src={pieza.src}
            alt={pieza.nombre}
            width={720}
            height={540}
            loading="lazy"
            draggable={false}
            className="h-full w-full object-cover"
          />
        ) : (
          <span aria-hidden className="flex h-full w-full items-center justify-center text-gm-cafe/50">
            <Sofa className="h-1/3 w-1/3" />
          </span>
        )}
      </span>
      {pc && (
        <span className="mt-2 block truncate px-0.5 text-xs font-medium leading-tight text-gm-carbon lg:text-sm">
          {pieza.nombre}
        </span>
      )}
      {pieza.precio && (
        <span className="mt-0.5 block px-0.5 text-xs text-gm-terracota lg:text-sm">{pieza.precio}</span>
      )}
    </>
  );
  return pieza.id ? (
    <Link to="/product/$handle" params={{ handle: pieza.id }} className={cls}>
      {contenido}
    </Link>
  ) : (
    <div className={cls}>{contenido}</div>
  );
}

/**
 * Una cuerda con sus piezas. `className` la coloca dentro de la diapositiva (posición absoluta). En móvil se usa una
 * cuerda por pieza: `indice` (0 o 1) elige su disposición y su ritmo.
 */
export function TendederoPiezas({
  piezas,
  variante,
  indice = 0,
  className = "",
}: {
  piezas: PiezaColgante[];
  variante: "pc" | "movil";
  indice?: 0 | 1;
  className?: string;
}) {
  useInclinacion();
  const pc = variante === "pc";
  const sag = pc ? 10 : 6;
  const huecos = pc ? disposicionPC(piezas.length) : [DISPOSICION_MOVIL[indice]];
  const curva = `M0 3 Q50 ${3 + 2 * sag} 100 3`;

  return (
    <div className={`absolute z-[5] h-8 ${className}`}>
      {/* Cuerda de pita */}
      <svg
        aria-hidden
        viewBox="0 0 100 30"
        preserveAspectRatio="none"
        className="pointer-events-none absolute left-0 top-0 h-[30px] w-full overflow-visible"
      >
        <path d={curva} fill="none" strokeWidth="2.4" strokeLinecap="round" vectorEffect="non-scaling-stroke" className="stroke-gm-pita" />
        <path d={curva} fill="none" strokeWidth="1.6" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" className="stroke-gm-madera" />
      </svg>
      <span aria-hidden className="absolute -left-1 -top-px h-[9px] w-[9px] rounded-full border border-gm-madera bg-gm-pita" />
      {/* Zona táctil de la cuerda: empuja y, en iPhone, pide el permiso del movimiento */}
      <div aria-hidden className="absolute inset-x-0 -top-3 h-8 [touch-action:manipulation]" onPointerDown={alTocar} />

      {huecos.map((h, i) => {
        const pieza = piezas[i];
        if (!pieza) return null;
        const t = h.x + h.w / 2;
        return (
          <div
            key={`${pieza.id ?? pieza.nombre}-${i}`}
            className="absolute select-none"
            style={{ left: `${h.x * 100}%`, width: `${h.w * 100}%`, top: caida(t, sag) + 4 }}
            onPointerDown={empujar}
          >
            <Colgante indice={pc ? i : indice} pc={pc}>
              <Marco pieza={pieza} aspecto={h.aspecto} pc={pc} />
            </Colgante>
          </div>
        );
      })}
    </div>
  );
}
