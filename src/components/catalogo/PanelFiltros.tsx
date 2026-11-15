// src/components/catalogo/PanelFiltros.tsx
// Filtros de /catalogo. `ControlesFiltros` son los controles (precio, categoría, tipo, material, ofertas): van fijos en la
// columna izquierda en PC (mockup azul marino) y dentro de la hoja inferior en móvil (`PanelFiltros`). Los filtros se
// aplican al instante y el botón final de la hoja solo la cierra.
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { CATEGORIAS } from "@/lib/categories";
import { TRAMOS, etiquetaRango, mismoRango } from "@/lib/presupuesto";
import { fmtPEN } from "@/lib/pricing";
import type { FiltrosCatalogo } from "@/lib/filtrosCatalogo";

interface ControlesProps {
  filtros: FiltrosCatalogo;
  onChange: (patch: Partial<FiltrosCatalogo>) => void;
  /** tope del deslizador (precio final más alto, redondeado) */
  topeMax: number;
  paso?: number;
  conteoCategorias: Record<string, number>;
  conteoTipos: Record<string, number>;
  /** material_base de las piezas, con su conteo (solo se muestra si hay al menos uno) */
  conteoMateriales: Record<string, number>;
  ofertasDisponibles: number;
  /** «lateral»: columna fija de PC (filas con casilla, como el mockup); «hoja»: panel del móvil (botones redondeados) */
  variante: "lateral" | "hoja";
}

const fmt = (n: number) => fmtPEN(n).replace(/\.00$/, "");

function Opcion({
  activo, onClick, children, lateral,
}: { activo: boolean; onClick: () => void; children: React.ReactNode; lateral?: boolean }) {
  if (lateral) {
    return (
      <button
        type="button"
        role="checkbox"
        aria-checked={activo}
        onClick={onClick}
        className="flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left text-sm text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span
          aria-hidden
          className={
            "flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[0.7rem] leading-none " +
            (activo ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-transparent")
          }
        >
          ✓
        </span>
        <span className="min-w-0 flex-1">{children}</span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={
        "min-h-11 rounded-full border px-3.5 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
        (activo
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border/60 bg-background text-foreground/70 hover:border-foreground/30 hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}

/** Los controles de filtro, iguales en la columna lateral (PC) y en la hoja (móvil). */
export function ControlesFiltros({
  filtros, onChange, topeMax, paso = 50, conteoCategorias, conteoTipos, conteoMateriales, ofertasDisponibles, variante,
}: ControlesProps) {
  const lateral = variante === "lateral";
  const categoria = CATEGORIAS.find((c) => c.slug === filtros.cat);
  const tipos = categoria?.subcategorias ?? [];
  const materiales = Object.keys(conteoMateriales).sort((a, b) => a.localeCompare(b, "es"));
  const rango = { min: filtros.min, max: filtros.max };
  const hayPrecio = filtros.min != null || filtros.max != null;
  // El deslizador fija solo el tope («Hasta S/ X»); los tramos con mínimo salen como atajos.
  const tope = filtros.max != null ? Math.min(filtros.max, topeMax) : topeMax;
  const grupo = lateral ? "flex flex-col gap-0.5" : "flex flex-wrap gap-2";
  const idp = lateral ? "fl" : "fh";

  return (
    <div className={lateral ? "space-y-6" : "space-y-7"}>
      {/* Presupuesto */}
      <section aria-labelledby={`${idp}-presupuesto`}>
        <div className="flex items-baseline justify-between gap-3">
          <h2 id={`${idp}-presupuesto`} className="font-sans text-sm font-semibold">Precio</h2>
          <p className="t-precio-ficha !text-base">
            {hayPrecio && (filtros.min != null || (filtros.max != null && filtros.max < topeMax))
              ? filtros.min != null
                ? etiquetaRango(rango)
                : `Hasta ${fmt(filtros.max as number)}`
              : "Sin límite"}
          </p>
        </div>
        <Slider
          aria-label="Presupuesto máximo"
          min={0}
          max={topeMax}
          step={paso}
          value={[tope]}
          onValueChange={([v]) => onChange({ min: undefined, max: v >= topeMax ? undefined : v })}
          className="my-5 [&_[role=slider]]:h-6 [&_[role=slider]]:w-6 [&_[role=slider]]:border-2 [&_[role=slider]]:border-primary"
        />
        <div className={grupo} role="group" aria-label="Atajos de presupuesto">
          <Opcion lateral={lateral} activo={!hayPrecio} onClick={() => onChange({ min: undefined, max: undefined })}>
            Sin límite
          </Opcion>
          {TRAMOS.map((t) => (
            <Opcion
              key={t.id}
              lateral={lateral}
              activo={hayPrecio && mismoRango(t, rango)}
              onClick={() => onChange({ min: t.min, max: t.max })}
            >
              {etiquetaRango(t)}
            </Opcion>
          ))}
        </div>
      </section>

      {/* Categoría */}
      <section aria-labelledby={`${idp}-categoria`}>
        <h2 id={`${idp}-categoria`} className="mb-3 font-sans text-sm font-semibold">Categoría</h2>
        <div className={grupo}>
          <Opcion lateral={lateral} activo={!filtros.cat} onClick={() => onChange({ cat: undefined, sub: undefined })}>
            Todas
          </Opcion>
          {CATEGORIAS.map((c) => (
            <Opcion
              key={c.slug}
              lateral={lateral}
              activo={filtros.cat === c.slug}
              onClick={() => onChange({ cat: c.slug, sub: undefined })}
            >
              {c.nombre}
              <span className="text-muted-foreground"> · {conteoCategorias[c.slug] ?? 0}</span>
            </Opcion>
          ))}
        </div>
      </section>

      {/* Tipo: solo cuando la categoría elegida tiene subcategorías */}
      {tipos.length > 0 && (
        <section aria-labelledby={`${idp}-tipo`}>
          <h2 id={`${idp}-tipo`} className="mb-3 font-sans text-sm font-semibold">Tipo de {categoria?.nombre.toLowerCase()}</h2>
          <div className={grupo}>
            <Opcion lateral={lateral} activo={!filtros.sub} onClick={() => onChange({ sub: undefined })}>Todos</Opcion>
            {tipos.map((t) => (
              <Opcion key={t.slug} lateral={lateral} activo={filtros.sub === t.slug} onClick={() => onChange({ sub: t.slug })}>
                {t.label}
                <span className="text-muted-foreground"> · {conteoTipos[t.slug] ?? 0}</span>
              </Opcion>
            ))}
          </div>
        </section>
      )}

      {/* Material: solo los que existen en las piezas (material_base), nunca una lista inventada */}
      {materiales.length > 0 && (
        <section aria-labelledby={`${idp}-material`}>
          <h2 id={`${idp}-material`} className="mb-3 font-sans text-sm font-semibold">Material</h2>
          <div className={grupo}>
            <Opcion lateral={lateral} activo={!filtros.mat} onClick={() => onChange({ mat: undefined })}>Todos</Opcion>
            {materiales.map((m) => (
              <Opcion key={m} lateral={lateral} activo={filtros.mat === m} onClick={() => onChange({ mat: m })}>
                <span className="capitalize">{m}</span>
                <span className="text-muted-foreground"> · {conteoMateriales[m]}</span>
              </Opcion>
            ))}
          </div>
        </section>
      )}

      {/* Ofertas */}
      {(ofertasDisponibles > 0 || filtros.oferta) && (
        <section>
          <Opcion lateral={lateral} activo={!!filtros.oferta} onClick={() => onChange({ oferta: filtros.oferta ? undefined : true })}>
            Solo piezas en oferta
            <span className="text-muted-foreground"> · {ofertasDisponibles}</span>
          </Opcion>
        </section>
      )}
    </div>
  );
}

interface Props extends Omit<ControlesProps, "variante"> {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onLimpiar: () => void;
  /** piezas que quedan con los filtros actuales */
  total: number;
}

export function PanelFiltros({ open, onOpenChange, onLimpiar, total, ...controles }: Props) {
  const esMovil = useIsMobile();
  const f = controles.filtros;
  const hayFiltros = !!f.cat || !!f.mat || f.min != null || f.max != null || !!f.oferta;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={esMovil ? "bottom" : "right"}
        className={"flex flex-col gap-0 p-0 " + (esMovil ? "max-h-[85vh] rounded-t-2xl" : "w-full max-w-sm")}
      >
        <SheetHeader className="border-b border-border/50 px-5 py-4 text-left">
          <SheetTitle className="text-base">Filtros</SheetTitle>
          <SheetDescription className="sr-only">
            Filtra el catálogo por precio, categoría, tipo, material y ofertas.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <ControlesFiltros {...controles} variante="hoja" />
        </div>

        <div className="flex items-center gap-3 border-t border-border/50 bg-background px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {hayFiltros && (
            <Button type="button" variant="ghost" className="min-h-11 rounded-full" onClick={onLimpiar}>
              Quitar filtros
            </Button>
          )}
          <Button type="button" className="min-h-11 flex-1 rounded-full" onClick={() => onOpenChange(false)}>
            {total === 0 ? "Sin resultados" : `Ver ${total} ${total === 1 ? "pieza" : "piezas"}`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
