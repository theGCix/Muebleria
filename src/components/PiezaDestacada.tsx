// src/components/PiezaDestacada.tsx
// Pieza protagonista del catálogo: ocupa 2x2 en la cuadrícula.
// Todo lo que muestra sale de datos reales (oferta vigente, stock, fecha de alta).
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Check,
  Image as ImageIcon,
  ShoppingBag,
  ArrowUpRight,
  Flame,
  Sparkles,
} from "lucide-react";
import { useCartStore } from "@/stores/cartStore";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { fmtPEN, ofertaInfo, textoCuentaRegresiva } from "@/lib/pricing";
import type { Product } from "@/hooks/useProducts";

const DIAS_NUEVO = 30;
const STOCK_BAJO = 10;

export function PiezaDestacada({ product: p }: { product: Product }) {
  const addItem = useCartStore((s) => s.addItem);
  const enCarrito = useCartStore((s) => s.items.some((i) => i.id === p.id));

  const { activa, precioFinal, ahorro, venceEl } = ofertaInfo(p);
  const cuenta = activa ? textoCuentaRegresiva(venceEl) : null;
  const agotado = (p.stock ?? 1) <= 0;
  const pocoStock = p.stock != null && p.stock > 0 && p.stock <= STOCK_BAJO;

  const esNueva = Date.now() - new Date(p.created_at).getTime() < DIAS_NUEVO * 24 * 60 * 60 * 1000;
  const etiqueta = activa
    ? "Mayor descuento ahora"
    : esNueva
      ? "Recién llegada"
      : "Pieza destacada";
  const EtiquetaIcon = activa ? Flame : Sparkles;

  const img = p.imagen_public_id
    ? cloudinaryUrl(p.imagen_public_id, { w: 900, h: 900 })
    : p.imagen_url;

  const agregar = () => {
    addItem({
      id: p.id,
      title: p.nombre,
      price: precioFinal,
      image: img ?? "",
      sku: p.sku ?? undefined,
    });
    toast.success(`"${p.nombre}" añadido al carrito`);
  };

  return (
    <article className="group relative isolate flex min-h-[440px] h-full flex-col justify-end overflow-hidden rounded-2xl bg-[var(--wood-dark)] text-white shadow-[var(--shadow-elegant)]">
      {/* Fondo: toda la imagen es un enlace a la ficha */}
      <Link
        to="/product/$handle"
        params={{ handle: p.id }}
        aria-label={`Ver ${p.nombre}`}
        className="absolute inset-0 z-0"
      >
        {img ? (
          <img
            src={img}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-white/30">
            <ImageIcon className="h-16 w-16" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/5" />
      </Link>

      {/* Etiqueta superior */}
      <div className="pointer-events-none absolute left-4 top-4 z-10 flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm backdrop-blur ${
            activa
              ? "bg-destructive text-destructive-foreground"
              : "bg-white/90 text-[var(--wood-dark)]"
          }`}
        >
          <EtiquetaIcon className="h-3.5 w-3.5" />
          {etiqueta}
        </span>
        {activa && p.descuento_porcentaje ? (
          <span className="rounded-full bg-white/90 px-2.5 py-1.5 text-xs font-bold text-destructive shadow-sm">
            -{p.descuento_porcentaje}%
          </span>
        ) : null}
      </div>

      {/* Contenido */}
      <div className="pointer-events-none relative z-10 flex flex-col gap-3 p-5 md:p-7">
        {p.categoria && (
          <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/70">
            {p.categoria}
          </span>
        )}
        <h3 className="font-display text-3xl font-semibold leading-[1.05] md:text-[2.6rem]">
          {p.nombre}
        </h3>
        {p.descripcion && (
          <p className="line-clamp-2 max-w-md text-sm text-white/75">{p.descripcion}</p>
        )}

        <div className="mt-1 flex flex-wrap items-end gap-x-4 gap-y-1">
          <span className="font-display text-4xl font-semibold leading-none">
            {fmtPEN(precioFinal)}
          </span>
          {activa && (
            <span className="pb-0.5 text-sm text-white/60 line-through">{fmtPEN(p.precio)}</span>
          )}
          {activa && ahorro > 0 && (
            <span className="pb-0.5 text-sm font-semibold text-[var(--color-gold-light)]">
              Ahorras {fmtPEN(ahorro)}
            </span>
          )}
        </div>

        {(cuenta || pocoStock) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-white/85">
            {cuenta && <span>{cuenta}</span>}
            {pocoStock && (
              <span className="flex min-w-[170px] flex-col gap-1">
                <span className="h-1.5 overflow-hidden rounded-full bg-white/20">
                  <span
                    className="block h-full rounded-full bg-[var(--color-gold)]"
                    style={{ width: `${Math.max(8, ((p.stock ?? 0) / STOCK_BAJO) * 100)}%` }}
                  />
                </span>
                {p.stock === 1 ? "Queda 1 unidad" : `Quedan ${p.stock} unidades`}
              </span>
            )}
          </div>
        )}

        <div className="pointer-events-auto mt-2 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={agregar}
            disabled={agotado || enCarrito}
            className={`inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-all duration-300 ${
              agotado
                ? "cursor-default bg-white/20 text-white/60"
                : enCarrito
                  ? "cursor-default bg-emerald-50 text-emerald-700"
                  : "bg-white text-[var(--wood-dark)] shadow-lg hover:-translate-y-0.5 hover:bg-[var(--color-gold-light)] active:scale-[0.98]"
            }`}
          >
            {enCarrito ? <Check className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
            {agotado ? "Agotado" : enCarrito ? "En el carrito" : "Agregar al carrito"}
          </button>
          <Link
            to="/product/$handle"
            params={{ handle: p.id }}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/40 px-5 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/15"
          >
            Ver detalles <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}