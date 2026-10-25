// src/components/OfertasSection.tsx
import { useMemo, useState } from "react";
import { Flame } from "lucide-react";
import { useOfertas } from "@/hooks/useProducts";
import { fmtPEN, ofertaInfo } from "@/lib/pricing";
import { ProductCard } from "./ProductCard";

const VISIBLES = 8;

export function OfertasSection() {
  const { data = [], isLoading } = useOfertas(24);
  const [categoria, setCategoria] = useState<string | null>(null);
  const [verTodas, setVerTodas] = useState(false);

  // Categorías con ofertas y cuántas hay en cada una
  const categorias = useMemo(() => {
    const conteo = new Map<string, number>();
    for (const p of data)
      if (p.categoria) conteo.set(p.categoria, (conteo.get(p.categoria) ?? 0) + 1);
    return [...conteo.entries()].sort((a, b) => b[1] - a[1]);
  }, [data]);

  const filtradas = categoria ? data.filter((p) => p.categoria === categoria) : data;
  const mostradas = verTodas ? filtradas : filtradas.slice(0, VISIBLES);
  const mayorAhorro = useMemo(() => Math.max(0, ...data.map((p) => ofertaInfo(p).ahorro)), [data]);

  // Sin productos en oferta: no mostramos la sección (evita un bloque vacío en la home)
  if (!isLoading && data.length === 0) return null;

  return (
    <section id="ofertas" className="relative scroll-mt-28 overflow-hidden px-4 py-14">
      <div className="absolute inset-0" style={{ background: "var(--gradient-warm)" }} />
      <div className="absolute inset-0 bg-background/93" />

      <div className="container relative mx-auto max-w-7xl">
        <div
          data-reveal
          className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between"
        >
          <div className="flex items-start gap-3">
            <span className="mt-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
              <Flame className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-3xl font-semibold">Ofertas</h2>
              <p className="text-muted-foreground">
                {mayorAhorro > 0
                  ? `Hasta ${fmtPEN(mayorAhorro)} de ahorro en una sola pieza, por tiempo limitado`
                  : "Piezas seleccionadas con descuento por tiempo limitado"}
              </p>
            </div>
          </div>

          {categorias.length > 1 && (
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="Filtrar ofertas por categoría"
            >
              <Chip activo={categoria === null} onClick={() => setCategoria(null)}>
                Todas ({data.length})
              </Chip>
              {categorias.map(([c, n]) => (
                <Chip key={c} activo={categoria === c} onClick={() => setCategoria(c)}>
                  {c} ({n})
                </Chip>
              ))}
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-[4/3] animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {mostradas.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
            {!verTodas && filtradas.length > VISIBLES && (
              <div className="mt-8 text-center">
                <button
                  type="button"
                  onClick={() => setVerTodas(true)}
                  className="rounded-full border border-foreground/20 px-6 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
                >
                  Ver las {filtradas.length - VISIBLES} ofertas restantes
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
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
          : "border-border bg-card text-foreground hover:bg-secondary"
      }`}
    >
      {children}
    </button>
  );
}
