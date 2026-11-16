// src/components/home/BannerLiquidacion.tsx
// Banner de liquidación (formato de referencia del dueño, 2026-11-16): foto de fondo, sellos «Delivery gratis» y
// «Compra segura» arriba a la derecha, «GRATIS · juego de cojines» abajo a la izquierda, rótulo + nombre + detalle y
// el precio azul con la etiqueta rosa del %, más «Precio regular» tachado. Solo cambia la información; el formato no.
// Todo escala con el ancho de la tarjeta (unidades cqw): en móvil (una tarjeta por fila) el factor --k los agranda.
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

/** Tamaño que escala con la tarjeta; --k lo agranda en móvil. Mínimo 10 px para que nada sea ilegible. */
const t = (cqw: number, min = 10) => `max(${min}px, calc(var(--k, 1) * ${cqw}cqw))`;
const c = (cqw: number) => `calc(var(--k, 1) * ${cqw}cqw)`;

function Cojines() {
  return (
    <svg viewBox="0 0 110 120" aria-hidden className="absolute" style={{ left: c(24), bottom: c(0.5), width: c(23) }}>
      <defs>
        <linearGradient id="cojin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F4E8D2" />
          <stop offset="1" stopColor="#DCC7A4" />
        </linearGradient>
      </defs>
      <path d="M6 22 Q38 4 66 16 Q74 44 64 74 Q34 88 4 72 Q12 46 6 22Z" fill="url(#cojin)" stroke="#CDB68F" strokeWidth="0.8" />
      <path d="M40 64 Q70 46 100 62 Q106 90 94 112 Q64 122 38 108 Q46 86 40 64Z" fill="url(#cojin)" stroke="#CDB68F" strokeWidth="0.8" />
    </svg>
  );
}

/** Banner sin enlace (también lo usa la vista previa del admin). `ancho`: nombre y precio en una fila (tarjetas anchas de PC). */
export function BannerLiquidacion({ d, ancho = false, className = "" }: { d: DatosBanner; ancho?: boolean; className?: string }) {
  const sello = selloEnvio(d.envioTipo, d.envioDescuento);
  return (
    <div
      className={`relative overflow-hidden rounded-[22px] bg-muted text-white shadow-sm [--k:1.3] lg:[--k:1] ${className}`}
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

      {/* Sellos arriba a la derecha */}
      <div className="absolute flex items-start" style={{ top: c(2.2), right: c(2.2), gap: c(1.2) }}>
        {sello && (
          <div className="flex items-center text-white" style={{ background: ROSA, borderRadius: c(2.2), padding: `${c(1.1)} ${c(2)}`, gap: c(1.4) }}>
            <Truck aria-hidden style={{ width: c(6.5), height: c(6.5) }} className="shrink-0" />
            <div className="leading-tight">
              <p className="font-extrabold" style={{ fontSize: t(3) }}>{sello.titulo}</p>
              <p className="font-bold" style={{ fontSize: t(1.9, 9) }}>{sello.detalle}</p>
            </div>
          </div>
        )}
        <div className="flex items-center bg-white text-neutral-600" style={{ borderRadius: c(2.2), padding: `${c(1.1)} ${c(2)}`, gap: c(1.2) }}>
          <ShieldCheck aria-hidden style={{ width: c(5.5), height: c(5.5) }} className="shrink-0" />
          <p className="font-bold leading-tight" style={{ fontSize: t(2.4, 9) }}>COMPRA<br />SEGURA</p>
        </div>
      </div>

      {/* Regalo abajo a la izquierda */}
      {d.regaloCojines && (
        <>
          <div
            className="absolute bottom-0 left-0 bg-white"
            style={{ borderTopRightRadius: c(9), paddingLeft: c(3), paddingRight: c(8), paddingTop: c(2.2), paddingBottom: c(2.4) }}
          >
            <p className="font-extrabold leading-none" style={{ fontSize: t(6.4, 14), color: ROSA }}>GRATIS</p>
            <p className="mt-0.5 font-bold leading-tight text-neutral-600" style={{ fontSize: t(2.5, 9) }}>
              JUEGO<br />DE COJINES
            </p>
          </div>
          <Cojines />
        </>
      )}

      {/* Nombre y precio abajo a la derecha */}
      <div
        className={`absolute flex ${ancho ? "items-end" : "flex-col items-start"}`}
        style={{ right: c(2.6), bottom: c(3), gap: c(2.4) }}
      >
        <div className="border-l-2 border-white/80" style={{ paddingLeft: c(1.8) }}>
          {d.kicker && <p className="font-medium leading-tight" style={{ fontSize: t(3.1, 11) }}>{d.kicker}</p>}
          <p className="flex items-baseline" style={{ gap: c(1.2) }}>
            <span className="font-extrabold uppercase leading-none" style={{ fontSize: t(7.2, 16) }}>{d.nombre}</span>
            {d.detalle && <span className="font-medium leading-none" style={{ fontSize: t(3.1, 11) }}>{d.detalle}</span>}
          </p>
        </div>
        <div className="flex flex-col" style={{ gap: c(0.8) }}>
          <div className="flex items-stretch">
            <span
              className="flex items-baseline font-extrabold leading-none"
              style={{ background: AZUL, borderTopLeftRadius: c(2.2), borderBottomLeftRadius: c(2.2), padding: `${c(1.3)} ${c(5)} ${c(1.3)} ${c(2.4)}`, gap: c(0.6) }}
            >
              <span style={{ fontSize: t(3.8, 11) }}>s/</span>
              <span style={{ fontSize: t(8.2, 18) }}>{numeroBanner(d.precioFinal)}</span>
            </span>
            <span
              className="flex items-center font-extrabold leading-none"
              style={{ background: ROSA, marginLeft: c(-2.8), borderRadius: c(2.2), padding: `0 ${c(2.4)}`, fontSize: t(5, 13) }}
            >
              {d.descuento}%
            </span>
          </div>
          <p className="font-medium" style={{ fontSize: t(2.5, 10) }}>
            Precio regular: <span className="line-through">S/ {numeroBanner(d.precioRegular)}</span>
          </p>
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
