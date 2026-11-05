// src/components/product/OpcionesProducto.tsx
// Selector de opciones del producto leídas de la BD (color, tapizado, firmeza, patas).
// Muestra el ajuste de precio de cada valor; el total lo calcula la ficha (y el servidor al cobrar).
import { fmtPEN } from "@/lib/pricing";
import { valorElegido, type OpcionGrupo, type OpcionValor, type SeleccionOpciones } from "@/hooks/useOpcionesProducto";
import "./product-experience.css";

interface Props {
  grupos: OpcionGrupo[];
  seleccion: SeleccionOpciones;
  onElegir: (grupo: OpcionGrupo, valor: OpcionValor) => void;
}

const ajusteTxt = (n: number) => (n > 0 ? `+${fmtPEN(n)}` : n < 0 ? `−${fmtPEN(-n)}` : "");

export function OpcionesProducto({ grupos, seleccion, onElegir }: Props) {
  return (
    <div>
      {grupos.map((g) => {
        const actual = valorElegido(g, seleccion);
        const usaSwatch = g.tipo === "color" && g.valores.every((v) => !!v.hex);
        // Un solo valor = nada que elegir: se muestra como texto, sin selector
        if (g.valores.length === 1 && actual) {
          return (
            <div key={g.id} style={{ marginBottom: 14 }}>
              <div className="gm-color-label">
                {g.etiqueta}: <span style={{ color: "var(--gm-dark)", fontWeight: 500 }}>{actual.valor}</span>
                {actual.ajuste_precio !== 0 && (
                  <span style={{ color: "var(--gm-mid)", fontWeight: 400 }}> ({ajusteTxt(actual.ajuste_precio)})</span>
                )}
              </div>
              {(actual.descripcion || actual.material) && (
                <p style={{ fontSize: 12, color: "var(--gm-mid)", margin: "4px 0 0", lineHeight: 1.5 }}>
                  {actual.descripcion ?? actual.material}
                </p>
              )}
            </div>
          );
        }
        return (
          <div key={g.id} style={{ marginBottom: 14 }}>
            <div className="gm-color-label">
              {g.etiqueta}
              {actual && (
                <>
                  {" — "}
                  <span style={{ color: "var(--gm-dark)", fontWeight: 500 }}>{actual.valor}</span>
                  {actual.ajuste_precio !== 0 && (
                    <span style={{ color: "var(--gm-mid)", fontWeight: 400 }}> ({ajusteTxt(actual.ajuste_precio)})</span>
                  )}
                </>
              )}
            </div>

            {usaSwatch ? (
              <div className="gm-color-row" role="radiogroup" aria-label={g.etiqueta}>
                {g.valores.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    role="radio"
                    aria-checked={actual?.id === v.id}
                    aria-label={v.ajuste_precio ? `${v.valor} (${ajusteTxt(v.ajuste_precio)})` : v.valor}
                    className="gmx-swatch"
                    style={{ background: v.hex ?? "#ccc" }}
                    title={v.ajuste_precio ? `${v.valor} · ${ajusteTxt(v.ajuste_precio)}` : v.valor}
                    onClick={() => onElegir(g, v)}
                  />
                ))}
              </div>
            ) : (
              <div className="gmx-chips" role="radiogroup" aria-label={g.etiqueta}>
                {g.valores.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    role="radio"
                    aria-checked={actual?.id === v.id}
                    aria-pressed={actual?.id === v.id}
                    className="gmx-chip"
                    onClick={() => onElegir(g, v)}
                  >
                    {v.hex && (
                      <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: v.hex, marginRight: 8, border: "1px solid rgba(0,0,0,.2)" }} />
                    )}
                    {v.valor}
                    {v.ajuste_precio !== 0 && <span style={{ opacity: 0.75, marginLeft: 6 }}>{ajusteTxt(v.ajuste_precio)}</span>}
                  </button>
                ))}
              </div>
            )}

            {(actual?.descripcion || actual?.material) && (
              <p style={{ fontSize: 12, color: "var(--gm-mid)", margin: "4px 0 0", lineHeight: 1.5 }}>
                {actual.descripcion ?? actual.material}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}