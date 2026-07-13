import { useEffect } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProductCard } from "@/components/ProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CATEGORIAS, getCategoria } from "@/lib/categories";
import { useCategoryFacets, useProductsByCategory, type ProductSort } from "@/hooks/useProducts";
import { trackEvent } from "@/hooks/useEventTracking";
import { PackageSearch, X } from "lucide-react";

interface CategorySearch {
  sub?: string;
  base?: string;
  sort?: ProductSort;
}

export const Route = createFileRoute("/categoria/$slug")({
  validateSearch: (search: Record<string, unknown>): CategorySearch => ({
    sub: typeof search.sub === "string" ? search.sub : undefined,
    base: typeof search.base === "string" ? search.base : undefined,
    sort:
      search.sort === "precio_asc" || search.sort === "precio_desc" || search.sort === "recientes"
        ? (search.sort as ProductSort)
        : undefined,
  }),
  loader: ({ params }) => {
    if (!getCategoria(params.slug)) throw notFound();
  },
  head: ({ params }) => {
    const cat = getCategoria(params.slug);
    return {
      meta: [
        { title: cat ? `${cat.nombre} — G&M Mueblería` : "Categoría — G&M Mueblería" },
        { name: "description", content: cat?.heroDescripcion ?? "" },
      ],
    };
  },
  component: CategoryPage,
  notFoundComponent: () => <CategoryNotFound />,
});

function CategoryNotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 py-24">
        <div className="text-center max-w-md">
          <h1 className="font-display text-3xl mb-2">Categoría no encontrada</h1>
          <p className="text-sm text-muted-foreground mb-6">
            No tenemos una colección con ese nombre. Explora las categorías disponibles desde el inicio.
          </p>
          <Button asChild className="rounded-full">
            <Link to="/">Volver al inicio</Link>
          </Button>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function CategoryPage() {
  const { slug } = Route.useParams();
  const { sub, base, sort } = Route.useSearch();
  const navigate = Route.useNavigate();
  const cat = getCategoria(slug)!;

  const activeSub = sub && cat.subcategorias.some((s) => s.slug === sub) ? sub : undefined;
  const activeBase =
    base && cat.filtroExtra?.opciones.some((o) => o.slug === base) ? base : undefined;
  const activeSort: ProductSort = sort ?? "recientes";

  const { data: facets = [] } = useCategoryFacets(cat.slug);
  const { data: products = [], isLoading, isError } = useProductsByCategory({
    categoria: cat.slug,
    subcategoria: activeSub,
    materialBase: activeBase,
    sort: activeSort,
  });

  useEffect(() => {
    trackEvent({ tipo: "pagina_vista", path: `/categoria/${cat.slug}` });
  }, [cat.slug]);

  const subCount = (subSlug: string) => facets.filter((f) => f.subcategoria === subSlug).length;
  const baseCount = (baseSlug: string) => facets.filter((f) => f.material_base === baseSlug).length;

  const setSearch = (patch: Partial<CategorySearch>) =>
    navigate({ search: (prev: CategorySearch) => ({ ...prev, ...patch }) });

  const hasActiveFilters = !!activeSub || !!activeBase;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1">
        {/* ── Encabezado de categoría ── */}
        <section className="border-b border-border/50 bg-secondary/30">
          <div className="container mx-auto max-w-7xl px-4 pt-6 pb-10">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/">Inicio</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{cat.nombre}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            <div className="mt-6 flex items-start gap-4">
              <div className="h-14 w-14 shrink-0 rounded-xl bg-accent text-accent-foreground flex items-center justify-center">
                <cat.icon className="h-7 w-7" />
              </div>
              <div>
                <h1 className="font-display text-3xl md:text-4xl font-semibold text-foreground">
                  {cat.nombre}
                </h1>
                <p className="text-muted-foreground mt-1.5 max-w-2xl">{cat.heroDescripcion}</p>
              </div>
            </div>

            {/* Otras colecciones, para navegar sin volver al inicio */}
            <div className="mt-6 flex flex-wrap gap-2">
              {CATEGORIAS.filter((c) => c.slug !== cat.slug).map((c) => (
                <Link
                  key={c.slug}
                  to="/categoria/$slug"
                  params={{ slug: c.slug }}
                  className="text-xs px-3 py-1.5 rounded-full border border-border/60 bg-background text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                >
                  {c.nombre}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── Filtros + resultados ── */}
        <section className="container mx-auto max-w-7xl px-4 py-10">
          {(cat.subcategorias.length > 0 || cat.filtroExtra) && (
            <div className="flex flex-col gap-4 mb-8 pb-6 border-b border-border/50">
              {cat.subcategorias.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground mr-1">
                    Tipo
                  </span>
                  <FilterChip
                    label="Todos"
                    active={!activeSub}
                    onClick={() => setSearch({ sub: undefined })}
                  />
                  {cat.subcategorias.map((s) => (
                    <FilterChip
                      key={s.slug}
                      label={s.label}
                      count={subCount(s.slug)}
                      active={activeSub === s.slug}
                      onClick={() => setSearch({ sub: s.slug })}
                    />
                  ))}
                </div>
              )}

              {cat.filtroExtra && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground mr-1">
                    {cat.filtroExtra.label}
                  </span>
                  <FilterChip
                    label="Todas"
                    active={!activeBase}
                    onClick={() => setSearch({ base: undefined })}
                  />
                  {cat.filtroExtra.opciones.map((o) => (
                    <FilterChip
                      key={o.slug}
                      label={o.label}
                      count={baseCount(o.slug)}
                      active={activeBase === o.slug}
                      onClick={() => setSearch({ base: o.slug })}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <p className="text-sm text-muted-foreground">
              {isLoading ? "Buscando…" : `${products.length} producto${products.length === 1 ? "" : "s"}`}
              {hasActiveFilters && (
                <button
                  onClick={() => setSearch({ sub: undefined, base: undefined })}
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

          {isLoading ? (
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
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center text-center py-24 gap-3">
              <PackageSearch className="h-10 w-10 text-muted-foreground/50" />
              <p className="font-medium text-foreground">Aún no hay productos aquí</p>
              <p className="text-sm text-muted-foreground max-w-sm">
                {hasActiveFilters
                  ? "No encontramos productos con esos filtros. Prueba quitando alguno."
                  : "Estamos preparando esta colección. Vuelve pronto."}
              </p>
              {hasActiveFilters && (
                <Button variant="outline" className="rounded-full mt-2" onClick={() => setSearch({ sub: undefined, base: undefined })}>
                  Quitar filtros
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
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