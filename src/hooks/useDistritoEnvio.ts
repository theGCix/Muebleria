// src/hooks/useDistritoEnvio.ts
// ÚNICA fuente del distrito de envío del cliente en el navegador: la ficha, la tarjeta de producto y el
// checkout leen y escriben aquí. Solo guarda distritos que existen en el tarifario (src/lib/envios.ts).
import { useCallback, useEffect, useState } from "react";
import { DISTRITO_EVENT, guardarDistrito, leerDistritoGuardado } from "@/lib/entrega";
import { distritoDeTarifa, getPrecioEnvio, precioEnvioDesde } from "@/lib/envios";

export function useDistritoEnvio() {
  // Se lee en un efecto (no al renderizar) para no desajustar la hidratación
  const [distrito, setLocal] = useState("");

  useEffect(() => {
    const leer = () => setLocal(distritoDeTarifa(leerDistritoGuardado()));
    leer();
    window.addEventListener(DISTRITO_EVENT, leer);
    window.addEventListener("storage", leer);
    return () => {
      window.removeEventListener(DISTRITO_EVENT, leer);
      window.removeEventListener("storage", leer);
    };
  }, []);

  const setDistrito = useCallback((v: string) => guardarDistrito(distritoDeTarifa(v)), []);

  return {
    /** Distrito del tarifario, o "" si el cliente aún no eligió (nunca se asume uno). */
    distrito,
    /** Tarifa del distrito elegido; null si no hay distrito. */
    envio: distrito ? getPrecioEnvio(distrito) : null,
    /** Tarifa más baja del tarifario, para "Envío desde S/ X". */
    desde: precioEnvioDesde(),
    setDistrito,
  };
}