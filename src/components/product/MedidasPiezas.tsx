// src/components/product/MedidasPiezas.tsx
// D7: tabla de medidas por pieza (alto, ancho, fondo, plazas) y esquema, dentro de la pestaña Especificaciones.
// Solo se dibujan las columnas que alguna pieza trae; si no hay ningún dato, no se muestra nada.
import { formatoCm, tieneMedidas, type Pieza } from "@/lib/piezas";

interface Props {
  piezas: Pieza[];
  esquemaUrl: string | null;
  producto: string;
}

const th: React.CSSProperties = {
  padding: "10px 14px 10px 0",
  fontSize: 12,
  fontWeight: 500,
  textAlign: "left",
  color: "var(--gm-muted)",
  whiteSpace: "nowrap",
};
const td: React.CSSProperties = {
  padding: "10px 14px 10px 0",
  fontSize: 13,
  fontWeight: 500,
  color: "var(--gm-dark)",
  verticalAlign: "top",
  whiteSpace: "nowrap",
};

export function MedidasPiezas({ piezas, esquemaUrl, producto }: Props) {
  const hayTabla = tieneMedidas(piezas);
  if (!hayTabla && !esquemaUrl) return null;

  const cols = [
    { k: "alto_cm", t: "Alto", on: piezas.some((p) => p.alto_cm !== null), v: (p: Pieza) => formatoCm(p.alto_cm) },
    { k: "ancho_cm", t: "Ancho", on: piezas.some((p) => p.ancho_cm !== null), v: (p: Pieza) => formatoCm(p.ancho_cm) },
    { k: "fondo_cm", t: "Fondo", on: piezas.some((p) => p.fondo_cm !== null), v: (p: Pieza) => formatoCm(p.fondo_cm) },
    { k: "plazas", t: "Plazas", on: piezas.some((p) => p.plazas !== null), v: (p: Pieza) => (p.plazas === null ? "—" : String(p.plazas)) },
  ].filter((c) => c.on);

  return (
    <div style={{ gridColumn: "1 / -1" }}>
      <h3 className="gm-section-h3">Medidas</h3>
      {hayTabla && (
        <div style={{ overflowX: "auto" }}>
          <table className="gm-detail-table">
            <thead>
              <tr>
                <th scope="col" style={th}>{piezas.length > 1 ? "Pieza" : "Medidas"}</th>
                {cols.map((c) => (
                  <th key={c.k} scope="col" style={th}>{c.t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {piezas.map((p, i) => (
                <tr key={`${p.nombre}-${i}`}>
                  <td style={{ ...td, whiteSpace: "normal" }}>{p.nombre}</td>
                  {cols.map((c) => (
                    <td key={c.k} style={td}>{c.v(p)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {esquemaUrl && (
        <figure style={{ margin: hayTabla ? "20px 0 0" : 0 }}>
          <img
            src={esquemaUrl}
            alt={`Esquema con las medidas de ${producto}`}
            loading="lazy"
            decoding="async"
            style={{ display: "block", maxWidth: "100%", height: "auto", borderRadius: 8 }}
          />
        </figure>
      )}
    </div>
  );
}
