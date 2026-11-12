// src/components/CategoryMegaMenu.tsx
// Mega-menú de categorías para el navbar de escritorio.
// Panel de dos columnas: rail izquierdo con las categorías (hover cambia
// la columna derecha), columna derecha con subcategorías + accesos rápidos.
// Toda la data viene de src/lib/categories.ts — no hay nada hardcodeado aquí.
//
// Teclado: Enter/Espacio/↓ abren y llevan el foco a la primera categoría · ↑/↓ recorren · Inicio/Fin saltan ·
// → pasa a las subcategorías, ← vuelve · Esc cierra y devuelve el foco al botón · al salir el foco, se cierra.
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, LayoutGrid } from "lucide-react";
import { CATEGORIAS, type CategoriaConfig } from "@/lib/categories";

interface CategoryMegaMenuProps {
  onNavigate?: () => void;
  /** true cuando la página actual es una categoría (/categoria/…): resalta el botón */
  activo?: boolean;
}

export function CategoryMegaMenu({ onNavigate, activo = false }: CategoryMegaMenuProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<CategoriaConfig>(CATEGORIAS[0]);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const railRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // Cuando el menú se abrió con teclado: el ratón que pasa por encima no debe cerrarlo.
  const modoTeclado = useRef(false);
  // Foco pendiente tras abrir con teclado (el panel aún no existe en el DOM al pulsar).
  const enfocarAlAbrir = useRef(false);

  const scheduleClose = () => {
    if (modoTeclado.current) return;
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };
  const entraRaton = () => {
    modoTeclado.current = false;
    cancelClose();
    setOpen(true);
  };

  useEffect(() => {
    if (open && enfocarAlAbrir.current) {
      enfocarAlAbrir.current = false;
      railRefs.current[0]?.focus();
    }
    if (!open) modoTeclado.current = false;
  }, [open]);

  useEffect(() => () => cancelClose(), []);

  const cerrarYVolver = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const abrirConTeclado = () => {
    modoTeclado.current = true;
    cancelClose();
    setActive(CATEGORIAS[0]);
    enfocarAlAbrir.current = true;
    setOpen(true);
  };

  const enlacesPanel = () => Array.from(panelRef.current?.querySelectorAll<HTMLElement>("a[href]") ?? []);

  const onTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      abrirConTeclado();
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
    }
  };

  // Enter y Espacio llegan como clic con detail === 0 (clic de teclado); el ratón conserva su comportamiento.
  const onTriggerClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (e.detail === 0) {
      if (open) setOpen(false);
      else abrirConTeclado();
      return;
    }
    setOpen((v) => !v);
  };

  const onRailKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = CATEGORIAS.length;
    const ir = (j: number) => {
      e.preventDefault();
      modoTeclado.current = true;
      railRefs.current[j]?.focus();
    };
    switch (e.key) {
      case "ArrowDown": ir((i + 1) % n); break;
      case "ArrowUp": ir((i - 1 + n) % n); break;
      case "Home": ir(0); break;
      case "End": ir(n - 1); break;
      case "ArrowRight": {
        const primero = enlacesPanel()[0];
        if (primero) { e.preventDefault(); modoTeclado.current = true; primero.focus(); }
        break;
      }
      case "Escape":
        e.preventDefault();
        cerrarYVolver();
        break;
    }
  };

  const onPanelKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const enlaces = enlacesPanel();
    const i = enlaces.indexOf(document.activeElement as HTMLElement);
    switch (e.key) {
      case "ArrowLeft": {
        e.preventDefault();
        const idx = CATEGORIAS.findIndex((c) => c.slug === active.slug);
        railRefs.current[idx]?.focus();
        break;
      }
      case "ArrowDown":
        if (i >= 0 && enlaces.length > 0) { e.preventDefault(); enlaces[(i + 1) % enlaces.length].focus(); }
        break;
      case "ArrowUp":
        if (i >= 0 && enlaces.length > 0) { e.preventDefault(); enlaces[(i - 1 + enlaces.length) % enlaces.length].focus(); }
        break;
      case "Escape":
        e.preventDefault();
        cerrarYVolver();
        break;
    }
  };

  // Al salir el foco del menú (Tab hacia fuera) se cierra. Clics en zonas sin foco quedan dentro:
  // el panel tiene tabIndex={-1} y recibe ese foco.
  const onBlurWrap = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!open) return;
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
  };

  const handleNavigate = () => {
    setOpen(false);
    onNavigate?.();
  };

  return (
    <div
      ref={wrapRef}
      className="relative"
      onMouseEnter={entraRaton}
      onMouseLeave={scheduleClose}
      onBlur={onBlurWrap}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={onTriggerClick}
        onKeyDown={onTriggerKeyDown}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls="megamenu-categorias"
        aria-current={activo ? "true" : undefined}
        className={`relative flex items-center gap-1.5 rounded-sm text-sm font-medium transition-colors py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:origin-left after:rounded-full after:bg-accent after:transition-transform after:duration-300 ${
          activo ? "after:scale-x-100" : "after:scale-x-0"
        } ${open ? "text-accent" : activo ? "text-foreground" : "text-foreground/70 hover:text-foreground"}`}
      >
        <LayoutGrid className="h-4 w-4" aria-hidden="true" />
        Categorías
      </button>

      {open && (
        <div
          id="megamenu-categorias"
          tabIndex={-1}
          className="absolute left-1/2 top-full z-50 mt-2 w-[min(720px,90vw)] -translate-x-1/3 overflow-hidden rounded-2xl border border-border/60 bg-popover shadow-[var(--shadow-elegant)] focus:outline-none"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <div className="grid grid-cols-[220px_1fr]">
            {/* Rail izquierdo */}
            <div className="border-r border-border/50 bg-secondary/30 py-3">
              {CATEGORIAS.map((cat, i) => (
                <button
                  key={cat.slug}
                  ref={(el) => { railRefs.current[i] = el; }}
                  type="button"
                  tabIndex={active.slug === cat.slug ? 0 : -1}
                  aria-current={active.slug === cat.slug ? "true" : undefined}
                  onMouseEnter={() => setActive(cat)}
                  onFocus={() => setActive(cat)}
                  onKeyDown={(e) => onRailKeyDown(e, i)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
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
                    <cat.icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  {cat.nombre}
                </button>
              ))}
            </div>

            {/* Panel derecho */}
            <div className="p-6" ref={panelRef} onKeyDown={onPanelKeyDown}>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="font-display text-xl font-semibold text-foreground">{active.nombre}</h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-sm">{active.descripcion}</p>
                </div>
                <Link
                  to="/categoria/$slug"
                  params={{ slug: active.slug }}
                  onClick={handleNavigate}
                  className="flex-shrink-0 rounded-full border border-border/60 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent hover:text-accent-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                      className="group flex items-center justify-between rounded-md px-2 py-2 text-sm text-foreground/75 hover:bg-secondary/60 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                  className="group flex items-center justify-between rounded-md px-2 py-2 text-sm text-foreground/75 hover:bg-secondary/60 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                        className="rounded-full border border-border/60 px-3 py-1 text-xs text-foreground/70 hover:border-accent hover:text-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {op.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Acceso al catálogo completo (reemplaza la pestaña "Catálogo" del navbar) */}
          <Link
            to="/catalogo"
            onClick={handleNavigate}
            className="flex items-center justify-between border-t border-border/50 bg-secondary/30 px-6 py-3 text-sm font-medium text-accent transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Ver todo el catálogo
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}