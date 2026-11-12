// src/components/admin/TarjetaFila.tsx
// Tarjeta apilada para las listas del panel en móvil (< 640 px). Reemplaza a las tablas anchas:
// la tabla se oculta con `hidden sm:table` y las tarjetas con `TarjetasMovil` (`sm:hidden`).
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Alto táctil mínimo (44 px) para los botones dentro de las tarjetas. */
export const BTN_TACTIL = "h-11 min-w-11";

// Campo de mes (<input type="month">): 44 px de alto y ancho completo en móvil; 36 px y ancho cómodo desde sm.
// El control nativo necesita ~12 rem para mostrar «septiembre de 2026» y el ícono del calendario sin recortar.
export const CAMPO_MES = "h-11 w-full min-w-[12rem] sm:h-9 sm:w-52";

/** Contenedor de las tarjetas: solo se ve por debajo de 640 px. */
export function TarjetasMovil({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("space-y-3 p-3 sm:hidden", className)}>{children}</div>;
}

export interface DatoTarjeta {
  etiqueta: string;
  valor: ReactNode;
  /** Resalta el valor (total, stock). */
  destacado?: boolean;
  /** Ocupa las dos columnas (textos largos). */
  completo?: boolean;
}

interface Props {
  titulo: ReactNode;
  subtitulo?: ReactNode;
  /** Insignia de estado, arriba a la derecha. */
  estado?: ReactNode;
  /** Miniatura o icono a la izquierda. */
  imagen?: ReactNode;
  datos?: DatoTarjeta[];
  /** Acción principal y secundarias (botones de 44 px). */
  acciones?: ReactNode;
  /** Mismo color de fondo que usa la fila de la tabla para alertas. */
  tono?: "normal" | "alerta" | "peligro";
}

const TONO = {
  normal: "bg-card",
  alerta: "bg-amber-50/40 border-amber-200",
  peligro: "bg-red-50/50 border-red-200",
} as const;

export function TarjetaFila({ titulo, subtitulo, estado, imagen, datos, acciones, tono = "normal" }: Props) {
  return (
    <div className={cn("rounded-xl border p-3 space-y-3", TONO[tono])}>
      <div className="flex items-start gap-3">
        {imagen && <div className="shrink-0">{imagen}</div>}
        <div className="min-w-0 flex-1">
          <div className="font-medium leading-snug break-words">{titulo}</div>
          {subtitulo && <div className="mt-0.5 text-xs text-muted-foreground break-words">{subtitulo}</div>}
        </div>
        {estado && <div className="shrink-0 max-w-[50%] flex justify-end">{estado}</div>}
      </div>

      {datos && datos.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          {datos.map((d) => (
            <div key={d.etiqueta} className={cn("min-w-0", d.completo && "col-span-2")}>
              <dt className="text-xs text-muted-foreground">{d.etiqueta}</dt>
              <dd className={cn("break-words", d.destacado ? "font-semibold" : "font-medium")}>{d.valor}</dd>
            </div>
          ))}
        </dl>
      )}

      {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
    </div>
  );
}
