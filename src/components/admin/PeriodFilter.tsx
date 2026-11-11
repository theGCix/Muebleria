// src/components/admin/PeriodFilter.tsx
// Filtro de periodo reutilizable para todas las ventanas del panel admin.
//   Día:    Hoy, Ayer y los días anteriores
//   Semana: Esta semana, Semana pasada y las semanas anteriores (lunes a domingo)
//   Mes:    Este mes, Mes pasado y los meses anteriores
//   Borrar: botón pequeño que quita el filtro para ver todo el historial
import { useMemo, useState, useSyncExternalStore } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ahoraLima, calcularRango, etiquetaCompleta, LIMITES_POR_DEFECTO, textoViendo,
  type Granularidad, type PeriodoValor,
} from "@/lib/periodo";

export type { Granularidad, PeriodoValor } from "@/lib/periodo";

// ── Período compartido entre pantallas ───────────────────────
// Dashboard, Analytics y Central KPIs comparten UN solo período de análisis (se recuerda durante
// la sesión del navegador). El resto de ventanas sigue con su filtro propio.
interface Almacen { valor: PeriodoValor; oyentes: Set<() => void> }
const almacenes = new Map<string, Almacen>();

function leerGuardado(clave: string): PeriodoValor | null {
  try {
    const t = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(`periodo:${clave}`) : null;
    const v = t ? JSON.parse(t) : null;
    const ok = v && ["dia", "semana", "mes", "todo"].includes(v.granularidad) && Number.isInteger(v.offset) && v.offset >= 0;
    return ok ? { granularidad: v.granularidad, offset: v.offset } : null;
  } catch { return null; }
}

function almacen(clave: string, inicial: PeriodoValor): Almacen {
  let a = almacenes.get(clave);
  if (!a) { a = { valor: leerGuardado(clave) ?? inicial, oyentes: new Set() }; almacenes.set(clave, a); }
  return a;
}

const SIN_ALMACEN = { subscribe: () => () => {}, get: (): PeriodoValor | null => null };

export interface OpcionesPeriodo {
  /** Clave de período compartido: todas las pantallas con la misma clave muestran el mismo período. */
  compartido?: string;
  /** Calcula el rango con el reloj de Lima. Por defecto, solo si es compartido. */
  zonaLima?: boolean;
}

/** Estado del filtro + el rango ya calculado (para consultas y para filtrar listas). */
export function usePeriodo(inicial: PeriodoValor = { granularidad: "dia", offset: 0 }, opciones: OpcionesPeriodo = {}) {
  const { compartido, zonaLima = !!compartido } = opciones;
  const [local, setLocal] = useState<PeriodoValor>(inicial);
  const a = compartido ? almacen(compartido, inicial) : null;
  const fuente = a
    ? { subscribe: (cb: () => void) => { a.oyentes.add(cb); return () => { a.oyentes.delete(cb); }; }, get: () => a.valor }
    : SIN_ALMACEN;
  const compartidoValor = useSyncExternalStore(fuente.subscribe, fuente.get, fuente.get);
  const valor = compartidoValor ?? local;

  const setValor = (v: PeriodoValor) => {
    if (a && compartido) {
      a.valor = v;
      try { sessionStorage.setItem(`periodo:${compartido}`, JSON.stringify(v)); } catch { /* sin almacenamiento */ }
      a.oyentes.forEach((cb) => cb());
    } else {
      setLocal(v);
    }
  };

  const rango = useMemo(
    () => calcularRango(valor, zonaLima ? ahoraLima() : new Date()),
    [valor, zonaLima],
  );
  return { valor, setValor, rango };
}

interface Props {
  valor: PeriodoValor;
  onChange: (v: PeriodoValor) => void;
  /** Muestra además un botón "Todo" junto a Día/Semana/Mes. Por defecto no: se usa "Borrar". */
  todo?: boolean;
  /** Botón pequeño "Borrar" para quitar el filtro y ver todo el historial. Por defecto sí. */
  borrar?: boolean;
  /** Línea "Viendo: del … al …" debajo del filtro. Por defecto sí. */
  viendo?: boolean;
  /** Cuántos periodos hacia atrás se listan en cada modo. */
  maxDias?: number;
  maxSemanas?: number;
  maxMeses?: number;
  className?: string;
}

export function PeriodFilter({
  valor, onChange, todo = false, borrar = true, viendo = true,
  maxDias = LIMITES_POR_DEFECTO.dia,
  maxSemanas = LIMITES_POR_DEFECTO.semana,
  maxMeses = LIMITES_POR_DEFECTO.mes,
  className = "",
}: Props) {
  const ahora = new Date();
  const { granularidad: g, offset } = valor;
  const limite = g === "dia" ? maxDias : g === "semana" ? maxSemanas : maxMeses;
  const actual = Math.min(offset, Math.max(limite - 1, 0));

  const opciones = useMemo(
    () =>
      g === "todo"
        ? []
        : Array.from({ length: limite }, (_, n) => ({
            n,
            texto: etiquetaCompleta({ granularidad: g, offset: n }, ahora),
          })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [g, limite, ahora.toDateString()],
  );

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <ToggleGroup
        type="single"
        variant="outline"
        value={g}
        onValueChange={(v) => v && onChange({ granularidad: v as Granularidad, offset: 0 })}
      >
        <ToggleGroupItem value="dia">Día</ToggleGroupItem>
        <ToggleGroupItem value="semana">Semana</ToggleGroupItem>
        <ToggleGroupItem value="mes">Mes</ToggleGroupItem>
        {todo && <ToggleGroupItem value="todo">Todo</ToggleGroupItem>}
      </ToggleGroup>

      {g !== "todo" && (
        <div className="flex items-center gap-1">
          <Button
            variant="outline" size="icon" className="h-9 w-9"
            aria-label="Periodo anterior"
            disabled={actual >= limite - 1}
            onClick={() => onChange({ granularidad: g, offset: actual + 1 })}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Select
            value={String(actual)}
            onValueChange={(v) => onChange({ granularidad: g, offset: Number(v) })}
          >
            <SelectTrigger className="w-[260px]"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-72">
              {opciones.map((o) => (
                <SelectItem key={o.n} value={String(o.n)}>{o.texto}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline" size="icon" className="h-9 w-9"
            aria-label="Periodo siguiente"
            disabled={actual === 0}
            onClick={() => onChange({ granularidad: g, offset: actual - 1 })}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {borrar && g !== "todo" && (
        <Button
          variant="ghost" size="sm" className="h-9 px-2 text-muted-foreground"
          title="Quitar el filtro y ver todo el historial"
          onClick={() => onChange({ granularidad: "todo", offset: 0 })}
        >
          <X className="mr-1 h-3.5 w-3.5" /> Borrar
        </Button>
      )}

      {viendo && (
        <p className="basis-full text-xs text-muted-foreground">{textoViendo(valor, ahora)}</p>
      )}
    </div>
  );
}