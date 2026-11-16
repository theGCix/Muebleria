// src/components/home/BannerLiquidacion.tsx
// Banner de liquidación (formato de referencia del dueño, 2026-11-16): foto de fondo, sellos «Delivery gratis» y
// «Compra segura» arriba a la derecha, «GRATIS · juego de cojines» abajo a la izquierda, rótulo + nombre + detalle y
// el precio azul con la etiqueta rosa del %, más «Precio regular» tachado. Solo cambia la información; el formato no.
// Todo escala con el ancho de la tarjeta (unidades cqw): en móvil (una tarjeta por fila) el factor --k los agranda.
// Etiqueta del %: muesca en flecha sobre el azul (como la referencia); cojines: foto del par de cojines beige (public/regalo-cojines.webp) junto al recuadro «GRATIS».
// Los colores azul y rosa son los de la referencia: el dueño pidió no tocarlos (excepción a la paleta Japandi, solo aquí).
import { Link } from "@tanstack/react-router";
import { ShieldCheck, Truck } from "lucide-react";
import { selloEnvio, numeroBanner, type EnvioTipo } from "@/lib/liquidacion";
import { slideImg } from "@/hooks/useCarruselHome";

const AZUL = "#1677FF";
const ROSA = "#F0198C";

export interface DatosBanner {
  imagen: string;
  kicker: string | null;
  nombre: string;
  detalle: string | null;
  precioRegular: number;
  precioFinal: number;
  descuento: number;
  envioTipo: EnvioTipo;
  envioDescuento: number | null;
  regaloCojines: boolean;
}

/**
 * Tamaños en % del ancho de la tarjeta (cqw), medidos de las referencias del dueño (tarjetas de 368, 558 y 840 px de ancho:
 * nombre ≈ 4.8 %, número del precio ≈ 4.2 %, rótulo ≈ 2.1 %, sellos ≈ 1.5 %). --k los agranda un poco en móvil (una tarjeta
 * por fila, ~330 px). Pisos en px para que nada sea ilegible.
 */
const t = (cqw: number, min = 10) => `max(${min}px, calc(var(--k, 1) * ${cqw}cqw))`;
const c = (cqw: number) => `calc(var(--k, 1) * ${cqw}cqw)`;

/** Par de cojines beige del regalo (foto con fondo transparente); solapa ~2.6 % el borde derecho del recuadro blanco (como la referencia) sin llegar al «GRATIS». */
function Cojines() {
  return (
    <img
      src="/regalo-cojines.webp"
      alt=""
      aria-hidden
      width={480}
      height={419}
      loading="lazy"
      decoding="async"
      className="pointer-events-none absolute h-auto max-w-none"
      style={{ left: `calc(100% - ${c(2.6)})`, bottom: c(-0.2), width: c(13), filter: "drop-shadow(0 2px 3px rgba(0,0,0,.3))" }}
    />
  );
}

/** Banner sin enlace (también lo usa la vista previa del admin). `ancho`: nombre y precio en una fila (tarjetas anchas de PC). */
export function BannerLiquidacion({ d, ancho = false, className = "" }: { d: DatosBanner; ancho?: boolean; className?: string }) {
  const sello = selloEnvio(d.envioTipo, d.envioDescuento);
  return (
    <div
      className={`relative overflow-hidden rounded-[22px] bg-muted text-white shadow-sm ${className}`}
      style={{ containerType: "inline-size" }}
    >
      <img
        src={slideImg(d.imagen, 1000)}
        alt=""
        width={1000}
        height={750}
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* Degradado inferior para que el texto se lea sobre cualquier foto */}
      <span aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

      {/* Capa de contenido: --k = 1 (referencia del dueño); solo en tarjetas angostas (< 360 px, móvil de una por fila) se agranda a 1.3 */}
      <div className="absolute inset-0 [--k:1] @max-[360px]:[--k:1.3]">
      {/* Sellos arriba a la derecha */}
      <div className="absolute flex items-start" style={{ top: c(1.4), right: c(1.4), gap: c(0.8) }}>
        {sello && (
          <div className="flex items-center text-white" style={{ background: ROSA, borderRadius: c(1.3), padding: `${c(0.7)} ${c(1.2)}`, gap: c(0.9) }}>
            <Truck aria-hidden style={{ width: c(3.4), height: c(3.4) }} className="shrink-0" />
            <div className="leading-tight">
              <p className="whitespace-nowrap font-extrabold" style={{ fontSize: t(1.55, 10) }}>{sello.titulo}</p>
              <p className="whitespace-nowrap font-bold" style={{ fontSize: t(0.95, 8) }}>{sello.detalle}</p>
            </div>
          </div>
        )}
        <div className="flex items-center bg-white text-neutral-600" style={{ borderRadius: c(1.3), padding: `${c(0.7)} ${c(1.2)}`, gap: c(0.8) }}>
          <ShieldCheck aria-hidden style={{ width: c(3.6), height: c(3.6) }} className="shrink-0" />
          <p className="font-bold leading-tight" style={{ fontSize: t(1.4, 9) }}>COMPRA<br />SEGURA</p>
        </div>
      </div>

      {/* Regalo abajo a la izquierda: los cojines salen del borde derecho del recuadro, no se superponen al texto */}
      {d.regaloCojines && (
        <div className="absolute bottom-0 left-0">
          <div
            className="relative bg-white"
            style={{ borderTopRightRadius: c(4), padding: `${c(1.4)} ${c(2.6)} ${c(1.6)} ${c(1.9)}` }}
          >
            <p className="font-extrabold leading-none tracking-tight" style={{ fontSize: t(2.7, 11), color: ROSA }}>GRATIS</p>
            <p className="font-bold leading-tight text-neutral-600" style={{ fontSize: t(1.3, 7), marginTop: c(0.4) }}>
              JUEGO<br />DE COJINES
            </p>
            <Cojines />
          </div>
        </div>
      )}

      {/* Nombre y precio abajo a la derecha */}
      <div
        className={`absolute flex ${ancho ? "items-end" : "flex-col items-start"}`}
        style={{ right: c(1.8), bottom: c(2.2), gap: c(1.6) }}
      >
        <div className="shrink-0 border-l-2 border-white/80" style={{ paddingLeft: c(1.1) }}>
          {d.kicker && <p className="whitespace-nowrap font-medium leading-tight" style={{ fontSize: t(2.1, 11) }}>{d.kicker}</p>}
          <p className="flex items-baseline whitespace-nowrap" style={{ gap: c(0.8) }}>
            <span className="font-extrabold uppercase leading-none" style={{ fontSize: t(4.8, 17) }}>{d.nombre}</span>
            {d.detalle && <span className="font-medium leading-none" style={{ fontSize: t(2, 11) }}>{d.detalle}</span>}
          </p>
        </div>
        <div className="flex shrink-0 flex-col" style={{ gap: c(0.6) }}>
          <div className="flex items-stretch" style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,.3))" }}>
            <span
              className="flex items-baseline whitespace-nowrap font-extrabold leading-none"
              style={{ background: AZUL, borderRadius: `${c(2)} ${c(1.2)} ${c(1.2)} ${c(2)}`, padding: `${c(1)} ${c(3)} ${c(1)} ${c(1.8)}`, gap: c(0.5) }}
            >
              <span className="font-bold" style={{ fontSize: t(2.2, 11) }}>s/</span>
              <span style={{ fontSize: t(3.9, 17) }}>{numeroBanner(d.precioFinal)}</span>
            </span>
            <span
              className="flex items-center font-extrabold leading-none"
              style={{
                background: ROSA,
                marginLeft: c(-2),
                borderRadius: `0 ${c(1.6)} ${c(1.6)} 0`,
                clipPath: `polygon(0 50%, ${c(1.5)} 0, 100% 0, 100% 100%, ${c(1.5)} 100%)`,
                padding: `0 ${c(1.8)} 0 ${c(3.4)}`,
                fontSize: t(3, 13),
              }}
            >
              {d.descuento}%
            </span>
          </div>
          <p className="whitespace-nowrap font-medium" style={{ fontSize: t(1.8, 10) }}>
            Precio regular: <span className="line-through">S/ {numeroBanner(d.precioRegular)}</span>
          </p>
        </div>
      </div>
      </div>
    </div>
  );
}

/** Banner clicable: lleva a la ficha del producto liquidado. */
export function TarjetaLiquidacion({ productId, d, ancho, className = "" }: { productId: string; d: DatosBanner; ancho?: boolean; className?: string }) {
  const etiqueta =
    `${d.kicker ? d.kicker + " " : ""}${d.nombre}${d.detalle ? " " + d.detalle : ""}, S/ ${numeroBanner(d.precioFinal)}, ` +
    `${d.descuento}% de descuento, precio regular S/ ${numeroBanner(d.precioRegular)}` +
    `${d.envioTipo === "gratis" ? ", delivery gratis a toda Lima Metropolitana" : ""}` +
    `${d.regaloCojines ? ", regalo: juego de cojines" : ""}`;
  return (
    <Link
      to="/product/$handle"
      params={{ handle: productId }}
      aria-label={etiqueta}
      className="group block rounded-[22px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <BannerLiquidacion d={d} ancho={ancho} className={className} />
    </Link>
  );
}