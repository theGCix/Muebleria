// src/components/product/LivePrice.tsx
// Precio con ancla de ahorro, cuotas, reloj de oferta REAL (usa oferta_vence_el) y escasez REAL (stock).
import { useCountdown } from "@/hooks/useCountdown";
import { fmtPEN } from "@/lib/pricing";
import "./product-experience.css";

const CATORCE_DIAS = 14 * 24 * 60 * 60 * 1000;
const CUOTAS = 6; // la ficha ya promete "3 o 6 cuotas sin intereses"
const pad = (n: number) => String(n).padStart(2, "0");

interface Props {
  precioOriginal: number;
  precioFinal: number;
  enOferta: boolean;
  descuento: number | null;
  venceEl: Date | null;
  stock: number | null;
  agotado: boolean;
}

export function LivePrice({ precioOriginal, precioFinal, enOferta, descuento, venceEl, stock, agotado }: Props) {
  const restante = useCountdown(enOferta && venceEl ? venceEl.getTime() : null);
  // Solo mostramos el reloj cuando la oferta realmente está cerca de terminar
  const mostrarReloj = !!restante && !restante.terminada && restante.ms <= CATORCE_DIAS;
  const pocasUnidades = stock != null && stock > 0 && stock <= 5;

  return (
    <div className="gmx-price-card">
      <div className="gmx-price-row">
        <span className="gmx-price-main">{fmtPEN(precioFinal)}</span>
        {enOferta && (
          <>
            <span className="gmx-price-old">{fmtPEN(precioOriginal)}</span>
            <span className="gmx-save-chip">Ahorras {fmtPEN(precioOriginal - precioFinal)}{descuento ? ` (-${descuento}%)` : ""}</span>
          </>
        )}
        {agotado && (
          <span style={{ fontSize: 13, background: "#fde8e8", color: "#b91c1c", padding: "3px 10px", borderRadius: 20 }}>Agotado</span>
        )}
      </div>

      <p className="gmx-cuotas">
        o <strong>{CUOTAS} cuotas de {fmtPEN(precioFinal / CUOTAS)}</strong> sin intereses
      </p>
      <p className="gmx-note">Precio incluye IGV · Entrega a domicilio disponible</p>

      {mostrarReloj && restante && (
        <div className="gmx-clock" role="timer" aria-label="Tiempo restante de la oferta">
          <span className="gmx-clock-label">La oferta termina en</span>
          <div className="gmx-clock-boxes">
            {([["d", "días"], ["h", "hrs"], ["m", "min"], ["s", "seg"]] as const).map(([k, l]) => (
              <div key={k} className="gmx-clock-box"><b>{pad(restante[k])}</b><span>{l}</span></div>
            ))}
          </div>
        </div>
      )}

      {pocasUnidades && !agotado && (
        <div className="gmx-stock"><span className="gmx-pulse" />Quedan {stock} unidad{stock === 1 ? "" : "es"} listas</div>
      )}
    </div>
  );
}
