// src/components/product/DeliveryPromise.tsx
// Promesa de entrega con fechas calculadas desde HOY + costo de envío real por distrito.
// D10: también reúne los plazos (Lima y provincias) que antes estaban en el acordeón «Tiempos de entrega».
import { Truck } from "lucide-react";
import { DistritoCombobox } from "@/components/DistritoCombobox";
import { useDistritoEnvio } from "@/hooks/useDistritoEnvio";
import { fmtPEN } from "@/lib/pricing";
import {
  ENTREGA_MIN_DIAS as MIN_DIAS,
  ENTREGA_MAX_DIAS as MAX_DIAS,
  addBusinessDays,
  fmtDia,
  textoPlazoLima,
  textoPlazoProvincias,
} from "@/lib/entrega";
import "./product-experience.css";

export function DeliveryPromise() {
  // Distrito compartido con la tarjeta de producto y el checkout
  const { distrito, envio, desde: envioDesde, setDistrito } = useDistritoEnvio();

  const hoy = new Date();
  const desde = addBusinessDays(hoy, MIN_DIAS);
  const hasta = addBusinessDays(hoy, MAX_DIAS);

  return (
    <div className="gmx-delivery">
      <div className="gmx-delivery-head">
        <Truck size={18} color="var(--gmx-accent)" />
        <span>Si lo pides hoy, llega entre el <b>{fmtDia(desde)}</b> y el <b>{fmtDia(hasta)}</b></span>
      </div>

      {/* D13: 4 pasos con texto de 12 px; lista ordenada para lectores de pantalla */}
      <ol className="gmx-track" aria-label="Etapas de tu pedido">
        <li className="gmx-step done" aria-current="step"><div className="gmx-dot" /><b>Pedido</b>Hoy</li>
        <li className="gmx-step"><div className="gmx-dot" /><b>Fabricación</b>A mano</li>
        <li className="gmx-step"><div className="gmx-dot" /><b>Control</b>Calidad</li>
        <li className="gmx-step"><div className="gmx-dot" /><b>Entrega</b>A domicilio</li>
      </ol>

      <div className="gmx-ship">
        <label htmlFor="gmx-distrito">Calcula tu envío:</label>
        <div className="gmx-ship-select">
          <DistritoCombobox id="gmx-distrito" value={distrito} onChange={setDistrito} placeholder="Elige tu distrito" />
        </div>
        <span aria-live="polite">
          {envio != null
            ? <b style={{ color: "var(--gm-walnut)" }}>{fmtPEN(envio)}</b>
            : <span className="gmx-note">Desde {fmtPEN(envioDesde)}</span>}
        </span>
      </div>
      <p className="gmx-note" style={{ marginTop: 8 }}>
        Lima Metropolitana: {textoPlazoLima()} (fechas estimadas). Provincias: {textoPlazoProvincias()}.
        Fabricamos a pedido; coordinamos la fecha exacta al confirmar tu compra.
      </p>
    </div>
  );
}
