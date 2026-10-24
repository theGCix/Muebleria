// src/hooks/useExitIntent.ts
// Detecta la intención de abandonar la página.
//  - Escritorio: el mouse sale por el borde superior (hacia pestañas / botón de cerrar).
//  - Móvil/tablet: scroll hacia arriba rápido tras haber bajado (gesto típico antes de
//    tocar la barra del navegador o volver atrás).
// Nunca dispara antes de `minTimeMs` en la página, y dispara una sola vez por montaje.
import { useEffect, useRef } from "react";

interface Opciones {
  enabled: boolean;
  minTimeMs?: number;
}

export function useExitIntent(onIntent: () => void, { enabled, minTimeMs = 10_000 }: Opciones) {
  const cb = useRef(onIntent);
  cb.current = onIntent;

  useEffect(() => {
    if (!enabled) return;
    const inicio = Date.now();
    let disparado = false;

    const disparar = () => {
      if (disparado || Date.now() - inicio < minTimeMs) return;
      disparado = true;
      cb.current();
    };

    // Escritorio
    const onMouseOut = (e: MouseEvent) => {
      if (e.clientY <= 0 && !e.relatedTarget) disparar();
    };

    // Móvil: velocidad de scroll hacia arriba
    let lastY = window.scrollY;
    let lastT = performance.now();
    let maxY = lastY;
    const onScroll = () => {
      const y = window.scrollY;
      const t = performance.now();
      maxY = Math.max(maxY, y);
      const dt = Math.max(1, t - lastT);
      const subida = lastY - y; // px hacia arriba desde el último evento
      const lejos = maxY - y > 600; // ya había bajado bastante
      if (subida > 0 && subida / dt > 1.2 && lejos) disparar();
      lastY = y;
      lastT = t;
    };

    const tactil = window.matchMedia("(pointer: coarse)").matches;
    document.addEventListener("mouseout", onMouseOut);
    if (tactil) window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("mouseout", onMouseOut);
      window.removeEventListener("scroll", onScroll);
    };
  }, [enabled, minTimeMs]);
}
