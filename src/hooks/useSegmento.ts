// src/hooks/useSegmento.ts
// Segmento que el visitante eligió en la portada («¿para qué es?»). Se guarda en el navegador
// (localStorage) para prellenar los formularios de cotización; nunca se envía por sí solo:
// solo viaja al servidor cuando el cliente manda un formulario.
import { useSyncExternalStore } from "react";
import { segmentoValido, type SegmentoId } from "@/lib/segmentos";

const CLAVE = "gm_segmento";
const EVENTO = "gm-segmento-cambio";

export function leerSegmento(): SegmentoId | null {
  try {
    return segmentoValido(localStorage.getItem(CLAVE));
  } catch {
    return memoria;
  }
}

// Respaldo en memoria cuando localStorage no está disponible (modo privado, bloqueado…)
let memoria: SegmentoId | null = null;

export function guardarSegmento(id: SegmentoId | null) {
  memoria = id;
  try {
    if (id) localStorage.setItem(CLAVE, id);
    else localStorage.removeItem(CLAVE);
  } catch {
    /* sin almacenamiento: queda en memoria durante la visita */
  }
  window.dispatchEvent(new Event(EVENTO));
}

function suscribir(cb: () => void) {
  window.addEventListener(EVENTO, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENTO, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useSegmento(): [SegmentoId | null, (id: SegmentoId | null) => void] {
  const segmento = useSyncExternalStore(suscribir, leerSegmento, () => null);
  return [segmento, guardarSegmento];
}
