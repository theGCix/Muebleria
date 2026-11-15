// src/components/catalogo/PanelFiltros.tsx
// Panel de filtros de /catalogo: móvil = hoja inferior, PC = hoja lateral. Mismos controles y
// misma lógica en ambos; los filtros se aplican al instante y el botón final solo cierra el panel.
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { CATEGORIAS } from "@/lib/categories";
import { TRAMOS, etiquetaRango, mismoRango } from "@/lib/presupuesto";
import { fmtPEN } from "@/lib/pricing";
import type { FiltrosCatalogo } from "@/lib/filtrosCatalogo";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  filtros: FiltrosCatalogo;
  onChange: (patch: Partial<FiltrosCatalogo>) => void;
  onLimpiar: () => void;
  /** piezas que quedan con los filtros actuales */
  total: number;
  /** tope del deslizador (precio final más alto, redondeado) */
  topeMax: number;
  paso?: number;
  conteoCategorias: Record<string, number>;
  conteoTipos: Record<string, number>;
  ofertasDisponibles: number;
}

const fmt = (n: number) => fmtPEN(n).replace(/\.00$/, "");

function Opcion({
  activo, onClick, children,
}: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
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

export function PanelFiltros({
  open, onOpenChange, filtros, onChange, onLimpiar, total, topeMax, paso = 50,
  conteoCategorias, conteoTipos, ofertasDisponibles,
}: Props) {
  const esMovil = useIsMobile();
  const categoria = CATEGORIAS.find((c) => c.slug === filtros.cat);
  const tipos = categoria?.subcategorias ?? [];
  const rango = { min: filtros.min, max: filtros.max };
  const hayPrecio = filtros.min != null || filtros.max != null;
  // El deslizador fija solo el tope («Hasta S/ X»); los tramos con mínimo salen como atajos.
  const tope = filtros.max != null ? Math.min(filtros.max, topeMax) : topeMax;
  const hayFiltros = !!filtros.cat || hayPrecio || !!filtros.oferta;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={esMovil ? "bottom" : "right"}
        className={
          "flex flex-col gap-0 p-0 " +
          (esMovil ? "max-h-[85vh] rounded-t-2xl" : "w-full max-w-sm")
        }
      >
        <SheetHeader className="border-b border-border/50 px-5 py-4 text-left">
          <SheetTitle className="text-base">Filtros</SheetTitle>
          <SheetDescription className="sr-only">
            Filtra el catálogo por presupuesto, categoría, tipo y ofertas.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-7 overflow-y-auto px-5 py-5">
          {/* Presupuesto */}
          <section aria-labelledby="f-presupuesto">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="f-presupuesto" className="text-sm font-semibold font-sans">Presupuesto</h2>
              <p className="t-precio-ficha">
                {filtros.min != null && filtros.max != null
                  ? etiquetaRango(rango)
                  : filtros.min != null
                    ? etiquetaRango(rango)
                    : filtros.max != null && filtros.max < topeMax
                      ? `Hasta ${fmt(filtros.max)}`
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
            <div className="flex flex-wrap gap-2" role="group" aria-label="Atajos de presupuesto">
              <Opcion activo={!hayPrecio} onClick={() => onChange({ min: undefined, max: undefined })}>
                Sin límite
              </Opcion>
              {TRAMOS.map((t) => (
                <Opcion
                  key={t.id}
                  activo={hayPrecio && mismoRango(t, rango)}
                  onClick={() => onChange({ min: t.min, max: t.max })}
                >
                  {etiquetaRango(t)}
                </Opcion>
              ))}
            </div>
          </section>

          {/* Categoría */}
          <section aria-labelledby="f-categoria">
            <h2 id="f-categoria" className="mb-3 text-sm font-semibold font-sans">Categoría</h2>
            <div className="flex flex-wrap gap-2">
              <Opcion activo={!filtros.cat} onClick={() => onChange({ cat: undefined, sub: undefined })}>
                Todas
              </Opcion>
              {CATEGORIAS.map((c) => (
                <Opcion
                  key={c.slug}
                  activo={filtros.cat === c.slug}
                  onClick={() => onChange({ cat: c.slug, sub: undefined })}
                >
                  {c.nombre}
                  <span className="opacity-60"> · {conteoCategorias[c.slug] ?? 0}</span>
                </Opcion>
              ))}
            </div>
          </section>

          {/* Tipo: solo cuando la categoría elegida tiene subcategorías */}
          {tipos.length > 0 && (
            <section aria-labelledby="f-tipo">
              <h2 id="f-tipo" className="mb-3 text-sm font-semibold font-sans">Tipo de {categoria?.nombre.toLowerCase()}</h2>
              <div className="flex flex-wrap gap-2">
                <Opcion activo={!filtros.sub} onClick={() => onChange({ sub: undefined })}>Todos</Opcion>
                {tipos.map((s) => (
                  <Opcion
                    key={s.slug}
                    activo={filtros.sub === s.slug}
                    onClick={() => onChange({ sub: s.slug })}
                  >
                    {s.label}
                    <span className="opacity-60"> · {conteoTipos[s.slug] ?? 0}</span>
                  </Opcion>
                ))}
              </div>
            </section>
          )}

          {/* Ofertas */}
          {(ofertasDisponibles > 0 || filtros.oferta) && (
            <section>
              <button
                type="button"
                role="switch"
                aria-checked={!!filtros.oferta}
                onClick={() => onChange({ oferta: filtros.oferta ? undefined : true })}
                className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-border/60 bg-background px-4 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="font-medium">
                  Solo piezas en oferta
                  <span className="ml-1.5 text-muted-foreground">· {ofertasDisponibles}</span>
                </span>
                <span
                  aria-hidden
                  className={
                    "relative h-6 w-11 shrink-0 rounded-full transition-colors " +
                    (filtros.oferta ? "bg-primary" : "bg-border")
                  }
                >
                  <span
                    className={
                      "absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-all " +
                      (filtros.oferta ? "left-[1.375rem]" : "left-0.5")
                    }
                  />
                </span>
              </button>
            </section>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-border/50 bg-background px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {hayFiltros && (
            <Button type="button" variant="ghost" className="min-h-11 rounded-full" onClick={onLimpiar}>
              Quitar filtros
            </Button>
          )}
          <Button
            type="button"
            className="min-h-11 flex-1 rounded-full"
            onClick={() => onOpenChange(false)}
          >
            {total === 0 ? "Sin resultados" : `Ver ${total} ${total === 1 ? "pieza" : "piezas"}`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
