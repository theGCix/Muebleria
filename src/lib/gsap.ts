// src/lib/gsap.ts
// Punto único de registro de GSAP. Importa siempre desde aquí, nunca de "gsap" directo,
// así los plugins se registran una sola vez.
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP);
  // Los móviles cambian de alto al mostrar/ocultar la barra del navegador:
  // no recalcular posiciones por eso (evita saltos).
  ScrollTrigger.config({ ignoreMobileResize: true });
}

export { gsap, ScrollTrigger, SplitText, useGSAP };

/** Condiciones de matchMedia usadas en toda la web */
export const MQ = {
  /** Movimiento permitido (respeta "reducir movimiento" del sistema) */
  ok: "(prefers-reduced-motion: no-preference)",
  /** Escritorio con alto suficiente para una sección fijada (pin) completa */
  pin: "(min-width: 1024px) and (min-height: 760px) and (prefers-reduced-motion: no-preference)",
} as const;
