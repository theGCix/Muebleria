// src/components/Hero.tsx
// Hero del home. Con ofertas vigentes muestra la campaña: cuenta regresiva real y
// etiquetas de precio colgadas de un riel (como en el taller). Sin ofertas, hero de marca.
import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Sparkles, ShieldCheck, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroImg from "@/assets/hero-furniture.jpg";
import { useCampana, type Campana } from "@/hooks/useCampana";
import { useCountdown } from "@/hooks/useCountdown";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { fmtPEN, ofertaInfo } from "@/lib/pricing";
import type { Product } from "@/hooks/useProducts";

export function Hero() {
  const { campana, isLoading } = useCampana();
  if (isLoading) return <div aria-hidden className="min-h-[520px]" />;
  if (campana) return <HeroCampana c={campana} />;
  return <HeroMarca />;
}

/* ───────────────────────── Campaña ───────────────────────── */

const dos = (n: number) => String(n).padStart(2, "0");

/** Cada dígito ocupa el mismo ancho para que el reloj no "baile" al cambiar. */
function Digitos({ valor }: { valor: string }) {
  return (
    <span className="inline-flex" aria-hidden>
      {valor.split("").map((ch, i) => (
        <span key={i} className="inline-block w-[0.6em] text-center">
          {ch}
        </span>
      ))}
    </span>
  );
}

function Reloj({ venceMs, unificada }: { venceMs: number; unificada: boolean }) {
  const qc = useQueryClient();
  const r = useCountdown(venceMs);

  // Al llegar a cero, volver a pedir las ofertas: las vencidas desaparecen solas
  const terminada = r?.terminada ?? false;
  useEffect(() => {
    if (terminada) qc.invalidateQueries({ queryKey: ["products-ofertas"] });
  }, [terminada, qc]);

  if (!r) return null;

  const unidades = [
    ...(r.d > 0 ? [{ v: String(r.d), l: r.d === 1 ? "día" : "días" }] : []),
    { v: dos(r.h), l: "horas" },
    { v: dos(r.m), l: "minutos" },
    { v: dos(r.s), l: "segundos" },
  ];

  const resumen = `${r.d} días, ${r.h} horas, ${r.m} minutos y ${r.s} segundos`;

  return (
    <div role="timer" aria-label={`Tiempo restante: ${resumen}`}>
      <p className="text-sm text-[var(--color-gold-light)]/80 mb-2">
        {unificada ? "La oferta termina en" : "La próxima oferta termina en"}
      </p>
      <div className="flex items-end gap-4 sm:gap-6">
        {unidades.map((u, i) => (
          <div key={u.l} className="flex items-end gap-4 sm:gap-6">
            {i > 0 && <span aria-hidden className="mb-6 h-10 w-px bg-[var(--color-gold)]/30" />}
            <div>
              <div className="hero-display text-5xl sm:text-7xl leading-none">
                <Digitos valor={u.v} />
              </div>
              <div className="mt-1.5 text-xs text-[var(--color-gold-light)]/70">{u.l}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const CUERDAS = [34, 62, 46]; // largos distintos: se ve colgado, no alineado

function EtiquetaOferta({ p, i }: { p: Product; i: number }) {
  const { precioFinal, ahorro } = ofertaInfo(p);
  const img = p.imagen_public_id
    ? cloudinaryUrl(p.imagen_public_id, { w: 400, h: 400 })
    : p.imagen_url;
  const stock = p.stock ?? null;
  const pocas = stock != null && stock > 0 && stock <= 10;

  return (
    <Link
      to="/product/$handle"
      params={{ handle: p.id }}
      className="etiqueta group block w-[200px] shrink-0 snap-center lg:w-auto"
      style={{ ["--i" as string]: i, ["--cuerda" as string]: `${CUERDAS[i % CUERDAS.length]}px` }}
    >
      <div className="relative overflow-hidden rounded-lg bg-[var(--color-gold-light)] text-[var(--color-walnut)] shadow-[0_18px_40px_-18px_rgba(0,0,0,0.7)]">
        {/* ojal por donde pasa la cuerda */}
        <span
          aria-hidden
          className="absolute left-1/2 top-2 z-10 h-3 w-3 -translate-x-1/2 rounded-full bg-[var(--color-walnut)] ring-2 ring-[var(--color-gold)]/60"
        />

        <div className="relative aspect-square bg-[var(--color-cream)]">
          {img && (
            <img
              src={img}
              alt={p.nombre}
              width={400}
              height={400}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          )}
          <span className="absolute bottom-2 right-2 rounded-md bg-destructive px-2 py-1 text-sm font-bold text-destructive-foreground shadow-sm">
            -{p.descuento_porcentaje}%
          </span>
        </div>

        <div className="space-y-1.5 p-3">
          <h3 className="line-clamp-2 min-h-[2.5rem] text-[15px] font-semibold leading-tight">
            {p.nombre}
          </h3>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-xl font-bold">{fmtPEN(precioFinal)}</span>
            <span className="text-xs line-through opacity-60">{fmtPEN(p.precio)}</span>
          </div>
          <p className="text-xs font-medium text-destructive">Ahorras {fmtPEN(ahorro)}</p>
          {pocas && (
            <div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-walnut)]/15">
                <div
                  className="h-full rounded-full bg-destructive"
                  style={{ width: `${Math.max(8, (stock! / 10) * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-xs">
                {stock === 1 ? "Queda 1 unidad" : `Quedan ${stock} unidades`}
              </p>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

function HeroCampana({ c }: { c: Campana }) {
  const destacadas = c.ofertas.slice(0, 3);
  const titulo = c.nombre ?? `Hasta -${c.maxDescuento}% en muebles hechos a mano`;
  const bajada = c.nombre
    ? `Hasta -${c.maxDescuento}% en ${c.ofertas.length} ${c.ofertas.length === 1 ? "pieza" : "piezas"} de madera natural. Precios rebajados mientras dure la campaña.`
    : "Piezas de madera natural con precio rebajado, directo del taller a tu casa.";

  return (
    <section
      data-hero
      className="hero-taller relative overflow-hidden bg-[var(--color-walnut)] text-[var(--color-warm-white)]"
    >
      <div className="container mx-auto grid grid-cols-1 items-center gap-12 px-4 py-14 md:px-6 md:py-20 lg:grid-cols-[1.05fr_1fr]">
        <div data-hero-text className="min-w-0 space-y-8">
          <div className="space-y-4">
            <h1 data-hero-title className="hero-display text-5xl font-semibold leading-[1.02] sm:text-6xl lg:text-7xl">
              {titulo}
            </h1>
            <p
              data-hero-item
              className="max-w-lg text-lg leading-relaxed text-[var(--color-gold-light)]/85"
            >
              {bajada}
            </p>
          </div>

          {c.venceMs != null && (
            <div data-hero-item>
              <Reloj venceMs={c.venceMs} unificada={c.unificada} />
            </div>
          )}

          <div data-hero-item className="flex flex-wrap gap-3">
            <Button
              asChild
              size="lg"
              className="h-12 rounded-full bg-[var(--color-gold)] px-7 text-[var(--color-walnut)] hover:bg-[var(--color-gold-light)]"
            >
              <a href="#ofertas">
                Ver las {c.ofertas.length} {c.ofertas.length === 1 ? "oferta" : "ofertas"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-12 rounded-full border-[var(--color-gold)]/50 bg-transparent px-7 text-[var(--color-warm-white)] hover:bg-[var(--color-warm-white)]/10 hover:text-[var(--color-warm-white)]"
            >
              <a href="#catalogo">Explorar el catálogo</a>
            </Button>
          </div>

          <ul
            data-hero-item
            className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--color-gold-light)]/80"
          >
            <li className="flex items-center gap-2">
              <Truck className="h-4 w-4" /> Delivery a todo Lima
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> 2 años de garantía
            </li>
          </ul>
        </div>

        {/* Riel con etiquetas colgadas */}
        <div data-hero-rail className="relative min-w-0">
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-[3px] rounded-full bg-[var(--color-gold)]/70"
          >
            <span className="absolute -left-1 -top-[3px] h-2.5 w-2.5 rounded-full bg-[var(--color-gold)]" />
            <span className="absolute -right-1 -top-[3px] h-2.5 w-2.5 rounded-full bg-[var(--color-gold)]" />
          </div>
          <div
            className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-8 sm:mx-0 sm:px-0 lg:mx-0 lg:grid lg:grid-cols-[repeat(var(--n),minmax(0,1fr))] lg:overflow-visible lg:px-0"
            style={{ ["--n" as string]: destacadas.length }}
          >
            {destacadas.map((p, i) => (
              <div
                key={p.id}
                style={{ marginTop: CUERDAS[i % CUERDAS.length] }}
                className="shrink-0 lg:shrink"
              >
                <EtiquetaOferta p={p} i={i} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────── Hero de marca (sin ofertas) ───────────────────── */

function HeroMarca() {
  return (
    <section data-hero className="relative overflow-hidden">
      <div className="container mx-auto px-6 pt-16 pb-24 md:pt-24 md:pb-32">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div data-hero-text className="space-y-8">
            <div
              data-hero-item
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              Hecho a mano · Madera noble
            </div>
            <h1
              data-hero-title
              className="font-display text-5xl md:text-6xl lg:text-7xl font-semibold leading-[1.05] text-foreground"
            >
              Muebles que <em className="text-accent not-italic">cuentan</em> historias en tu hogar
            </h1>
            <p data-hero-item className="text-lg text-muted-foreground max-w-xl leading-relaxed">
              En G&amp;M Mueblería diseñamos piezas atemporales en madera natural, pensadas para
              acompañarte por generaciones. Calidad artesanal con entrega a domicilio.
            </p>
            <div data-hero-item className="flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full h-12 px-7"
              >
                <a href="#catalogo">
                  Comprar ahora <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="rounded-full h-12 px-7 border-foreground/20 hover:bg-secondary"
              >
                <a href="#categorias">Explorar categorías</a>
              </Button>
            </div>
            <div data-hero-item className="flex items-center gap-8 pt-4">
              <div>
                <div className="font-display text-3xl font-semibold">15+</div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Años de oficio
                </div>
              </div>
              <div className="h-10 w-px bg-border" />
              <div>
                <div className="font-display text-3xl font-semibold">100%</div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Madera natural
                </div>
              </div>
              <div className="h-10 w-px bg-border hidden sm:block" />
              <div className="hidden sm:block">
                <div className="font-display text-3xl font-semibold">2 años</div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  de garantía
                </div>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 bg-[image:var(--gradient-warm)] opacity-20 blur-3xl rounded-full" />
            <div
              data-hero-img
              className="relative rounded-2xl overflow-hidden shadow-[var(--shadow-elegant)] border border-border/40"
            >
              <img
                src={heroImg}
                alt="Mueble artesanal de madera natural en sala iluminada"
                width={1600}
                height={1200}
                className="w-full h-auto object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
