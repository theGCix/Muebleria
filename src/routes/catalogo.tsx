// src/routes/catalogo.tsx
// Catálogo completo. Todos los filtros viven en la URL (q, cat, sub, min, max, oferta, sort) y se
// aplican en el cliente sobre las piezas activas (useCatalogoHome), igual que el home: así la
// búsqueda, el presupuesto y el orden dan siempre el mismo resultado y los enlaces se comparten.
import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProductCard } from "@/components/ProductCard";
import { BarraFiltros } from "@/components/catalogo/BarraFiltros";
import { ControlesFiltros, PanelFiltros } from "@/components/catalogo/PanelFiltros";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { CATEGORIAS } from "@/lib/categories";
import type { Product } from "@/hooks/useProducts";
import { useCatalogoHome } from "@/hooks/useCatalogoHome";
import { ofertaInfo } from "@/lib/pricing";
import {
  ORDENES_CATALOGO, aplicarFiltros, contarFiltros, contarPor, ordenar,
  type FiltrosCatalogo, type ItemFiltrable, type OrdenCatalogo,
} from "@/lib/filtrosCatalogo";
import { useSearchStore } from "@/stores/searchStore";
import { trackEvent } from "@/hooks/useEventTracking";
import { trackSearch } from "@/lib/analytics";
import { useSeo, migasJsonLd } from "@/lib/seo";
import { ChevronLeft, ChevronRight, PackageSearch, Search } from "lucide-react";

/** Piezas que se piden de una vez. Si el catálogo activo supera este número, subirlo aquí. */
const LIMITE_CATALOGO = 60;
/** Piezas por página (paginación numerada del mockup, en el cliente). */
const POR_PAGINA = 12;
const PASO_PRECIO = 50;

interface CatalogoSearch {
  q?: string;
  cat?: string;
  /** tipo (subcategoría); solo vale junto con `cat` */
  sub?: string;
  /** material_base (solo los que existen en las piezas) */
  mat?: string;
  sort?: OrdenCatalogo;
  /** Presupuesto (precio final con oferta): min exclusivo, max inclusivo. Ver lib/presupuesto.ts */
  min?: number;
  max?: number;
  /** solo piezas con oferta vigente */
  oferta?: boolean;
}

/** Acepta número o texto numérico ≥ 0; cualquier otra cosa se ignora. */
function monto(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

type Item = ItemFiltrable & { p: Product };

const aItem = (p: Product): Item => {
  const o = ofertaInfo(p);
  return {
    p,
    nombre: p.nombre,
    descripcion: p.descripcion,
    categoria: p.categoria,
    subcategoria: p.subcategoria,
    material: p.material_base?.trim() || null,
    precioFinal: o.precioFinal,
    enOferta: o.activa,
    descuento: o.activa ? (p.descuento_porcentaje ?? 0) : 0,
    creado: p.created_at,
  };
};

export const Route = createFileRoute("/catalogo")({
  validateSearch: (search: Record<string, unknown>): CatalogoSearch => ({
    q: typeof search.q === "string" ? search.q : undefined,
    cat: typeof search.cat === "string" ? search.cat : undefined,
    sub: typeof search.sub === "string" ? search.sub : undefined,
    mat: typeof search.mat === "string" && search.mat.trim() ? search.mat : undefined,
    sort: ORDENES_CATALOGO.includes(search.sort as OrdenCatalogo) ? (search.sort as OrdenCatalogo) : undefined,
    min: monto(search.min),
    max: monto(search.max),
    oferta: search.oferta === true || search.oferta === "true" || search.oferta === 1 ? true : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Catálogo completo — G&M Mueblería" },
      { name: "description", content: "Explora todos nuestros muebles: salas, comedores, recámaras, separadores de ambiente y accesorios." },
    ],
  }),
  component: CatalogoPage,
});

function CatalogoPage() {
  const { q, cat, sub, mat, sort, min, max, oferta } = Route.useSearch();
  const navigate = Route.useNavigate();
  const storeQuery = useSearchStore((s) => s.query);
  const setStoreQuery = useSearchStore((s) => s.setQuery);

  // SEO: mismo título/descripción que head() + migas de pan
  useSeo({
    title: "Catálogo completo — G&M Mueblería",
    description: "Explora todos nuestros muebles: salas, comedores, recámaras, separadores de ambiente y accesorios.",
    path: "/catalogo",
    jsonLd: migasJsonLd([
      { nombre: "Inicio", path: "/" },
      { nombre: "Catálogo", path: "/catalogo" },
    ]),
  });

  // El buscador del header (goToCatalogo) escribe en el store global de
  // búsqueda; si llegamos con un término pendiente ahí, lo adoptamos.
  const [searchInput, setSearchInput] = useState(q ?? storeQuery ?? "");
  const [pagina, setPagina] = useState(1);
  const [panelAbierto, setPanelAbierto] = useState(false);

  const activeSort: OrdenCatalogo = sort ?? "recientes";
  const activeCat = cat && CATEGORIAS.some((c) => c.slug === cat) ? cat : undefined;
  const activeSub =
    activeCat && sub && CATEGORIAS.find((c) => c.slug === activeCat)?.subcategorias.some((s) => s.slug === sub)
      ? sub
      : undefined;

  const filtros: FiltrosCatalogo = { q: q || undefined, cat: activeCat, sub: activeSub, mat, min, max, oferta, sort: activeSort };
  const cantidadFiltros = contarFiltros(filtros);
  const hasActiveFilters = cantidadFiltros > 0 || !!q;

  const { data: productos, isLoading, isError } = useCatalogoHome(LIMITE_CATALOGO);
  const items = useMemo(() => (productos ?? []).map(aItem), [productos]);

  const lista = useMemo(() => ordenar(aplicarFiltros(items, filtros), activeSort), [items, q, activeCat, activeSub, mat, min, max, oferta, activeSort]); // eslint-disable-line react-hooks/exhaustive-deps
  const conteoCategorias = useMemo(() => contarPor(items, filtros, "categoria"), [items, q, activeCat, activeSub, mat, min, max, oferta]); // eslint-disable-line react-hooks/exhaustive-deps
  const conteoTipos = useMemo(() => contarPor(items, filtros, "subcategoria"), [items, q, activeCat, activeSub, mat, min, max, oferta]); // eslint-disable-line react-hooks/exhaustive-deps
  const conteoMateriales = useMemo(() => contarPor(items, filtros, "material"), [items, q, activeCat, activeSub, mat, min, max, oferta]); // eslint-disable-line react-hooks/exhaustive-deps
  const ofertasDisponibles = useMemo(() => aplicarFiltros(items, filtros, "oferta").filter((i) => i.enOferta).length, [items, q, activeCat, activeSub, mat, min, max]); // eslint-disable-line react-hooks/exhaustive-deps
  const topeMax = useMemo(() => {
    const mayor = items.reduce((m, i) => Math.max(m, i.precioFinal), 0);
    return Math.max(PASO_PRECIO, Math.ceil(mayor / PASO_PRECIO) * PASO_PRECIO);
  }, [items]);

  // Cada cambio de filtro vuelve a la primera tanda.
  useEffect(() => setPagina(1), [q, activeCat, activeSub, mat, min, max, oferta, activeSort]);

  useEffect(() => {
    trackEvent({ tipo: "pagina_vista", path: "/catalogo" });
  }, []);

  // Búsquedas del cliente (header y catálogo terminan en /catalogo?q=)
  useEffect(() => {
    if (q) trackSearch(q);
  }, [q]);

  const setSearch = (patch: Partial<CatalogoSearch>) =>
    navigate({ search: (prev: CatalogoSearch) => ({ ...prev, ...patch }) });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStoreQuery(searchInput);
    setSearch({ q: searchInput || undefined });
  };

  const clearFilters = () => {
    setSearchInput("");
    setStoreQuery("");
    navigate({ search: {} });
  };

  // Sin categoría no hay tipo: al cambiar de categoría se limpia el tipo.
  const cambiarFiltros = (patch: Partial<FiltrosCatalogo>) => setSearch(patch as Partial<CatalogoSearch>);
  const total = lista.length;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const paginaActual = Math.min(pagina, paginas);
  const mostrados = lista.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);
  const irAPagina = (n: number) => {
    setPagina(n);
    document.getElementById("resultados")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const catActual = CATEGORIAS.find((c) => c.slug === activeCat);
  const titulo = catActual ? (catActual.slug === "muebles" ? "Salas" : catActual.slug === "separadores" ? "Separadores" : catActual.nombre) : "Catálogo completo";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1">
        {/* ── Encabezado (compacto en móvil) ── */}
        <section className="border-b border-border/50 bg-secondary/30">
          <div className="container mx-auto max-w-7xl px-4 pt-5 pb-6 md:pt-6 md:pb-10">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild><Link to="/">Inicio</Link></BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem><BreadcrumbPage>Catálogo</BreadcrumbPage></BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            <h1 className="t-seccion mt-4 text-foreground md:mt-6">{titulo}</h1>
            <p className="mt-1.5 hidden max-w-2xl text-muted-foreground md:block">
              Todos nuestros muebles en un solo lugar: filtra por categoría, busca y ordena a tu gusto.
            </p>

            <form onSubmit={handleSearchSubmit} role="search" className="relative mt-4 max-w-md md:mt-6">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Buscar por nombre o descripción…"
                aria-label="Buscar en el catálogo"
                className="pl-10 h-11 rounded-full bg-background"
              />
            </form>
          </div>
        </section>

        {/* ── Filtros (columna fija en PC) + resultados ── */}
        <section className="container mx-auto max-w-7xl px-4 py-6 md:py-10">
          <div className="lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10">
            <aside aria-label="Filtros" className="hidden lg:block">
              <div className="sticky top-28 rounded-2xl border border-border/60 bg-card p-5">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <p className="font-sans text-base font-semibold">Filtrar por</p>
                  {cantidadFiltros > 0 && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="min-h-11 text-sm font-semibold text-accent-strong hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Quitar
                    </button>
                  )}
                </div>
                <ControlesFiltros
                  variante="lateral"
                  filtros={filtros}
                  onChange={cambiarFiltros}
                  topeMax={topeMax}
                  paso={PASO_PRECIO}
                  conteoCategorias={conteoCategorias}
                  conteoTipos={conteoTipos}
                  conteoMateriales={conteoMateriales}
                  ofertasDisponibles={ofertasDisponibles}
                />
              </div>
            </aside>

            <div id="resultados" className="min-w-0 scroll-mt-28">
              <BarraFiltros
                filtros={filtros}
                cantidadFiltros={cantidadFiltros}
                orden={activeSort}
                onAbrirPanel={() => setPanelAbierto(true)}
                onChange={cambiarFiltros}
                onOrden={(o) => setSearch({ sort: o === "recientes" ? undefined : o })}
              />

              <PanelFiltros
                open={panelAbierto}
                onOpenChange={setPanelAbierto}
                filtros={filtros}
                onChange={cambiarFiltros}
                onLimpiar={clearFilters}
                total={total}
                topeMax={topeMax}
                paso={PASO_PRECIO}
                conteoCategorias={conteoCategorias}
                conteoTipos={conteoTipos}
                conteoMateriales={conteoMateriales}
                ofertasDisponibles={ofertasDisponibles}
              />

              <p className="mb-5 text-sm text-muted-foreground" aria-live="polite">
                {isLoading ? "Buscando…" : `${total} producto${total === 1 ? "" : "s"}`}
                {q && !isLoading && <span> para «{q}»</span>}
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="ml-3 inline-flex min-h-[44px] items-center text-accent-strong hover:underline lg:hidden"
                  >
                    Quitar filtros
                  </button>
                )}
              </p>

              {isLoading ? (
                <div className="grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="space-y-3">
                      <Skeleton className="aspect-[4/3] w-full rounded-xl" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  ))}
                </div>
              ) : isError ? (
                <div className="py-24 text-center text-muted-foreground">
                  Ocurrió un error al cargar los productos. Intenta de nuevo en un momento.
                </div>
              ) : total === 0 ? (
                <div className="flex flex-col items-center gap-3 py-24 text-center">
                  <PackageSearch className="h-10 w-10 text-muted-foreground/50" />
                  <p className="font-medium text-foreground">No encontramos productos</p>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    {min != null || max != null
                      ? "Prueba ampliando tu presupuesto o quita los filtros aplicados."
                      : "Prueba con otra búsqueda o quita los filtros aplicados."}
                  </p>
                  {hasActiveFilters && (
                    <Button variant="outline" className="mt-2 rounded-full" onClick={clearFilters}>
                      Quitar filtros
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-3">
                    {mostrados.map((i) => (
                      <ProductCard key={i.p.id} product={i.p} />
                    ))}
                  </div>

                  {paginas > 1 && (
                    <nav aria-label="Páginas de resultados" className="mt-10 flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => irAPagina(paginaActual - 1)}
                        disabled={paginaActual === 1}
                        aria-label="Página anterior"
                        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border/60 text-foreground disabled:opacity-40 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <ChevronLeft className="h-4 w-4" aria-hidden />
                      </button>
                      {Array.from({ length: paginas }, (_, i) => i + 1).map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => irAPagina(n)}
                          aria-label={`Página ${n}`}
                          aria-current={n === paginaActual ? "page" : undefined}
                          className={
                            "inline-flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
                            (n === paginaActual
                              ? "bg-primary text-primary-foreground"
                              : "border border-border/60 text-foreground hover:bg-secondary")
                          }
                        >
                          {n}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => irAPagina(paginaActual + 1)}
                        disabled={paginaActual === paginas}
                        aria-label="Página siguiente"
                        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border/60 text-foreground disabled:opacity-40 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <ChevronRight className="h-4 w-4" aria-hidden />
                      </button>
                    </nav>
                  )}
                </>
              )}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
