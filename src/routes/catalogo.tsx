// src/routes/catalogo.tsx
import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProductCard } from "@/components/ProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CATEGORIAS } from "@/lib/categories";
import { useAllProducts, useProductCountsByCategory, type ProductSort, type Product } from "@/hooks/useProducts";
import { useSearchStore } from "@/stores/searchStore";
import { trackEvent } from "@/hooks/useEventTracking";
import { PackageSearch, Search, X, LayoutGrid } from "lucide-react";

interface CatalogoSearch {
  q?: string;
  cat?: string;
  sort?: ProductSort;
}

export const Route = createFileRoute("/catalogo")({
  validateSearch: (search: Record<string, unknown>): CatalogoSearch => ({
    q: typeof search.q === "string" ? search.q : undefined,
    cat: typeof search.cat === "string" ? search.cat : undefined,
    sort:
      search.sort === "precio_asc" || search.sort === "precio_desc" || search.sort === "recientes"
        ? (search.sort as ProductSort)
        : undefined,
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
  const { q, cat, sort } = Route.useSearch();
  const navigate = Route.useNavigate();
  const storeQuery = useSearchStore((s) => s.query);
  const setStoreQuery = useSearchStore((s) => s.setQuery);

  // El buscador del header (goToCatalogo) escribe en el store global de
  // búsqueda; si llegamos con un término pendiente ahí, lo adoptamos.
  const [searchInput, setSearchInput] = useState(q ?? storeQuery ?? "");
  const [page, setPage] = useState(0);
  const [accumulated, setAccumulated] = useState<Product[]>([]);

  const activeSort: ProductSort = sort ?? "recientes";
  const activeCat = cat && CATEGORIAS.some((c) => c.slug === cat) ? cat : undefined;

  const { data: counts = {} } = useProductCountsByCategory();
  const { data, isLoading, isFetching, isError } = useAllProducts({
    search: q || undefined,
    categoria: activeCat,
    sort: activeSort,
    page,
  });

  // Resetea la paginación acumulada cada vez que cambian los filtros.
  useEffect(() => {
    setPage(0);
    setAccumulated([]);
  }, [q, activeCat, activeSort]);

  useEffect(() => {
    if (!data) return;
    setAccumulated((prev) => (page === 0 ? data.products : [...prev, ...data.products]));
  }, [data, page]);

  useEffect(() => {
    trackEvent({ tipo: "pagina_vista", path: "/catalogo" });
  }, []);

  const setSearch = (patch: Partial<CatalogoSearch>) =>
    navigate({ search: (prev: CatalogoSearch) => ({ ...prev, ...patch }) });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStoreQuery(searchInput);
    setSearch({ q: searchInput || undefined });
  };

  const total = data?.total ?? 0;
  const hasMore = accumulated.length < total;
  const hasActiveFilters = !!activeCat || !!q;

  const clearFilters = () => {
    setSearchInput("");
    setStoreQuery("");
    navigate({ search: {} });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1">
        {/* ── Encabezado ── */}
        <section className="border-b border-border/50 bg-secondary/30">
          <div className="container mx-auto max-w-7xl px-4 pt-6 pb-10">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild><Link to="/">Inicio</Link></BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem><BreadcrumbPage>Catálogo</BreadcrumbPage></BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            <div className="mt-6 flex items-start gap-4">
              <div className="h-14 w-14 shrink-0 rounded-xl bg-accent text-accent-foreground flex items-center justify-center">
                <LayoutGrid className="h-7 w-7" />
              </div>
              <div>
                <h1 className="font-display text-3xl md:text-4xl font-semibold text-foreground">
                  Catálogo completo
                </h1>
                <p className="text-muted-foreground mt-1.5 max-w-2xl">
                  Todos nuestros muebles en un solo lugar: filtra por categoría, busca y ordena a tu gusto.
                </p>
              </div>
            </div>

            <form onSubmit={handleSearchSubmit} className="mt-6 relative max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Buscar por nombre o descripción…"
                className="pl-10 h-11 rounded-full bg-background"
              />
            </form>
          </div>
        </section>

        {/* ── Filtros + resultados ── */}
        <section className="container mx-auto max-w-7xl px-4 py-10">
          <div className="flex flex-col gap-4 mb-8 pb-6 border-b border-border/50">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-muted-foreground mr-1">Categoría</span>
              <FilterChip
                label="Todas"
                count={Object.values(counts).reduce((a, b) => a + b, 0)}
                active={!activeCat}
                onClick={() => setSearch({ cat: undefined })}
              />
              {CATEGORIAS.map((c) => (
                <FilterChip
                  key={c.slug}
                  label={c.nombre}
                  count={counts[c.slug] ?? 0}
                  active={activeCat === c.slug}
                  onClick={() => setSearch({ cat: c.slug })}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <p className="text-sm text-muted-foreground">
              {isLoading && page === 0 ? "Buscando…" : `${total} producto${total === 1 ? "" : "s"}`}
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 ml-3 text-accent hover:underline"
                >
                  <X className="h-3 w-3" /> Quitar filtros
                </button>
              )}
            </p>
            <Select value={activeSort} onValueChange={(v) => setSearch({ sort: v as ProductSort })}>
              <SelectTrigger className="w-[190px]">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recientes">Más recientes</SelectItem>
                <SelectItem value="precio_asc">Precio: menor a mayor</SelectItem>
                <SelectItem value="precio_desc">Precio: mayor a menor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading && page === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-[4/3] w-full rounded-xl" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="text-center py-24 text-muted-foreground">
              Ocurrió un error al cargar los productos. Intenta de nuevo en un momento.
            </div>
          ) : accumulated.length === 0 ? (
            <div className="flex flex-col items-center text-center py-24 gap-3">
              <PackageSearch className="h-10 w-10 text-muted-foreground/50" />
              <p className="font-medium text-foreground">No encontramos productos</p>
              <p className="text-sm text-muted-foreground max-w-sm">
                Prueba con otra búsqueda o quita los filtros aplicados.
              </p>
              {hasActiveFilters && (
                <Button variant="outline" className="rounded-full mt-2" onClick={clearFilters}>
                  Quitar filtros
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {accumulated.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>

              {hasMore && (
                <div className="flex justify-center mt-10">
                  <Button
                    variant="outline"
                    size="lg"
                    className="rounded-full px-8"
                    disabled={isFetching}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    {isFetching ? "Cargando…" : `Cargar más (${accumulated.length} de ${total})`}
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}

function FilterChip({
  label, count, active, onClick,
}: { label: string; count?: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "px-3.5 py-1.5 rounded-full text-sm border transition-colors " +
        (active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background text-foreground/70 border-border/60 hover:border-foreground/30 hover:text-foreground")
      }
    >
      {label}
      {typeof count === "number" && (
        <span className={active ? "opacity-75" : "opacity-50"}> · {count}</span>
      )}
    </button>
  );
}