// src/components/catalogo/BarraFiltros.tsx
// Barra de /catalogo: botón «Filtros · n», orden y etiquetas de filtros activos con ✕.
// No es fija (el header ya es sticky y su alto cambia al ocultar la barra superior); en PC muestra los chips de categoría.
import { SlidersHorizontal, X } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CATEGORIAS } from "@/lib/categories";
import { etiquetaRango } from "@/lib/presupuesto";
import type { FiltrosCatalogo, OrdenCatalogo } from "@/lib/filtrosCatalogo";

interface Props {
  filtros: FiltrosCatalogo;
  cantidadFiltros: number;
  orden: OrdenCatalogo;
  onAbrirPanel: () => void;
  onChange: (patch: Partial<FiltrosCatalogo>) => void;
  onOrden: (o: OrdenCatalogo) => void;
  conteoCategorias: Record<string, number>;
  totalCategorias: number;
}

function Etiqueta({ texto, onQuitar }: { texto: string; onQuitar: () => void }) {
  return (
    <button
      type="button"
      onClick={onQuitar}
      aria-label={`Quitar filtro: ${texto}`}
      className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-secondary px-3.5 text-sm text-secondary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {texto}
      <X className="h-3.5 w-3.5" aria-hidden />
    </button>
  );
}

export function BarraFiltros({
  filtros, cantidadFiltros, orden, onAbrirPanel, onChange, onOrden, conteoCategorias, totalCategorias,
}: Props) {
  const categoria = CATEGORIAS.find((c) => c.slug === filtros.cat);
  const tipo = categoria?.subcategorias.find((s) => s.slug === filtros.sub);
  const hayPrecio = filtros.min != null || filtros.max != null;

  return (
    <div className="mb-6 space-y-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onAbrirPanel}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border/60 bg-background px-4 text-sm font-medium hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          Filtros{cantidadFiltros > 0 && <span> · {cantidadFiltros}</span>}
        </button>

        {/* PC: categorías visibles en una fila; en móvil están dentro del panel */}
        <div className="hidden flex-1 flex-wrap items-center gap-2 md:flex" role="group" aria-label="Categoría">
          <ChipCat activo={!filtros.cat} onClick={() => onChange({ cat: undefined, sub: undefined })}>
            Todas · {totalCategorias}
          </ChipCat>
          {CATEGORIAS.map((c) => (
            <ChipCat key={c.slug} activo={filtros.cat === c.slug} onClick={() => onChange({ cat: c.slug, sub: undefined })}>
              {c.nombre} · {conteoCategorias[c.slug] ?? 0}
            </ChipCat>
          ))}
        </div>

        <div className="ml-auto">
          <Select value={orden} onValueChange={(v) => onOrden(v as OrdenCatalogo)}>
            <SelectTrigger className="min-h-11 w-[9.5rem] sm:w-[200px]" aria-label="Ordenar por">
              <SelectValue placeholder="Ordenar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recientes">Más recientes</SelectItem>
              <SelectItem value="precio_asc">Precio: menor a mayor</SelectItem>
              <SelectItem value="precio_desc">Precio: mayor a menor</SelectItem>
              <SelectItem value="descuento">Mayor descuento</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {cantidadFiltros > 0 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0" aria-label="Filtros activos">
          {categoria && (
            <Etiqueta texto={categoria.nombre} onQuitar={() => onChange({ cat: undefined, sub: undefined })} />
          )}
          {tipo && <Etiqueta texto={tipo.label} onQuitar={() => onChange({ sub: undefined })} />}
          {hayPrecio && (
            <Etiqueta
              texto={etiquetaRango({ min: filtros.min, max: filtros.max })}
              onQuitar={() => onChange({ min: undefined, max: undefined })}
            />
          )}
          {filtros.oferta && <Etiqueta texto="Solo ofertas" onQuitar={() => onChange({ oferta: undefined })} />}
        </div>
      )}
    </div>
  );
}

function ChipCat({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
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
