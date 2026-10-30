// src/routes/combo.$id.tsx
// Vista de detalle de un combo — "recorrido del combo":
//  · El escenario muestra el combo completo y recorre pieza por pieza (se detiene al interactuar).
//  · La lista de piezas está conectada al escenario (hover en escritorio, toque en móvil).
//  · El ahorro se ve (barra comparativa), no solo se dice.
//  · Solo urgencia REAL: cuenta regresiva si el combo tiene vencimiento, y stock bajo si de verdad lo hay.
//  · Barra de compra fija en móvil + otros combos al final.
import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useCombo,
  useCombos,
  combosDisponibles,
  type Combo,
} from "@/hooks/useCombos";
import { useAgregarCombo } from "@/hooks/useAgregarCombo";
import { useCountdown } from "@/hooks/useCountdown";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ComboCard } from "@/components/ComboCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  ShoppingBag, PackageCheck, Image as ImageIcon, ArrowLeft, ArrowUpRight, Check,
  ShieldCheck, Timer, Flame, ArrowRight, Layers, Share2,
} from "lucide-react";
import { toast } from "sonner";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { fmtPEN } from "@/lib/pricing";
import { trackEvent } from "@/hooks/useEventTracking";
import { useSeo, absolutizar, migasJsonLd } from "@/lib/seo";
import { trackShare } from "@/lib/analytics";
import { urlCompartir } from "@/lib/share";

export const Route = createFileRoute("/combo/$id")({
  component: ComboPage,
});

// Ajusta estos textos a lo que la tienda realmente ofrece.
const GARANTIAS = [
  { icon: ShieldCheck, titulo: "Pago seguro", detalle: "Con tarjeta vía Niubiz" },
  { icon: PackageCheck, titulo: "Seguimiento del pedido", detalle: "Te avisamos en cada etapa" },
];

/* ───────────────────────── Utilidades ───────────────────────── */

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Una miniatura sale del escenario y vuela hasta el ícono del carrito del header. */
function volarAlCarrito(origen: HTMLElement | null, src?: string | null) {
  if (!origen || !src || typeof document === "undefined" || reducedMotion()) return;
  const destino = Array.from(document.querySelectorAll<HTMLElement>("[data-cart-target]"))
    .find((el) => el.getBoundingClientRect().width > 0);
  if (!destino) return;

  const a = origen.getBoundingClientRect();
  const b = destino.getBoundingClientRect();
  const w = 140, h = 105;
  const left = a.left + a.width / 2 - w / 2;
  const top = a.top + a.height / 2 - h / 2;

  const fantasma = document.createElement("img");
  fantasma.src = src;
  fantasma.alt = "";
  Object.assign(fantasma.style, {
    position: "fixed", left: `${left}px`, top: `${top}px`, width: `${w}px`, height: `${h}px`,
    objectFit: "cover", zIndex: "9999", pointerEvents: "none", borderRadius: "16px",
    boxShadow: "0 12px 32px rgba(0,0,0,.28)", background: "#fff",
  });
  document.body.appendChild(fantasma);

  const dx = b.left + b.width / 2 - (left + w / 2);
  const dy = b.top + b.height / 2 - (top + h / 2);
  const anim = fantasma.animate(
    [
      { transform: "translate(0,0) scale(1)", opacity: 1 },
      { transform: `translate(${dx * 0.55}px, ${dy * 0.3 - 56}px) scale(.5)`, opacity: 0.95, offset: 0.55 },
      { transform: `translate(${dx}px, ${dy}px) scale(.08)`, opacity: 0.2, borderRadius: "50%" },
    ],
    { duration: 850, easing: "cubic-bezier(.5,0,.2,1)" },
  );
  anim.onfinish = () => {
    fantasma.remove();
    destino.animate(
      [{ transform: "scale(1)" }, { transform: "scale(1.3)" }, { transform: "scale(1)" }],
      { duration: 420, easing: "ease-out" },
    );
  };
  anim.oncancel = () => fantasma.remove();
}

/* ───────────────────────── Barra de ahorro ───────────────────────── */

function BarraAhorro({ normal, combo }: { normal: number; combo: number }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOn(true), 200);
    return () => clearTimeout(t);
  }, []);
  const ratio = normal > 0 ? Math.min(1, combo / normal) : 1;

  return (
    <div className="mt-4 space-y-2.5 rounded-xl border border-border/60 bg-card p-4">
      <div>
        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
          <span>Comprando por separado</span>
          <span className="line-through">{fmtPEN(normal)}</span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-muted" />
      </div>
      <div>
        <div className="mb-1 flex justify-between text-xs font-medium">
          <span>Con el combo</span>
          <span className="text-accent">{fmtPEN(combo)}</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-1000 ease-out"
            style={{ width: on ? `${ratio * 100}%` : "0%" }}
          />
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Página ───────────────────────── */

function ComboPage() {
  const { id } = Route.useParams();
  const { data: combo, isLoading, isError } = useCombo(id);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="container mx-auto grid max-w-7xl flex-1 grid-cols-1 gap-10 px-4 py-10 lg:grid-cols-2">
          <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
          <div className="space-y-4">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-full" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (isError || !combo) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex flex-1 items-center justify-center px-4 py-24">
          <div className="max-w-md text-center">
            <h1 className="mb-2 font-display text-3xl">Combo no encontrado</h1>
            <p className="mb-6 text-sm text-muted-foreground">Puede que este combo ya no esté disponible.</p>
            <Button asChild className="rounded-full">
              <Link to="/">Volver al inicio</Link>
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return <ComboDetail combo={combo} />;
}

function ComboDetail({ combo }: { combo: Combo }) {
  const { agregar, adding, yaEnCarrito, agotado, precioNormal, ahorro } = useAgregarCombo(combo);
  const factor = precioNormal > 0 ? combo.precio_combo / precioNormal : 1;
  const pct = precioNormal > 0 ? Math.round((ahorro / precioNormal) * 100) : 0;

  const restante = useCountdown(combo.vence_el ? new Date(combo.vence_el).getTime() : null);
  const vencido = !combo.activo || !!restante?.terminada;
  const bloqueado = agotado || vencido;
  const disp = combosDisponibles(combo);
  const pocoStock = disp !== null && disp > 0 && disp <= 5;

  const portada = combo.imagen_public_id
    ? cloudinaryUrl(combo.imagen_public_id, { w: 1000, h: 750 })
    : combo.imagen_url;

  const piezas = useMemo(
    () =>
      combo.combo_items.map((it) => {
        const p = it.products;
        return {
          key: it.id,
          productId: it.product_id,
          nombre: p.nombre,
          cantidad: it.cantidad,
          precio: p.precio,
          precioCombo: Math.round(p.precio * factor * 100) / 100,
          big: p.imagen_public_id ? cloudinaryUrl(p.imagen_public_id, { w: 1000, h: 750 }) : p.imagen_url,
          thumb: p.imagen_public_id ? cloudinaryUrl(p.imagen_public_id, { w: 160, h: 160 }) : p.imagen_url,
        };
      }),
    [combo, factor],
  );

  // -1 = combo completo; 0..n = pieza
  const [sel, setSel] = useState(-1);
  const [tour, setTour] = useState(true);
  const [ctaVisible, setCtaVisible] = useState(true);
  const stageRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    trackEvent({ tipo: "producto_visto", path: `/combo/${combo.id}`, nombre: combo.nombre, valor: combo.precio_combo });
  }, [combo.id, combo.nombre]);

  useSeo({
    title: `${combo.nombre} — Combo de muebles`,
    description:
      combo.descripcion ||
      `Combo ${combo.nombre}: ${piezas.map((p) => p.nombre).join(", ")}. Ahorra comprando el conjunto. Fabricado en Lima por G&M Mueblería.`,
    image: absolutizar(portada),
    path: `/combo/${combo.id}`,
    type: "product",
    jsonLd: [{
      "@context": "https://schema.org",
      "@type": "Product",
      name: combo.nombre,
      description: combo.descripcion || undefined,
      image: [absolutizar(portada)].filter(Boolean),
      brand: { "@type": "Brand", name: "G&M Mueblería" },
      offers: {
        "@type": "Offer",
        url: `${window.location.origin}/combo/${combo.id}`,
        priceCurrency: "PEN",
        price: Number(combo.precio_combo).toFixed(2),
        availability: bloqueado ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
        ...(combo.vence_el ? { priceValidUntil: combo.vence_el.slice(0, 10) } : {}),
      },
    },
    migasJsonLd([
      { nombre: "Inicio", path: "/" },
      { nombre: "Combos", path: "/#combos" },
      { nombre: combo.nombre, path: `/combo/${combo.id}` },
    ])],
  });

  // Recorrido automático: una sola vuelta por las piezas y se detiene.
  useEffect(() => {
    if (!tour || piezas.length < 2 || reducedMotion()) return;
    let i = -1;
    const id = setInterval(() => {
      i += 1;
      if (i >= piezas.length) {
        setSel(-1);
        setTour(false);
        clearInterval(id);
        return;
      }
      setSel(i);
    }, 2400);
    return () => clearInterval(id);
  }, [tour, piezas.length]);

  // Barra de compra fija en móvil: aparece cuando el botón principal sale de pantalla.
  useEffect(() => {
    const el = ctaRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setCtaVisible(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const elegir = (i: number) => {
    setTour(false);
    setSel(i);
  };

  const onAgregar = () => {
    const origen = sel >= 0 ? piezas[sel]?.thumb : (portada ?? piezas[0]?.thumb);
    volarAlCarrito(stageRef.current, origen);
    agregar();
  };

  const otros = (useCombos(6).data ?? [])
    .filter((c) => c.id !== combo.id && c.combo_items.length > 0)
    .slice(0, 3);

  const textoRestante = restante && !restante.terminada
    ? restante.d > 0
      ? `${restante.d}d ${restante.h}h ${restante.m}m`
      : `${restante.h}h ${restante.m}m ${restante.s}s`
    : null;

  const etiquetaCTA = (
    <>
      <ShoppingBag className="mr-2 h-4 w-4" /> Agregar combo · {fmtPEN(combo.precio_combo)}
    </>
  );

  // Compartir con vista previa (imagen + precio del combo) vía /share/combo/:id de la API
  const compartir = async () => {
    const url = urlCompartir("combo", combo.id);
    trackShare(combo.id, combo.nombre, "combo");
    try {
      if (navigator.share) {
        await navigator.share({ title: combo.nombre, text: `${combo.nombre} — G&M Mueblería`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Enlace copiado", { description: "Pégalo en WhatsApp, Instagram o donde quieras.", position: "top-center" });
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error("No pudimos copiar el enlace");
    }
  };

  const botonPrincipal = bloqueado ? (
    <Button size="lg" disabled className="h-12 w-full rounded-full">
      {vencido ? "Este combo ya no está disponible" : "Una pieza del combo está agotada"}
    </Button>
  ) : yaEnCarrito ? (
    <div className="space-y-2">
      <Button size="lg" asChild className="h-12 w-full rounded-full">
        <Link to="/checkout">
          Ir a pagar <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </Button>
      <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Check className="h-3.5 w-3.5 text-accent" /> Este combo ya está en tu carrito
      </p>
    </div>
  ) : (
    <Button size="lg" onClick={onAgregar} disabled={adding} className="h-12 w-full rounded-full text-base">
      {adding ? (
        <>
          <Check className="mr-2 h-4 w-4" /> ¡Agregado!
        </>
      ) : (
        etiquetaCTA
      )}
    </Button>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 pb-24 lg:pb-0">
        <div className="container mx-auto max-w-7xl px-4 pt-6">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild><Link to="/">Inicio</Link></BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild><Link to="/" hash="combos">Combos</Link></BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem><BreadcrumbPage>{combo.nombre}</BreadcrumbPage></BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <Link
            to="/"
            hash="combos"
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Volver a combos
          </Link>
        </div>

        <div className="container mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
          {/* ───── Escenario ───── */}
          <div className="self-start lg:sticky lg:top-24">
            <div
              ref={stageRef}
              className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-border/50 bg-white shadow-sm"
            >
              <span className="absolute left-3 top-3 z-20 flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-accent-foreground shadow-sm">
                <PackageCheck className="h-3 w-3" /> Combo
              </span>

              {/* capa 0: combo completo */}
              <div
                className={`absolute inset-0 transition-opacity duration-500 ${
                  sel === -1 ? "opacity-100" : "pointer-events-none opacity-0"
                }`}
              >
                {portada ? (
                  <img src={portada} alt={combo.nombre} className="h-full w-full object-contain" />
                ) : piezas.length > 0 ? (
                  <div className="grid h-full w-full grid-cols-2 gap-1 p-1">
                    {piezas.slice(0, 4).map((p) => (
                      <div key={p.key} className="overflow-hidden rounded-xl bg-muted/40">
                        {p.big && <img src={p.big} alt="" className="h-full w-full object-contain" />}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <ImageIcon className="h-16 w-16" />
                  </div>
                )}
              </div>

              {/* capas por pieza */}
              {piezas.map((p, i) => (
                <div
                  key={p.key}
                  className={`absolute inset-0 transition-opacity duration-500 ${
                    sel === i ? "opacity-100" : "pointer-events-none opacity-0"
                  }`}
                >
                  {p.big ? (
                    <img src={p.big} alt={p.nombre} className="h-full w-full object-contain" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <ImageIcon className="h-16 w-16" />
                    </div>
                  )}
                </div>
              ))}

              {/* leyenda */}
              <div className="absolute inset-x-3 bottom-3 z-20 flex items-center justify-between gap-2">
                <span className="max-w-[75%] truncate rounded-full bg-background/90 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur">
                  {sel === -1
                    ? `Combo completo · ${piezas.length} pieza${piezas.length !== 1 ? "s" : ""}`
                    : `${piezas[sel].nombre}${piezas[sel].cantidad > 1 ? ` ×${piezas[sel].cantidad}` : ""}`}
                </span>
                {tour && piezas.length > 1 && !reducedMotion() && (
                  <span className="rounded-full bg-background/90 px-2.5 py-1.5 text-[11px] text-muted-foreground shadow-sm backdrop-blur">
                    Recorriendo el combo…
                  </span>
                )}
              </div>
            </div>

            {/* tira de miniaturas */}
            {piezas.length > 0 && (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => elegir(-1)}
                  aria-label="Ver combo completo"
                  className={`flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 bg-white transition-colors ${
                    sel === -1 ? "border-accent" : "border-transparent hover:border-border"
                  }`}
                >
                  {portada ? (
                    <img src={portada} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Layers className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>
                {piezas.map((p, i) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => elegir(i)}
                    aria-label={`Ver ${p.nombre}`}
                    className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border-2 bg-white transition-colors ${
                      sel === i ? "border-accent" : "border-transparent hover:border-border"
                    }`}
                  >
                    {p.thumb ? (
                      <img src={p.thumb} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="m-auto h-5 w-5 text-muted-foreground" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ───── Información y compra ───── */}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {textoRestante && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
                  <Timer className="h-3.5 w-3.5" /> Termina en {textoRestante}
                </span>
              )}
              {pocoStock && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive">
                  <Flame className="h-3.5 w-3.5" /> Quedan solo {disp} combo{disp !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            <h1 className="mt-3 font-display text-3xl font-semibold md:text-4xl">{combo.nombre}</h1>
            {combo.descripcion && <p className="mt-3 text-muted-foreground">{combo.descripcion}</p>}

            <div className="mt-5 flex flex-wrap items-baseline gap-3">
              <span className="font-display text-4xl font-bold text-accent">{fmtPEN(combo.precio_combo)}</span>
              {ahorro > 0 && (
                <>
                  <span className="text-lg text-muted-foreground line-through">{fmtPEN(precioNormal)}</span>
                  {pct >= 1 && (
                    <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-accent-foreground">
                      -{pct}%
                    </span>
                  )}
                </>
              )}
            </div>
            {ahorro > 0 && (
              <p className="mt-1 text-sm font-medium text-accent">Ahorras {fmtPEN(ahorro)} en este combo</p>
            )}

            {ahorro > 0 && <BarraAhorro normal={precioNormal} combo={combo.precio_combo} />}

            <div ref={ctaRef} className="mt-5">{botonPrincipal}</div>
            <Button type="button" variant="ghost" onClick={compartir} className="mt-2 h-10 w-full rounded-full text-sm text-muted-foreground">
              <Share2 className="mr-2 h-4 w-4" /> Compartir este combo
            </Button>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {GARANTIAS.map(({ icon: Icon, titulo, detalle }) => (
                <div key={titulo} className="flex items-center gap-2.5 rounded-xl bg-muted/50 px-3 py-2.5">
                  <Icon className="h-4 w-4 flex-shrink-0 text-accent" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold">{titulo}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{detalle}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Piezas */}
            <div className="mt-8 border-t border-border/50 pt-6">
              <h2 className="mb-1 font-semibold">Este combo incluye</h2>
              <p className="mb-4 text-xs text-muted-foreground">
                Pasa el cursor o toca una pieza para verla en grande.
              </p>
              <ul className="space-y-2">
                {piezas.map((p, i) => (
                  <li
                    key={p.key}
                    className={`flex items-center gap-1 rounded-xl border transition-colors ${
                      sel === i ? "border-accent/60 bg-accent/5" : "border-transparent hover:bg-muted/50"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => elegir(i)}
                      onPointerEnter={(e) => e.pointerType === "mouse" && elegir(i)}
                      className="flex min-w-0 flex-1 items-center gap-3 p-2.5 text-left"
                    >
                      <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-white">
                        {p.thumb ? (
                          <img src={p.thumb} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <ImageIcon className="m-auto mt-4 h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {p.nombre}
                          {p.cantidad > 1 && (
                            <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-semibold">
                              ×{p.cantidad}
                            </span>
                          )}
                        </p>
                        <p className="text-xs">
                          <span className="font-semibold text-accent">{fmtPEN(p.precioCombo)}</span>
                          {ahorro > 0 && p.precioCombo < p.precio && (
                            <span className="ml-1.5 text-muted-foreground line-through">{fmtPEN(p.precio)}</span>
                          )}
                          <span className="text-muted-foreground"> c/u</span>
                        </p>
                      </div>
                    </button>
                    <Link
                      to="/product/$handle"
                      params={{ handle: p.productId }}
                      aria-label={`Ver detalle de ${p.nombre}`}
                      className="mr-2 grid h-9 w-9 flex-shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Otros combos */}
        {otros.length > 0 && (
          <section className="container mx-auto max-w-7xl px-4 pb-14">
            <h2 className="mb-5 font-display text-2xl font-semibold">Otros combos que podrían gustarte</h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {otros.map((c) => (
                <ComboCard key={c.id} combo={c} />
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Barra de compra fija (solo móvil) */}
      <div
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 pr-20 backdrop-blur transition-transform duration-300 lg:hidden ${
          ctaVisible ? "translate-y-full" : "translate-y-0"
        }`}
        aria-hidden={ctaVisible}
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs text-muted-foreground">{combo.nombre}</p>
            <p className="font-display text-xl font-bold leading-tight text-accent">{fmtPEN(combo.precio_combo)}</p>
          </div>
          {bloqueado ? (
            <Button disabled className="ml-auto rounded-full">No disponible</Button>
          ) : yaEnCarrito ? (
            <Button asChild className="ml-auto rounded-full">
              <Link to="/checkout">Ir a pagar</Link>
            </Button>
          ) : (
            <Button onClick={onAgregar} disabled={adding} className="ml-auto rounded-full">
              {adding ? <Check className="h-4 w-4" /> : <><ShoppingBag className="mr-2 h-4 w-4" /> Agregar</>}
            </Button>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}