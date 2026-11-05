// src/components/product/DeliveryPromise.tsx
// Promesa de entrega con fechas calculadas desde HOY + costo de envío real por distrito.
import { Truck } from "lucide-react";
import { DISTRITOS_ENVIO } from "@/lib/envios";
import { useDistritoEnvio } from "@/hooks/useDistritoEnvio";
import { fmtPEN } from "@/lib/pricing";
import {
  ENTREGA_MIN_DIAS as MIN_DIAS,
  ENTREGA_MAX_DIAS as MAX_DIAS,
  addBusinessDays,
  fmtDia,
} from "@/lib/entrega";
import "./product-experience.css";

export function DeliveryPromise() {
  // Distrito compartido con la tarjeta de producto y el checkout
  const { distrito, envio, desde: envioDesde, setDistrito } = useDistritoEnvio();
  const onChange = setDistrito;

  const hoy = new Date();
  const desde = addBusinessDays(hoy, MIN_DIAS);
  const hasta = addBusinessDays(hoy, MAX_DIAS);

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
        {envio != null
          ? <b style={{ color: "var(--gm-walnut)" }}>{fmtPEN(envio)}</b>
          : <span className="gmx-note">Desde {fmtPEN(envioDesde)}</span>}
      </div>
      <p className="gmx-note" style={{ marginTop: 8 }}>Fechas estimadas para Lima Metropolitana (días hábiles). Provincias: 10–15 días.</p>
    </div>
  );
}