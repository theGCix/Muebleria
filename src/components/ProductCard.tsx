// src/components/ProductCard.tsx
// Tarjeta "vitrina": cada señal que muestra sale de datos reales (oferta, stock, reseñas, plazo de entrega).
// Nada de urgencia o prueba social inventada: si el dato no existe, el elemento no aparece.
import { Link } from "@tanstack/react-router";
import { useCartStore } from "@/stores/cartStore";
import {
  ShoppingBag, Image as ImageIcon, Heart, Check, Star, Truck, Ruler, ArrowUpRight, Sparkles, Minus, Plus, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cloudinaryUrl } from "@/lib/cloudinary";
import type { Product } from "@/hooks/useProducts";
import { useWishlist } from "@/context/WishlistContext";
import { useEffect, useMemo, useRef, useState } from "react";
import { LeadFormDialog } from "./LeadFormDialog";
import { fmtPEN, ofertaInfo, textoCuentaRegresiva } from "@/lib/pricing";
import { useProductRating } from "@/hooks/useProductRatings";
import { getPrecioEnvio } from "@/lib/envios";
import { leerDistritoGuardado, rangoEntregaCorto } from "@/lib/entrega";
import "./product-card.css";

interface Props { product: Product; }

/** Días durante los que un producto se considera "Nuevo". */
const DIAS_NUEVO = 14;
/** Con ≤ N unidades se muestra el aviso de poco stock (con oferta activa el umbral sube a 10). */
const UMBRAL_STOCK = 5;
const UMBRAL_STOCK_OFERTA = 10;
/** "Más valorado": promedio mínimo y reseñas mínimas (mismo mínimo que la sección de testimonios). */
const MIN_PROMEDIO_TOP = 4.5;
const MIN_RESENAS_TOP = 3;

/** Normaliza para comparar textos ("Comedor 6 sillas" vs "comedor 6  sillas."). */
const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/** La descripción solo se muestra si aporta algo: si repite el nombre se descarta. */
function descripcionUtil(nombre: string, desc: string | null): string | null {
  if (!desc) return null;
  const d = norm(desc), n = norm(nombre);
  if (!d || d === n || n.includes(d)) return null;
  if (d.startsWith(n) && d.length - n.length < 12) return null;
  return desc;
}

/** Estrellas con relleno proporcional al promedio (4.3 llena 86 %). */
function Estrellas({ promedio }: { promedio: number }) {
  const pct = Math.max(0, Math.min(100, (promedio / 5) * 100));
  const fila = (cls: string) => (
    <span className="inline-flex">
      {[0, 1, 2, 3, 4].map((i) => <Star key={i} className={`h-3.5 w-3.5 shrink-0 ${cls}`} />)}
    </span>
  );
  return (
    <span className="relative inline-flex" aria-hidden>
      {fila("text-muted-foreground/30")}
      <span className="absolute inset-0 overflow-hidden" style={{ width: `${pct}%` }}>
        {fila("text-amber-500 fill-amber-500")}
      </span>
    </span>
  );
}

/** La miniatura del producto vuela hasta el ícono del carrito del header. */
function volarAlCarrito(origen: HTMLElement | null, src: string) {
  if (!origen || !src || typeof document === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const destino = Array.from(document.querySelectorAll<HTMLElement>("[data-cart-target]"))
    .find((el) => el.getBoundingClientRect().width > 0);
  if (!destino) return;

  const a = origen.getBoundingClientRect();
  const b = destino.getBoundingClientRect();
  const fantasma = document.createElement("img");
  fantasma.src = src;
  fantasma.alt = "";
  fantasma.className = "gmc-ghost";
  Object.assign(fantasma.style, {
    left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px`,
  });
  document.body.appendChild(fantasma);

  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const anim = fantasma.animate(
    [
      { transform: "translate(0,0) scale(1)", opacity: 1, borderRadius: "12px" },
      { transform: `translate(${dx * 0.55}px, ${dy * 0.3 - 48}px) scale(.42)`, opacity: 0.95, offset: 0.55 },
      { transform: `translate(${dx}px, ${dy}px) scale(.06)`, opacity: 0.25, borderRadius: "50%" },
    ],
    { duration: 800, easing: "cubic-bezier(.5,0,.2,1)" },
  );
  anim.onfinish = () => {
    fantasma.remove();
    destino.classList.remove("gmc-bump");
    void destino.offsetWidth; // reinicia la animación si ya estaba corriendo
    destino.classList.add("gmc-bump");
    window.setTimeout(() => destino.classList.remove("gmc-bump"), 700);
  };
  anim.oncancel = () => fantasma.remove();
}

export function ProductCard({ product: p }: Props) {
  const addItem = useCartStore((s) => s.addItem);
  const updateQty = useCartStore((s) => s.updateQty);
  const removeItem = useCartStore((s) => s.removeItem);
  const items = useCartStore((s) => s.items);
  const { toggleWishlist, isWishlisted } = useWishlist();
  const [wishPending, setWishPending] = useState(false);
  const [medidaOpen, setMedidaOpen] = useState(false);
  const [entrega, setEntrega] = useState<{ rango: string; distrito: string; envio: number | null } | null>(null);

  const cardRef = useRef<HTMLElement | null>(null);
  const mediaRef = useRef<HTMLDivElement | null>(null);

  const rating = useProductRating(p.id);
  const qty = items.find((i) => i.id === p.id)?.qty ?? 0;
  const enCarrito = qty > 0;
  const agotado = (p.stock ?? 1) <= 0;
  const maxQty = p.stock ?? Infinity;          // sin dato de stock: no se limita
  const llegoAlMaximo = qty >= maxQty;
  const wishlisted = isWishlisted(p.id);

  const { activa: enOferta, precioFinal: precioOferta, venceEl } = ofertaInfo(p);
  const cuentaRegresiva = enOferta ? textoCuentaRegresiva(venceEl) : null;

  const imgSrc = p.imagen_public_id ? cloudinaryUrl(p.imagen_public_id, { w: 400, h: 300 }) : p.imagen_url;

  // Fecha y envío se calculan en el cliente (evita desajustes de hidratación por zona horaria)
  useEffect(() => {
    const distrito = leerDistritoGuardado();
    setEntrega({ rango: rangoEntregaCorto(), distrito, envio: distrito ? getPrecioEnvio(distrito) : null });
  }, []);

  const descripcion = descripcionUtil(p.nombre, p.descripcion);
  const atributos = [p.material_base, p.subcategoria].filter(
    (v, i, arr): v is string => !!v && arr.indexOf(v) === i && norm(v) !== norm(p.nombre),
  );

  // Insignias: como máximo 2, por prioridad
  const insignias = useMemo(() => {
    const out: { key: string; texto: string; cls: string; icono?: "estrella" | "chispa" }[] = [];
    if (enOferta && p.descuento_porcentaje) {
      out.push({ key: "oferta", texto: `-${p.descuento_porcentaje}%`, cls: "bg-destructive text-destructive-foreground" });
    }
    if (rating && rating.promedio >= MIN_PROMEDIO_TOP && rating.total >= MIN_RESENAS_TOP) {
      out.push({ key: "top", texto: "Favorito", cls: "bg-amber-500 text-white", icono: "estrella" });
    }
    const dias = (Date.now() - new Date(p.created_at).getTime()) / 86_400_000;
    if (dias >= 0 && dias <= DIAS_NUEVO) {
      out.push({ key: "nuevo", texto: "Nuevo", cls: "bg-foreground text-background", icono: "chispa" });
    }
    return out.slice(0, 2);
  }, [enOferta, p.descuento_porcentaje, p.created_at, rating]);

  const umbral = enOferta ? UMBRAL_STOCK_OFERTA : UMBRAL_STOCK;
  const pocoStock = p.stock != null && p.stock > 0 && p.stock <= umbral;
  const retraso = `${(Array.from(p.id).reduce((s, c) => s + c.charCodeAt(0), 0) % 6) * 0.9}s`;

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem({ id: p.id, title: p.nombre, price: precioOferta, image: imgSrc ?? "", sku: p.sku ?? undefined });
    toast.success(`"${p.nombre}" añadido al carrito`);
    volarAlCarrito(mediaRef.current, imgSrc ?? "");
  };

  // Control de cantidad en la propia tarjeta (dentro de un <Link>: nunca debe navegar)
  const handleInc = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!llegoAlMaximo && !agotado) updateQty(p.id, qty + 1);
  };
  const handleDec = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (qty <= 1) {
      removeItem(p.id);
      toast(`"${p.nombre}" quitado del carrito`);
    } else {
      updateQty(p.id, qty - 1);
    }
  };

  const handleWishlist = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setWishPending(true);
    const added = await toggleWishlist(p.id);
    toast.success(added ? `"${p.nombre}" guardado en favoritos` : `"${p.nombre}" eliminado de favoritos`);
    setWishPending(false);
  };

  const handleMedida = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMedidaOpen(true);
  };

  // Inclinación 3D suave + brillo que sigue al mouse (solo mouse; en táctil no hace nada)
  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse") return;
    const card = cardRef.current, media = mediaRef.current;
    if (!card || !media) return;
    const r = card.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    card.style.setProperty("--ry", `${((px - 0.5) * 7).toFixed(2)}deg`);
    card.style.setProperty("--rx", `${((0.5 - py) * 7).toFixed(2)}deg`);
    const m = media.getBoundingClientRect();
    card.style.setProperty("--mx", `${(e.clientX - m.left).toFixed(0)}px`);
    card.style.setProperty("--my", `${(e.clientY - m.top).toFixed(0)}px`);
  };
  const onPointerLeave = () => {
    const card = cardRef.current;
    if (!card) return;
    card.style.setProperty("--rx", "0deg");
    card.style.setProperty("--ry", "0deg");
  };

  return (
    <>
      <Link to="/product/$handle" params={{ handle: p.id }} className="group block h-full">
        <article ref={cardRef} className="gmc-card @container" onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}>
          {/* ───────── Escaparate ───────── */}
          <div ref={mediaRef} className="gmc-media">
            {imgSrc ? (
              <img
                src={imgSrc}
                alt={p.nombre}
                loading="lazy"
                className={`h-full w-full object-cover mix-blend-multiply transition-transform duration-700 ease-out group-hover:scale-[1.06] ${
                  agotado ? "grayscale opacity-70" : ""
                }`}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <ImageIcon className="h-12 w-12" />
              </div>
            )}
            <div className="gmc-sheen" aria-hidden />

            {insignias.length > 0 && (
              <div className="absolute left-2.5 top-2.5 z-10 flex max-w-[calc(100%-3.75rem)] flex-col items-start gap-1.5">
                {insignias.map((b) => (
                  <span
                    key={b.key}
                    className={`inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide shadow-sm ${b.cls}`}
                  >
                    {b.icono === "estrella" && <Star className="h-3 w-3 fill-current" />}
                    {b.icono === "chispa" && <Sparkles className="h-3 w-3" />}
                    {b.texto}
                  </span>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={handleWishlist}
              disabled={wishPending}
              className="absolute right-2.5 top-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background/85 shadow-sm backdrop-blur-sm transition-all hover:scale-110 hover:bg-background disabled:opacity-50"
              title={wishlisted ? "Quitar de favoritos" : "Guardar en favoritos"}
              aria-label={wishlisted ? "Quitar de favoritos" : "Guardar en favoritos"}
            >
              <Heart
                className={`h-4 w-4 transition-all duration-200 ${
                  wishlisted ? "scale-110 fill-destructive text-destructive" : "text-muted-foreground"
                }`}
              />
            </button>

            {agotado && (
              <span className="absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 bg-foreground/80 py-1.5 text-center text-xs font-semibold uppercase tracking-[0.2em] text-background">
                Agotado
              </span>
            )}

            {/* Vista rápida (solo con mouse) */}
            <div className="gmc-quick" aria-hidden>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">Vista rápida</p>
              {atributos.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {atributos.map((a) => (
                    <span key={a} className="rounded-full border border-white/35 px-2 py-0.5 text-[11px] text-white/95">{a}</span>
                  ))}
                </div>
              )}
              <p className="mt-2 flex items-center gap-1 text-sm font-medium">
                Ver detalle y personalizar <ArrowUpRight className="h-4 w-4" />
              </p>
            </div>
          </div>

          {/* ───────── Información ───────── */}
          <div className="flex flex-1 flex-col p-4 pt-3.5">
            {p.categoria && (
              <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{p.categoria}</span>
            )}
            <h3 className="mt-1 text-[17px] font-semibold leading-snug line-clamp-2">{p.nombre}</h3>

            {rating && (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                <Estrellas promedio={rating.promedio} />
                <span className="font-semibold text-foreground">{rating.promedio.toFixed(1)}</span>
                <span className="whitespace-nowrap">({rating.total}<span className="hidden @[11rem]:inline"> {rating.total === 1 ? "reseña" : "reseñas"}</span>)</span>
              </div>
            )}

            {descripcion ? (
              <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">{descripcion}</p>
            ) : (
              atributos.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {atributos.map((a) => (
                    <span key={a} className="rounded-full border border-border bg-background/60 px-2 py-0.5 text-[11px] text-muted-foreground">{a}</span>
                  ))}
                </div>
              )
            )}

            <div className="mt-auto flex flex-col gap-2.5 pt-3.5">
              {/* Precio */}
              {enOferta ? (
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="font-display text-2xl font-bold leading-none text-destructive">{fmtPEN(precioOferta)}</span>
                  <span className="text-sm text-muted-foreground line-through">{fmtPEN(p.precio)}</span>
                  <span className="whitespace-nowrap rounded-md bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-700">
                    Ahorras {fmtPEN(p.precio - precioOferta)}
                  </span>
                  {cuentaRegresiva && (
                    <span className="flex basis-full items-center gap-1.5 text-[11px] font-semibold text-destructive">
                      <span className="gmc-dot" /> {cuentaRegresiva}
                    </span>
                  )}
                </div>
              ) : (
                <span className="font-display text-2xl font-bold leading-none">{fmtPEN(p.precio)}</span>
              )}

              {/* Escasez real */}
              {pocoStock && (
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                    <span className="gmc-dot" />
                    {p.stock === 1 ? "Queda 1 unidad" : `Quedan ${p.stock} unidades`}
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-amber-500/15">
                    <div
                      className="h-full rounded-full bg-amber-500"
                      style={{ width: `${Math.max(10, ((p.stock as number) / umbral) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Promesa de entrega (misma fuente que la ficha) */}
              {!agotado && (
                <p className="flex min-h-4 items-start gap-1.5 text-xs text-muted-foreground">
                  {entrega && (
                    <>
                      <Truck className="mt-px h-3.5 w-3.5 shrink-0 text-primary" />
                      <span>
                        Llega <b className="whitespace-nowrap font-semibold text-foreground">{entrega.rango}</b>
                        {entrega.distrito && entrega.envio != null && (
                          <> · Envío a {entrega.distrito} <b className="font-semibold text-foreground">{fmtPEN(entrega.envio)}</b></>
                        )}
                      </span>
                    </>
                  )}
                </p>
              )}

              {/* Compra: "Agregar" se transforma en un control de cantidad cuando ya está en el carrito */}
              {enCarrito ? (
                <div
                  key="en-carrito"
                  role="group"
                  aria-label={`${p.nombre} en el carrito: ${qty} ${qty === 1 ? "unidad" : "unidades"}`}
                  className="flex w-full items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 p-1 text-emerald-800 animate-in zoom-in-95 fade-in duration-300"
                >
                  <button
                    type="button"
                    onClick={handleDec}
                    aria-label={qty <= 1 ? "Quitar del carrito" : "Quitar una unidad"}
                    title={qty <= 1 ? "Quitar del carrito" : "Quitar una unidad"}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-emerald-700 shadow-sm transition-all hover:bg-emerald-100 active:scale-90"
                  >
                    {qty <= 1 ? <Trash2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                  </button>

                  <div className="min-w-0 flex-1 text-center leading-tight" aria-live="polite">
                    <span className="flex items-center justify-center gap-1 text-sm font-semibold">
                      <Check className="h-3.5 w-3.5 shrink-0" />
                      <span className="whitespace-nowrap">
                        <span className="@[13rem]:hidden">{qty}</span>
                        <span className="hidden @[13rem]:inline">En el carrito</span>
                      </span>
                    </span>
                    <span className="hidden whitespace-nowrap text-[11px] text-emerald-700/80 @[13rem]:block">
                      {qty} {qty === 1 ? "unidad" : "unidades"} · {fmtPEN(precioOferta * qty)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleInc}
                    disabled={llegoAlMaximo || agotado}
                    aria-label="Agregar una unidad"
                    title={llegoAlMaximo ? "Alcanzaste el stock disponible" : "Agregar una unidad"}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-90 disabled:cursor-not-allowed disabled:bg-emerald-200 disabled:text-white/80"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={agotado}
                  style={{ ["--gmc-delay" as string]: retraso }}
                  className={`gmc-cta group/btn flex w-full items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-4 transition-all duration-300 ${
                    agotado
                      ? "cursor-default bg-muted text-muted-foreground"
                      : "gmc-cta-shine bg-primary text-primary-foreground shadow-sm hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.97]"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full transition-colors duration-300 ${
                      agotado ? "bg-muted-foreground/10" : "bg-white/15 group-hover/btn:bg-white/25"
                    }`}
                  >
                    <ShoppingBag className="h-3.5 w-3.5 transition-transform duration-300 group-hover/btn:-rotate-12 group-hover/btn:scale-110" />
                  </span>
                  <span className="whitespace-nowrap text-sm font-medium">
                    {agotado ? "Agotado" : (
                      <>Agregar<span className="hidden @[13rem]:inline"> al carrito</span></>
                    )}
                  </span>
                  {!agotado && (
                    <Plus className="ml-auto h-4 w-4 opacity-70 transition-transform duration-300 group-hover/btn:rotate-90" />
                  )}
                </button>
              )}

              {/* Captura de leads: el taller fabrica a medida */}
              <button
                type="button"
                onClick={handleMedida}
                className="inline-flex items-center justify-center gap-1.5 text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
              >
                <Ruler className="h-3.5 w-3.5" />
                {agotado ? (
                  <><span className="@[13rem]:hidden">Cotiza a medida</span><span className="hidden @[13rem]:inline">Cotiza este modelo a medida</span></>
                ) : (
                  <><span className="@[13rem]:hidden">Cotiza a medida</span><span className="hidden @[13rem]:inline">¿Otra medida? Cotiza a medida</span></>
                )}
              </button>
            </div>
          </div>
        </article>
      </Link>

      {/* Fuera del <Link>: los eventos de un portal burbujean por el árbol de React y navegarían */}
      {medidaOpen && (
        <LeadFormDialog
          open={medidaOpen}
          onOpenChange={setMedidaOpen}
          productoId={p.id}
          productoNombre={p.nombre}
          title={`Cotiza a medida: ${p.nombre}`}
          description="Cuéntanos las medidas de tu espacio y un asesor te contactará a la brevedad."
        />
      )}
    </>
  );
}