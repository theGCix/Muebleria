// src/hooks/useScrollPorModulo.ts
// ─────────────────────────────────────────────────────────────
// Parte 8.3 · F15 — Conservar el scroll al saltar entre la tienda y la
// administración y volver al módulo anterior.
//
// Por qué hace falta: el router ya restaura el scroll por ENTRADA del
// historial (atrás/adelante), pero un <Link> ("Ir a la tienda", "Dashboard")
// crea una entrada nueva y la página abre arriba.
//
// Qué hace:
//  · Recuerda, por módulo ("tienda" = rutas públicas, "admin" = rutas bajo
//    /_authenticated), la última ruta y su posición vertical.
//  · Al ENTRAR a un módulo desde el otro, si la ruta de destino es la misma
//    que se dejó, restaura esa posición (esperando a que el contenido tenga
//    altura suficiente por skeletons y consultas).
//  · No actúa con atrás/adelante (lo resuelve el router), no pisa al usuario
//    si ya movió el scroll, y si sessionStorage falla sigue en memoria.
// No cambia rutas, guardas ni permisos.
// ─────────────────────────────────────────────────────────────
import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";

type Modulo = "tienda" | "admin";
type Posicion = { ruta: string; y: number };
type Memoria = Partial<Record<Modulo, Posicion>>;

const CLAVE = "gm:scroll-modulos";
/** Tiempo máximo esperando a que la página destino tenga altura suficiente. */
const ESPERA_MAX_MS = 1500;

function leerMemoria(): Memoria {
  try {
    const crudo = window.sessionStorage.getItem(CLAVE);
    if (!crudo) return {};
    const dato = JSON.parse(crudo) as Memoria;
    const limpio: Memoria = {};
    for (const m of ["tienda", "admin"] as Modulo[]) {
      const p = dato?.[m];
      if (p && typeof p.ruta === "string" && Number.isFinite(p.y) && p.y >= 0) limpio[m] = p;
    }
    return limpio;
  } catch {
    return {};
  }
}

function guardarMemoria(m: Memoria) {
  try {
    window.sessionStorage.setItem(CLAVE, JSON.stringify(m));
  } catch {
    /* sessionStorage bloqueado o lleno: queda solo en memoria */
  }
}

export function useScrollPorModulo() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const moduloActual = (): Modulo =>
      router.state.matches.some((m) => m.routeId.startsWith("/_authenticated")) ? "admin" : "tienda";

    const memoria: Memoria = leerMemoria();
    let actual: { modulo: Modulo; ruta: string } = {
      modulo: moduloActual(),
      ruta: router.state.location.pathname,
    };
    // Última acción del historial: PUSH / REPLACE = enlace; BACK / FORWARD / GO = atrás o adelante.
    let ultimaAccion: string = "PUSH";
    let cancelarRestauracion: (() => void) | null = null;

    const dejarHistorial = router.history.subscribe(({ action }) => {
      ultimaAccion = action.type;
    });

    // Al salir de una página, guarda su posición (el scroll aún es el de la página que se deja).
    const dejarAntes = router.subscribe("onBeforeLoad", (e) => {
      cancelarRestauracion?.();
      cancelarRestauracion = null;
      if (!e.pathChanged || !e.fromLocation) return;
      // Solo si la página que se deja es la que tenemos registrada (evita guardar a mitad de una transición).
      if (e.fromLocation.pathname !== actual.ruta) return;
      memoria[actual.modulo] = { ruta: actual.ruta, y: Math.max(0, Math.round(window.scrollY)) };
      guardarMemoria(memoria);
    });

    // Al terminar de pintar la página nueva: ¿cambió el módulo? ¿es la misma ruta que se dejó?
    const dejarRender = router.subscribe("onRendered", (e) => {
      const previo = actual;
      const nuevo = { modulo: moduloActual(), ruta: e.toLocation.pathname };
      actual = nuevo;

      if (!e.pathChanged || nuevo.modulo === previo.modulo) return; // misma zona: lo maneja el router
      if (ultimaAccion !== "PUSH" && ultimaAccion !== "REPLACE") return; // atrás/adelante: lo maneja el router
      const guardada = memoria[nuevo.modulo];
      if (!guardada || guardada.ruta !== nuevo.ruta || guardada.y <= 0) return;

      cancelarRestauracion?.();
      cancelarRestauracion = restaurar(guardada.y);
    });

    return () => {
      dejarHistorial();
      dejarAntes();
      dejarRender();
      cancelarRestauracion?.();
    };
  }, [router]);
}

/**
 * Lleva la ventana a `y` en cuanto el documento sea lo bastante alto. Se cancela si el usuario
 * mueve el scroll (rueda, táctil, teclado, clic). Devuelve la función para cancelarla.
 */
function restaurar(y: number): () => void {
  let activo = true;
  let raf = 0;
  const inicio = performance.now();

  const eventos = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
  const parar = () => {
    activo = false;
    cancelAnimationFrame(raf);
    for (const ev of eventos) window.removeEventListener(ev, parar);
  };
  for (const ev of eventos) window.addEventListener(ev, parar, { passive: true });

  const intentar = () => {
    if (!activo) return;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (max >= y - 1) {
      window.scrollTo({ top: y, left: 0, behavior: "auto" });
      parar();
    } else if (performance.now() - inicio > ESPERA_MAX_MS) {
      // La página destino quedó más corta que la posición guardada: se limita al fondo.
      if (max > 0) window.scrollTo({ top: max, left: 0, behavior: "auto" });
      parar();
    } else {
      raf = requestAnimationFrame(intentar);
    }
  };
  raf = requestAnimationFrame(intentar);

  return parar;
}
