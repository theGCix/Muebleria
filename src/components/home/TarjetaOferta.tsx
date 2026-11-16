// src/components/home/TarjetaOferta.tsx
// Tarjeta de oferta del home (referencia del dueño, 2026-11-16): foto del producto con sellos «Delivery gratis» y
// «Compra segura» arriba, regalo («GRATIS · juego de N cojines») abajo a la izquierda, nombre grande, precio con la
// etiqueta del descuento y «Precio regular». Todo varía por producto: nombre, precio de oferta, precio regular y %.
import { Link } from "@tanstack/react-router";
import { Gift, ShieldCheck, Sofa, Truck } from "lucide-react";
import { ENVIO_GRATIS_OFERTAS, REGALO_COJINES, fmtSolesBanner, partirNombre, textoRegalo } from "@/lib/ofertaBanner";

export interface OfertaTarjeta {
  id: string;
  nombre: string;
  descuento: number;
  precioFinal: number;
  precioOriginal: number;
  foto: string | null;
}

export function TarjetaOferta({ o }: { o: OfertaTarjeta }) {
  const { kicker, principal } = partirNombre(o.nombre);
  const etiqueta =
    `${o.nombre}, ${fmtSolesBanner(o.precioFinal)}, ${o.descuento}% de descuento, precio regular ${fmtSolesBanner(o.precioOriginal)}` +
    `${ENVIO_GRATIS_OFERTAS ? ", delivery gratis" : ""}, regalo: ${textoRegalo(REGALO_COJINES).toLowerCase()}`;

  return (
    <Link
      to="/product/$handle"
      params={{ handle: o.id }}
      aria-label={etiqueta}
      className="group relative block aspect-[4/3] overflow-hidden rounded-[22px] bg-gm-arena text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gm-terracota"
    >
      {o.foto ? (
        <img
          src={o.foto}
          alt=""
          width={900}
          height={675}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-gm-cafe/30">
          <Sofa className="h-1/3 w-1/3" aria-hidden />
        </span>
      )}

      {/* Degradado para que el texto se lea sobre cualquier foto */}
      <span aria-hidden className="absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-t from-gm-carbon/95 via-gm-carbon/65 to-transparent" />

      {/* Sellos */}
      <span className="absolute inset-x-2.5 top-2.5 flex items-start justify-between gap-2">
        {ENVIO_GRATIS_OFERTAS ? (
          <span className="inline-flex items-center gap-2 rounded-xl bg-gm-bosque px-2.5 py-1.5 leading-tight">
            <Truck className="h-5 w-5 shrink-0 text-gm-tan" aria-hidden />
            <span>
              <span className="block text-[13px] font-extrabold tracking-wide">DELIVERY GRATIS</span>
              <span className="block text-xs font-semibold text-gm-tan">A TODO LIMA</span>
            </span>
          </span>
        ) : (
          <span />
        )}
        <span className="inline-flex items-center gap-1.5 rounded-xl bg-white px-2.5 py-1.5 text-gm-bosque">
          <ShieldCheck className="h-5 w-5 shrink-0" aria-hidden />
          <span className="text-xs font-bold leading-tight">COMPRA<br />SEGURA</span>
        </span>
      </span>

      {/* Parte baja: regalo, nombre y precio */}
      <span className="absolute inset-x-3 bottom-3 flex flex-col gap-2">
        <span className="inline-flex items-center gap-2 self-start rounded-2xl bg-white px-3 py-1.5 text-gm-bosque">
          <Gift className="h-4 w-4 shrink-0 text-gm-terracota" aria-hidden />
          <span className="leading-none">
            <span className="block font-display text-sm font-extrabold text-gm-terracota">GRATIS</span>
            <span className="mt-0.5 block text-xs font-bold">{textoRegalo(REGALO_COJINES)}</span>
          </span>
        </span>

        <span className="flex items-end justify-between gap-3">
          <span className="min-w-0 flex-1 border-l-2 border-white/70 pl-2.5">
            {kicker && <span className="block truncate text-xs font-medium text-white/90 sm:text-sm">{kicker}</span>}
            <span className="line-clamp-2 block font-display text-xl font-extrabold uppercase leading-[1.05] sm:text-2xl">{principal}</span>
          </span>
          <span className="flex shrink-0 flex-col items-end gap-1">
            <span className="flex items-stretch">
              <span className="rounded-l-xl bg-white px-2.5 py-1 font-display text-xl font-extrabold text-gm-bosque sm:text-2xl">
                {fmtSolesBanner(o.precioFinal)}
              </span>
              <span className="flex items-center rounded-r-xl bg-gm-terracota px-2 text-sm font-bold text-white sm:text-base">-{o.descuento}%</span>
            </span>
            <span className="text-xs text-white/90">
              Precio regular: <span className="line-through">{fmtSolesBanner(o.precioOriginal)}</span>
            </span>
          </span>
        </span>
      </span>
    </Link>
  );
}
