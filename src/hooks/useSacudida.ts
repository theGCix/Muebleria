// src/hooks/useSacudida.ts
// Las etiquetas colgantes del hero (.etiqueta) se balancean cuando mueves o agitas el celular.
//
// Cómo funciona:
//  - Escucha `devicemotion` (acelerómetro). Usa la aceleración lateral de la pantalla.
//  - Cada etiqueta es un péndulo amortiguado con su propio largo de cuerda (--cuerda), así que
//    no se mueven al unísono. El movimiento se aplica con la propiedad CSS `rotate`, que se
//    suma a la animación `transform` existente sin pisarla.
//  - El bucle de animación solo corre mientras haya movimiento y el riel esté a la vista.
//  - Android/Chrome: funciona directo (requiere HTTPS). iPhone/Safari: pide un toque del
//    usuario para dar permiso (`necesitaPermiso` + `activar`).
//  - Respeta prefers-reduced-motion.
import { useCallback, useEffect, useState, type RefObject } from "react";

type DeviceMotionConPermiso = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};
type Estado = "no-requerido" | "pendiente" | "concedido" | "denegado";

const LIMITE_GRADOS = 28; // inclinación máxima de una etiqueta
const ZONA_MUERTA = 0.9; // m/s²: ignora el temblor normal de la mano
const FUERZA = 38; // °/s² por cada m/s² de aceleración lateral
const AMORTIGUACION = 0.14; // 0 = no se detiene nunca, 1 = se frena al instante
const MAX_ACEL = 25; // m/s²: recorte de sacudidas muy fuertes

interface Pendulo {
  el: HTMLElement;
  w0: number; // frecuencia natural (rad/s): cuerda más larga = más lento
  k: number; // pequeña variación para que no se muevan idénticas
  theta: number; // ángulo (grados)
  omega: number; // velocidad angular (grados/s)
}

/** Aceleración lateral respecto a la pantalla, aunque el celular esté en horizontal. */
function lateral(x: number, y: number): number {
  const raw =
    window.screen?.orientation?.angle ??
    (window as unknown as { orientation?: number }).orientation ??
    0;
  const ang = ((raw % 360) + 360) % 360;
  if (ang === 90) return y;
  if (ang === 180) return -x;
  if (ang === 270) return -y;
  return x;
}

export function useSacudida(railRef: RefObject<HTMLElement | null>) {
  const [estado, setEstado] = useState<Estado>("no-requerido");

  // iPhone: hay que pedir permiso con un toque (solo en pantallas táctiles)
  useEffect(() => {
    if (typeof window === "undefined" || !("DeviceMotionEvent" in window)) return;
    const pide =
      typeof (window.DeviceMotionEvent as DeviceMotionConPermiso).requestPermission === "function";
    const tactil = window.matchMedia("(pointer: coarse)").matches;
    if (pide && tactil) setEstado("pendiente");
  }, []);

  const activar = useCallback(async () => {
    try {
      const r = await (window.DeviceMotionEvent as DeviceMotionConPermiso).requestPermission?.();
      setEstado(r === "granted" ? "concedido" : "denegado");
    } catch {
      setEstado("denegado");
    }
  }, []);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail || typeof window === "undefined" || !("DeviceMotionEvent" in window)) return;
    if (estado !== "no-requerido" && estado !== "concedido") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let peds: Pendulo[] = [];
    let ax = 0;
    let ultimoEvento = 0;
    let raf = 0;
    let t0 = 0;
    let visible = true;
    const g = { x: 0, y: 0 }; // gravedad estimada, solo si el equipo no entrega `acceleration`

    const preparar = () => {
      peds = Array.from(rail.querySelectorAll<HTMLElement>(".etiqueta")).map((el, i) => {
        const cuerda = parseFloat(getComputedStyle(el).getPropertyValue("--cuerda")) || 40;
        return {
          el,
          w0: 7.5 * (150 / (cuerda + 110)),
          k: 1 + 0.12 * ((i % 3) - 1),
          theta: 0,
          omega: 0,
        };
      });
    };

    const limpiar = () => {
      for (const p of peds) {
        p.theta = 0;
        p.omega = 0;
        p.el.style.rotate = "";
      }
    };

    const paso = (t: number) => {
      const dt = Math.min((t - t0) / 1000, 1 / 30) || 1 / 60;
      t0 = t;
      if (performance.now() - ultimoEvento > 120) ax = 0; // si dejó de moverse, se suelta la fuerza
      const a = Math.abs(ax) < ZONA_MUERTA ? 0 : ax;
      let quieto = a === 0;

      for (const p of peds) {
        const acc = -p.w0 * p.w0 * p.theta - 2 * AMORTIGUACION * p.w0 * p.omega - FUERZA * p.k * a;
        p.omega += acc * dt;
        p.theta += p.omega * dt;
        if (Math.abs(p.theta) > LIMITE_GRADOS) {
          p.theta = Math.sign(p.theta) * LIMITE_GRADOS;
          p.omega *= -0.3; // rebote suave contra el tope
        }
        p.el.style.rotate = `${p.theta.toFixed(2)}deg`;
        if (Math.abs(p.theta) > 0.05 || Math.abs(p.omega) > 0.5) quieto = false;
      }

      if (quieto) {
        limpiar();
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(paso);
    };

    const onMotion = (e: DeviceMotionEvent) => {
      if (!visible) return;
      let x = e.acceleration?.x;
      let y = e.acceleration?.y;
      if (x == null || y == null) {
        // Sin aceleración "limpia": se le quita la gravedad con un filtro pasa-bajos
        const a = e.accelerationIncludingGravity;
        if (!a || a.x == null || a.y == null) return;
        g.x = 0.8 * g.x + 0.2 * a.x;
        g.y = 0.8 * g.y + 0.2 * a.y;
        x = a.x - g.x;
        y = a.y - g.y;
      }
      ax = Math.max(-MAX_ACEL, Math.min(MAX_ACEL, lateral(x, y)));
      ultimoEvento = performance.now();
      if (!raf && Math.abs(ax) >= ZONA_MUERTA) {
        preparar();
        t0 = performance.now();
        raf = requestAnimationFrame(paso);
      }
    };

    // Solo reacciona mientras el riel se ve en pantalla
    const io = new IntersectionObserver(([en]) => {
      visible = en.isIntersecting;
      if (!visible && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
        limpiar();
      }
    });
    io.observe(rail);
    window.addEventListener("devicemotion", onMotion);

    return () => {
      window.removeEventListener("devicemotion", onMotion);
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
      limpiar();
    };
  }, [railRef, estado]);

  return { necesitaPermiso: estado === "pendiente", activar };
}