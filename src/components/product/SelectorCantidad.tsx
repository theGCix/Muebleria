// src/components/product/SelectorCantidad.tsx
// Selector de cantidad de la ficha (− / número / +). Botones táctiles de 44 px.
import { Minus, Plus } from "lucide-react";
import "./product-experience.css";

export const CANTIDAD_MAX = 99;

interface Props {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
  max?: number;
}

export function SelectorCantidad({ value, onChange, disabled = false, max = CANTIDAD_MAX }: Props) {
  const poner = (n: number) => onChange(Math.min(max, Math.max(1, Math.round(n) || 1)));
  return (
    <div className="gmx-cant">
      <span className="gmx-cant-label" id="gmx-cant-label">Cantidad:</span>
      <div className="gmx-cant-ctl" role="group" aria-labelledby="gmx-cant-label">
        <button
          type="button"
          className="gmx-cant-btn"
          aria-label="Disminuir cantidad"
          disabled={disabled || value <= 1}
          onClick={() => poner(value - 1)}
        >
          <Minus size={16} aria-hidden />
        </button>
        <span className="gmx-cant-num" role="status" aria-live="polite">{value}</span>
        <button
          type="button"
          className="gmx-cant-btn"
          aria-label="Aumentar cantidad"
          disabled={disabled || value >= max}
          onClick={() => poner(value + 1)}
        >
          <Plus size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
}
