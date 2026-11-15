// src/hooks/useInclinacion.ts
// Estado compartido para las piezas colgantes del tendedero de la portada (TendederoPiezas).
//  · `inclinacion.objetivo`: ángulo (°) hacia el que tiende lo que cuelga según la inclinación del celular.
//  · `inclinacion.golpe`: empujón (sacudida del celular o toque). `n` cambia en cada golpe; `fuerza` es °/s.
// Un solo par de escuchas (deviceorientation / devicemotion) sirve a todas las cuerdas: se cuentan los usos y se
// quitan al desmontar la última. Android/Chrome funciona directo (HTTPS); iPhone/Safari pide permiso con un toque
// (`alTocar`). Respeta «reducir movimiento» (no escucha nada).
import { useEffect, type PointerEvent } from "react";
import { anguloInclinacion } from "@/lib/tendedero";

type ConPermiso = { requestPermission?: () => Promise<"granted" | "denied"> };

export const inclinacion = {
  objetivo: 0,
  golpe: { n: 0, fuerza: 0 },
};

const MAX_FUERZA = 140; // °/s: recorte de empujones y sacudidas fuertes
const ZONA_MUERTA = 1.2; // m/s²: ignora el temblor normal de la mano
const ENTRE_GOLPES_MS = 90;

let usos = 0;
let quitar: (() => void) | null = null;
let ultimoGolpe = 0;
let permisoPedido = false;

const reducirMovimiento = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const anguloPantalla = () =>
  window.screen?.orientation?.angle ?? (window as unknown as { orientation?: number }).orientation ?? 0;

function golpear(fuerza: number) {
  const ahora = performance.now();
  if (ahora - ultimoGolpe < ENTRE_GOLPES_MS) return;
  ultimoGolpe = ahora;
  inclinacion.golpe.fuerza = Math.max(-MAX_FUERZA, Math.min(MAX_FUERZA, fuerza));
  inclinacion.golpe.n += 1;
}

/** Aceleración lateral respecto a la pantalla (igual que useSacudida): en vertical es `x`. */
function lateral(x: number, y: number): number {
  const ang = ((anguloPantalla() % 360) + 360) % 360;
  if (ang === 90) return y;
  if (ang === 180) return -x;
  if (ang === 270) return -y;
  return x;
}

function escuchar() {
  const g = { x: 0, y: 0 }; // gravedad estimada, solo si el equipo no entrega `acceleration`

  const onOrientacion = (e: DeviceOrientationEvent) => {
    inclinacion.objetivo = anguloInclinacion(e.gamma, anguloPantalla());
  };

  const onMovimiento = (e: DeviceMotionEvent) => {
    let x = e.acceleration?.x;
    let y = e.acceleration?.y;
    if (x == null || y == null) {
      const a = e.accelerationIncludingGravity;
      if (!a || a.x == null || a.y == null) return;
      g.x = 0.8 * g.x + 0.2 * a.x;
      g.y = 0.8 * g.y + 0.2 * a.y;
      x = a.x - g.x;
      y = a.y - g.y;
    }
    const a = lateral(x, y);
    if (Math.abs(a) < ZONA_MUERTA) return;
    golpear(-a * 6); // el empujón va hacia el lado contrario a la aceleración
  };

  window.addEventListener("deviceorientation", onOrientacion);
  window.addEventListener("devicemotion", onMovimiento);
  return () => {
    window.removeEventListener("deviceorientation", onOrientacion);
    window.removeEventListener("devicemotion", onMovimiento);
    inclinacion.objetivo = 0;
  };
}

/** Activa las escuchas mientras haya al menos una cuerda montada. */
export function useInclinacion() {
  useEffect(() => {
    if (typeof window === "undefined" || reducirMovimiento()) return;
    if (!("DeviceOrientationEvent" in window) && !("DeviceMotionEvent" in window)) return;
    // iPhone: sin permiso concedido los eventos no llegan; escuchar no cuesta nada y empiezan al conceder.
    usos += 1;
    if (usos === 1) quitar = escuchar();
    return () => {
      usos -= 1;
      if (usos === 0) {
        quitar?.();
        quitar = null;
      }
    };
  }, []);
}

/** Empuja la pieza tocada: hacia el lado contrario al punto del toque (más lejos del centro, más fuerte). */
export function empujar(e: PointerEvent<HTMLElement>) {
  if (reducirMovimiento()) return;
  const r = e.currentTarget.getBoundingClientRect();
  if (!r.width) return;
  const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2); // -1 a 1
  golpear(-Math.max(-1, Math.min(1, dx)) * 90 || 60); // toque justo al centro: empuje fijo
}

/** Toque sobre la cuerda: empuja y, en iPhone, pide el permiso de movimiento (debe ir dentro del toque). */
export function alTocar(e: PointerEvent<HTMLElement>) {
  if (reducirMovimiento()) return;
  empujar(e);
  if (permisoPedido || typeof window === "undefined") return;
  const pedir = [
    (window.DeviceOrientationEvent as unknown as ConPermiso | undefined)?.requestPermission,
    (window.DeviceMotionEvent as unknown as ConPermiso | undefined)?.requestPermission,
  ].filter((f): f is NonNullable<typeof f> => typeof f === "function");
  if (!pedir.length) return;
  permisoPedido = true;
  void Promise.allSettled([
    (window.DeviceOrientationEvent as unknown as ConPermiso).requestPermission?.(),
    (window.DeviceMotionEvent as unknown as ConPermiso).requestPermission?.(),
  ]);
}
