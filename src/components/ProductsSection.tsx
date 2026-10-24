// src/components/ProductsSection.tsx
// Catálogo del home como "explorador": eliges tu espacio, fijas tu presupuesto
// y la cuadrícula responde al instante. Una pieza protagonista abre la lista.
// Todo sale de datos reales (productos activos, ofertas vigentes, stock).
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Flame,
  Hammer,
  LayoutGrid,
  Search,
  SearchX,
  ShieldCheck,
  Truck,
  X,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { CATEGORIAS } from "@/lib/categories";
import { fmtPEN, ofertaInfo } from "@/lib/pricing";
import { useCatalogoHome } from "@/hooks/useCatalogoHome";
import { useSearchStore } from "@/stores/searchStore";
import type { Product } from "@/hooks/useProducts";
import { ProductCard } from "./ProductCard";
import { PiezaDestacada } from "./PiezaDestacada";

const PASO = 50;
const POR_PAGINA = 12;
const ATAJOS = [1000, 2000, 3000];

type Orden = "recientes" | "precio_asc" | "precio_desc";
const ORDENES: { id: Orden; label: string }[] = [
  { id: "recientes", label: "Recientes" },
  { id: "precio_asc", label: "Menor precio" },
  { id: "precio_desc", label: "Mayor precio" },
];

const precioDe = (p: Product) => ofertaInfo(p).precioFinal;
const fmtCorto = (n: number) => fmtPEN(n).replace(/\.00$/, "");
const plural = (n: number) => `${n} ${n === 1 ? "pieza" : "piezas"}`;

export function ProductsSection() {
  const query = useSearchStore((s) => s.query);
  const setQuery = useSearchStore((s) => s.setQuery);
  const { data = [], isLoading } = useCatalogoHome(60);

  const [cat, setCat] = useState<string | null>(null);
  const [tope, setTope] = useState<number | null>(null); // null = sin límite
  const [soloOfertas, setSoloOfertas] = useState(false);
  const [orden, setOrden] = useState<Orden>("recientes");
  const [visibles, setVisibles] = useState(POR_PAGINA);

  const q = query.trim().toLowerCase();

  // 1) Búsqueda de texto (compartida con el buscador del header)
  const base = useMemo(
    () =>
      !q
        ? data
        : data.filter((p) =>
            [p.nombre, p.categoria, p.descripcion].some((t) => t?.toLowerCase().includes(q)),
          ),
    [data, q],
  );

  // 2) Rango de precios real del catálogo (con descuentos aplicados)
  const [minR, maxR] = useMemo(() => {
    if (data.length === 0) return [0, 0];
    const precios = data.map(precioDe);
    return [
      Math.floor(Math.min(...precios) / PASO) * PASO,
      Math.ceil(Math.max(...precios) / PASO) * PASO,
    ];
  }, [data]);
  const hayRango = maxR > minR;
  const topeEf = tope == null ? maxR : Math.min(tope, maxR);
  const limitado = tope != null && tope < maxR;

  // 3) Tarjetas de "espacio": cuántas piezas y desde cuánto
  const espacios = useMemo(() => {
    const m = new Map<string, { n: number; desde: number }>();
    for (const p of base) {
      if (!p.categoria) continue;
      const e = m.get(p.categoria) ?? { n: 0, desde: Infinity };
      e.n += 1;
      e.desde = Math.min(e.desde, precioDe(p));
      m.set(p.categoria, e);
    }
    return m;
  }, [base]);

  // 4) Filtrado final + orden
  const enRango = (p: Product) => !limitado || precioDe(p) <= topeEf;
  const delEspacio = (p: Product) => !cat || p.categoria === cat;

  const ofertasDisponibles = useMemo(
    () => base.filter((p) => delEspacio(p) && enRango(p) && ofertaInfo(p).activa).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [base, cat, limitado, topeEf],
  );

  const filtradas = useMemo(() => {
    const lista = base.filter(
      (p) => delEspacio(p) && enRango(p) && (!soloOfertas || ofertaInfo(p).activa),
    );
    if (orden === "precio_asc") return [...lista].sort((a, b) => precioDe(a) - precioDe(b));
    if (orden === "precio_desc") return [...lista].sort((a, b) => precioDe(b) - precioDe(a));
    return lista; // ya viene por created_at desc
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, cat, limitado, topeEf, soloOfertas, orden]);

  // 5) Pieza protagonista: mayor descuento vigente; si no hay, la más reciente
  const destacada = useMemo(() => {
    if (filtradas.length < 3) return null;
    const aptas = filtradas.filter(
      (p) => (p.stock ?? 1) > 0 && (p.imagen_public_id || p.imagen_url),
    );
    const enOferta = aptas
      .filter((p) => ofertaInfo(p).activa)
      .sort((a, b) => (b.descuento_porcentaje ?? 0) - (a.descuento_porcentaje ?? 0));
    if (enOferta[0]) return enOferta[0];
    return [...aptas].sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
  }, [filtradas]);

  const resto = useMemo(
    () => filtradas.filter((p) => p.id !== destacada?.id),
    [filtradas, destacada],
  );
  const mostradas = resto.slice(0, visibles);

  // Cada cambio de filtro vuelve a la primera página
  useEffect(() => setVisibles(POR_PAGINA), [cat, tope, soloOfertas, orden, q]);

  const hayFiltros = !!cat || limitado || soloOfertas || !!q;
  const limpiar = () => {
    setCat(null);
    setTope(null);
    setSoloOfertas(false);
    setQuery("");
  };
  const nombreEspacio = CATEGORIAS.find((c) => c.slug === cat)?.nombre;
  const claveAnim = `${cat}|${tope}|${soloOfertas}|${orden}|${q}`;

  const masAccesible = useMemo(() => {
    const lista = base.filter(delEspacio);
    return lista.length ? Math.min(...lista.map(precioDe)) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, cat]);

  const linkSearch = {
    ...(q ? { q: query.trim() } : {}),
    ...(cat ? { cat } : {}),
    ...(orden !== "recientes" ? { sort: orden } : {}),
  };

  return (
    <section id="catalogo" className="scroll-mt-28 px-4 py-16 md:py-20">
      <div className="container mx-auto max-w-7xl">
        {/* ── Encabezado ── */}
        <div className="mb-8 flex flex-col gap-5 md:mb-10 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.25em] text-accent">
              Catálogo G&amp;M
            </p>
            <h2 className="font-display text-4xl font-semibold leading-[1.02] md:text-6xl">
              ¿Qué espacio vas a <em className="italic text-accent">transformar</em>?
            </h2>
            <p className="mt-3 text-muted-foreground">
              Elige tu ambiente, marca tu presupuesto y mira al instante lo que el taller tiene para
              ti.
            </p>
          </div>
          <div className="relative w-full md:max-w-xs">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar productos…"
              aria-label="Buscar productos"
              className="h-11 rounded-full bg-card pl-10"
            />
          </div>
        </div>

        {/* ── 1. Elige tu espacio ── */}
        {isLoading ? (
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[104px] animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : (
          <div
            role="group"
            aria-label="Elegir espacio"
            className="no-scrollbar -mx-4 mb-6 flex snap-x gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-flow-col md:auto-cols-fr md:overflow-visible md:px-0"
          >
            <Espacio
              activo={!cat}
              onClick={() => setCat(null)}
              icono={<LayoutGrid className="h-5 w-5" />}
              nombre="Todo el catálogo"
              detalle={plural(base.length)}
            />
            {CATEGORIAS.filter((c) => espacios.has(c.slug)).map((c) => {
              const e = espacios.get(c.slug)!;
              return (
                <Espacio
                  key={c.slug}
                  activo={cat === c.slug}
                  onClick={() => setCat(cat === c.slug ? null : c.slug)}
                  icono={<c.icon className="h-5 w-5" />}
                  nombre={c.nombre}
                  detalle={plural(e.n)}
                  desde={`desde ${fmtCorto(e.desde)}`}
                />
              );
            })}
          </div>
        )}

        {/* ── 2. Presupuesto + ajustes ── */}
        {!isLoading && data.length > 0 && (
          <div className="mb-8 grid gap-6 rounded-2xl border border-border/60 bg-card p-5 shadow-[var(--shadow-soft)] md:grid-cols-[1.4fr_1fr] md:p-6">
            {hayRango && (
              <div>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    Tu presupuesto
                  </p>
                  <p className="font-display text-3xl font-semibold leading-none">
                    {limitado ? `Hasta ${fmtCorto(topeEf)}` : "Sin límite"}
                  </p>
                </div>
                <Slider
                  aria-label="Presupuesto máximo"
                  min={minR}
                  max={maxR}
                  step={PASO}
                  value={[topeEf]}
                  onValueChange={([v]) => setTope(v >= maxR ? null : v)}
                  className="my-5 [&_[role=slider]]:h-6 [&_[role=slider]]:w-6 [&_[role=slider]]:border-2 [&_[role=slider]]:border-primary"
                />
                <div className="flex flex-wrap items-center gap-2">
                  {ATAJOS.filter((v) => v > minR && v < maxR).map((v) => (
                    <Chip
                      key={v}
                      activo={tope === v}
                      onClick={() => setTope(tope === v ? null : v)}
                    >
                      Hasta {fmtCorto(v)}
                    </Chip>
                  ))}
                  <Chip activo={!limitado} onClick={() => setTope(null)}>
                    Sin límite
                  </Chip>
                </div>
              </div>
            )}

            <div className="flex flex-col justify-between gap-5 md:border-l md:border-border/60 md:pl-6">
              {ofertasDisponibles > 0 || soloOfertas ? (
                <button
                  type="button"
                  aria-pressed={soloOfertas}
                  onClick={() => setSoloOfertas((v) => !v)}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                    soloOfertas
                      ? "border-destructive bg-destructive text-destructive-foreground"
                      : "border-border bg-background hover:border-destructive/50"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                      soloOfertas ? "bg-white/20" : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    <Flame className="h-4.5 w-4.5" />
                  </span>
                  <span className="text-sm">
                    <span className="block font-semibold">Solo piezas en oferta</span>
                    <span className={soloOfertas ? "text-white/80" : "text-muted-foreground"}>
                      {plural(ofertasDisponibles)} con descuento vigente
                    </span>
                  </span>
                </button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Hoy no hay ofertas en esta selección.
                </p>
              )}

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Ordenar
                </p>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Ordenar piezas">
                  {ORDENES.map((o) => (
                    <Chip key={o.id} activo={orden === o.id} onClick={() => setOrden(o.id)}>
                      {o.label}
                    </Chip>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Resultado en vivo ── */}
        {!isLoading && data.length > 0 && (
          <div
            className="mb-5 flex flex-wrap items-center justify-between gap-2"
            aria-live="polite"
          >
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{plural(filtradas.length)}</span>
              {nombreEspacio ? ` en ${nombreEspacio}` : ""}
              {limitado ? ` hasta ${fmtCorto(topeEf)}` : ""}
              {filtradas.length > 0 && limitado && base.length > filtradas.length
                ? ` · de ${base.length} en total`
                : ""}
            </p>
            {hayFiltros && (
              <button
                type="button"
                onClick={limpiar}
                className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
              >
                <X className="h-3.5 w-3.5" /> Quitar filtros
              </button>
            )}
          </div>
        )}

        {/* ── Cuadrícula ── */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="min-h-[440px] animate-pulse rounded-2xl bg-muted sm:col-span-2 md:row-span-2" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : filtradas.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
            <SearchX className="mb-4 h-10 w-10 text-muted-foreground" />
            <h3 className="font-display text-2xl font-semibold">
              {data.length === 0
                ? "Pronto tendremos piezas nuevas"
                : "Nada encaja con esta combinación"}
            </h3>
            {data.length > 0 && (
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                {limitado && masAccesible != null && masAccesible > topeEf
                  ? `${nombreEspacio ?? "Nuestras piezas"} empiezan desde ${fmtCorto(masAccesible)}. Prueba ampliando tu presupuesto.`
                  : "Prueba con otro espacio o quita algún filtro."}
              </p>
            )}
            {data.length > 0 && (
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                {limitado && (
                  <button
                    type="button"
                    onClick={() => setTope(null)}
                    className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
                  >
                    Ampliar presupuesto
                  </button>
                )}
                <button
                  type="button"
                  onClick={limpiar}
                  className="rounded-full border border-border px-5 py-2.5 text-sm font-medium hover:bg-secondary"
                >
                  Quitar filtros
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div
              key={claveAnim}
              className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 [grid-auto-flow:dense]"
            >
              {destacada && (
                <div
                  className="h-full motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500 sm:col-span-2 md:row-span-2"
                  style={{ animationFillMode: "both" }}
                >
                  <PiezaDestacada product={destacada} />
                </div>
              )}
              {mostradas.map((p, i) => (
                <div
                  key={p.id}
                  className="h-full motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-500"
                  style={{
                    animationDelay: `${Math.min(i, 8) * 50 + 80}ms`,
                    animationFillMode: "both",
                  }}
                >
                  <ProductCard product={p} />
                </div>
              ))}
            </div>

            <div className="mt-10 flex flex-col items-center gap-4">
              {resto.length > visibles && (
                <button
                  type="button"
                  onClick={() => setVisibles((v) => v + POR_PAGINA)}
                  className="rounded-full border border-foreground/20 px-6 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
                >
                  Ver {Math.min(POR_PAGINA, resto.length - visibles)} piezas más
                </button>
              )}
              <Link
                to="/catalogo"
                search={linkSearch}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
              >
                Explorar el catálogo completo <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </>
        )}

        {/* ── Confianza ── */}
        <ul className="mt-14 grid gap-4 border-t border-border/60 pt-8 text-sm sm:grid-cols-3">
          {[
            {
              i: Hammer,
              t: "Hechos a mano",
              d: "Cada pieza sale del taller de nuestros artesanos.",
            },
            { i: Truck, t: "Recojo o delivery", d: "Recoge en tienda o recíbelo en todo Lima." },
            {
              i: ShieldCheck,
              t: "Compra segura",
              d: "Paga en línea y sigue tu pedido desde tu cuenta.",
            },
          ].map(({ i: Icon, t, d }) => (
            <li key={t} className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block font-semibold">{t}</span>
                <span className="text-muted-foreground">{d}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Espacio({
  activo,
  onClick,
  icono,
  nombre,
  detalle,
  desde,
}: {
  activo: boolean;
  onClick: () => void;
  icono: React.ReactNode;
  nombre: string;
  detalle: string;
  desde?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`group flex min-w-[158px] snap-start flex-col items-start gap-3 rounded-2xl border p-4 text-left transition-all duration-300 md:min-w-0 ${
        activo
          ? "border-primary bg-primary text-primary-foreground shadow-[var(--shadow-elegant)]"
          : "border-border/70 bg-card hover:-translate-y-1 hover:border-accent/60 hover:shadow-[var(--shadow-soft)]"
      }`}
    >
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
          activo
            ? "bg-white/15"
            : "bg-secondary group-hover:bg-accent group-hover:text-accent-foreground"
        }`}
      >
        {icono}
      </span>
      <span>
        <span className="block text-sm font-semibold leading-tight">{nombre}</span>
        <span
          className={`mt-0.5 block text-xs ${activo ? "text-white/75" : "text-muted-foreground"}`}
        >
          {detalle}
        </span>
        {desde && (
          <span className={`block text-xs ${activo ? "text-white/75" : "text-muted-foreground"}`}>
            {desde}
          </span>
        )}
      </span>
    </button>
  );
}

function Chip({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
        activo
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-foreground hover:bg-secondary"
      }`}
    >
      {children}
    </button>
  );
}