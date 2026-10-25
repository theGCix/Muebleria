// src/components/product/DeliveryPromise.tsx
// Promesa de entrega con fechas calculadas desde HOY + costo de envío real por distrito.
import { useEffect, useState } from "react";
import { Truck } from "lucide-react";
import { DISTRITOS_ENVIO, getPrecioEnvio } from "@/lib/envios";
import { fmtPEN } from "@/lib/pricing";
import "./product-experience.css";

// Plazos de la ficha: Lima Metropolitana 5–7 días hábiles
const MIN_DIAS = 5;
const MAX_DIAS = 7;
const STORE_KEY = "gm_distrito_envio";

function addBusinessDays(from: Date, days: number) {
  const d = new Date(from);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) added++;
  }
  return d;
}
const fmtDia = (d: Date) =>
  new Intl.DateTimeFormat("es-PE", { weekday: "short", day: "numeric", month: "short" }).format(d).replace(".", "");

export function DeliveryPromise() {
  const [distrito, setDistrito] = useState("");

  useEffect(() => {
    try { setDistrito(localStorage.getItem(STORE_KEY) ?? ""); } catch { /* sin storage */ }
  }, []);
  const onChange = (v: string) => {
    setDistrito(v);
    try { localStorage.setItem(STORE_KEY, v); } catch { /* sin storage */ }
  };

  const hoy = new Date();
  const desde = addBusinessDays(hoy, MIN_DIAS);
  const hasta = addBusinessDays(hoy, MAX_DIAS);
  const precio = distrito ? getPrecioEnvio(distrito) : null;

  return (
    <div className="gmx-delivery">
      <div className="gmx-delivery-head">
        <Truck size={18} color="var(--gmx-accent)" />
        <span>Si lo pides hoy, llega entre el <b>{fmtDia(desde)}</b> y el <b>{fmtDia(hasta)}</b></span>
      </div>

      <div className="gmx-track" aria-hidden>
        <div className="gmx-step done"><div className="gmx-dot" /><b>Pedido</b>Hoy</div>
        <div className="gmx-step"><div className="gmx-dot" /><b>Fabricación</b>A mano</div>
        <div className="gmx-step"><div className="gmx-dot" /><b>Control</b>Calidad</div>
        <div className="gmx-step"><div className="gmx-dot" /><b>Entrega</b>A domicilio</div>
      </div>

      <div className="gmx-ship">
        <label htmlFor="gmx-distrito">Calcula tu envío:</label>
        <select id="gmx-distrito" value={distrito} onChange={(e) => onChange(e.target.value)}>
          <option value="">Elige tu distrito</option>
          {DISTRITOS_ENVIO.map((d) => <option key={d.destino} value={d.destino}>{d.destino}</option>)}
        </select>
        {precio != null && <b style={{ color: "var(--gm-walnut)" }}>{fmtPEN(precio)}</b>}
      </div>
      <p className="gmx-note" style={{ marginTop: 8 }}>Fechas estimadas para Lima Metropolitana (días hábiles). Provincias: 10–15 días.</p>
    </div>
  );
}
