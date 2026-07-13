// src/components/CategoryMegaMenu.tsx
// Mega-menú de categorías para el navbar de escritorio.
// Panel de dos columnas: rail izquierdo con las categorías (hover cambia
// la columna derecha), columna derecha con subcategorías + accesos rápidos.
// Toda la data viene de src/lib/categories.ts — no hay nada hardcodeado aquí.
import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, LayoutGrid } from "lucide-react";
import { CATEGORIAS, type CategoriaConfig } from "@/lib/categories";

interface CategoryMegaMenuProps {
  onNavigate?: () => void;
}

export function CategoryMegaMenu({ onNavigate }: CategoryMegaMenuProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<CategoriaConfig>(CATEGORIAS[0]);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  const handleNavigate = () => {
    setOpen(false);
    onNavigate?.();
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => { cancelClose(); setOpen(true); }}
      onMouseLeave={scheduleClose}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`flex items-center gap-1.5 text-sm font-medium transition-colors py-2 ${
          open ? "text-accent" : "text-foreground/70 hover:text-foreground"
        }`}
      >
        <LayoutGrid className="h-4 w-4" />
        Categorías
      </button>

      {open && (
        <div
          className="absolute left-1/2 top-full z-50 mt-2 w-[min(720px,90vw)] -translate-x-1/3 overflow-hidden rounded-2xl border border-border/60 bg-popover shadow-[var(--shadow-elegant)]"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <div className="grid grid-cols-[220px_1fr]">
            {/* Rail izquierdo */}
            <div className="border-r border-border/50 bg-secondary/30 py-3">
              {CATEGORIAS.map((cat) => (
                <button
                  key={cat.slug}
                  onMouseEnter={() => setActive(cat)}
                  onFocus={() => setActive(cat)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors ${
                    active.slug === cat.slug
                      ? "bg-card text-foreground font-medium"
                      : "text-foreground/70 hover:bg-card/60 hover:text-foreground"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md transition-colors ${
                      active.slug === cat.slug
                        ? "bg-accent text-accent-foreground"
                        : "bg-background text-foreground/60"
                    }`}
                  >
                    <cat.icon className="h-4 w-4" />
                  </span>
                  {cat.nombre}
                </button>
              ))}
            </div>

            {/* Panel derecho */}
            <div className="p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="font-display text-xl font-semibold text-foreground">{active.nombre}</h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-sm">{active.descripcion}</p>
                </div>
                <Link
                  to="/categoria/$slug"
                  params={{ slug: active.slug }}
                  onClick={handleNavigate}
                  className="flex-shrink-0 rounded-full border border-border/60 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  Ver todo
                </Link>
              </div>

              {active.subcategorias.length > 0 ? (
                <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                  {active.subcategorias.map((sub) => (
                    <Link
                      key={sub.slug}
                      to="/categoria/$slug"
                      params={{ slug: active.slug }}
                      search={{ sub: sub.slug }}
                      onClick={handleNavigate}
                      className="group flex items-center justify-between rounded-md px-2 py-2 text-sm text-foreground/75 hover:bg-secondary/60 hover:text-foreground transition-colors"
                    >
                      {sub.label}
                      <ArrowRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-accent" />
                    </Link>
                  ))}
                </div>
              ) : (
                <Link
                  to="/categoria/$slug"
                  params={{ slug: active.slug }}
                  onClick={handleNavigate}
                  className="group flex items-center justify-between rounded-md px-2 py-2 text-sm text-foreground/75 hover:bg-secondary/60 hover:text-foreground transition-colors"
                >
                  Ver toda la colección
                  <ArrowRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-accent" />
                </Link>
              )}

              {active.filtroExtra && (
                <div className="mt-5 pt-4 border-t border-border/50">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">{active.filtroExtra.label}</p>
                  <div className="flex flex-wrap gap-2">
                    {active.filtroExtra.opciones.map((op) => (
                      <Link
                        key={op.slug}
                        to="/categoria/$slug"
                        params={{ slug: active.slug }}
                        search={{ base: op.slug }}
                        onClick={handleNavigate}
                        className="rounded-full border border-border/60 px-3 py-1 text-xs text-foreground/70 hover:border-accent hover:text-accent transition-colors"
                      >
                        {op.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}