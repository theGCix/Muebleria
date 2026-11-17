// src/lib/modelViewer.ts
// <model-viewer> (Google, desde CDN, sin dependencia nueva): carga del componente y render del modelo 3D
// a una imagen con fondo transparente, para colocarlo sobre la foto del cliente en «Pruébalo en tu espacio».
// Lógica pura (cajas, escala) en lib/escenaEspacio.ts.
import { limitesOpacos, pxPorCmRender } from "./escenaEspacio";
import { cargarImagen, type RecorteListo } from "./recorteImagen";

export const MODEL_VIEWER_SRC = "https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js";

let cargandoVisor: Promise<void> | null = null;

/** Carga el componente <model-viewer> una sola vez (la ficha y el probador comparten la misma carga). */
export function cargarModelViewer(): Promise<void> {
  if (customElements.get("model-viewer")) return Promise.resolve();
  if (!cargandoVisor) {
    cargandoVisor = new Promise<void>((resolve, reject) => {
      const existente = document.querySelector<HTMLScriptElement>(`script[src="${MODEL_VIEWER_SRC}"]`);
      const script = existente ?? Object.assign(document.createElement("script"), { type: "module", src: MODEL_VIEWER_SRC });
      script.addEventListener("error", () => {
        cargandoVisor = null;
        reject(new Error("No se pudo cargar el visor 3D"));
      });
      if (!existente) document.head.appendChild(script);
      void customElements.whenDefined("model-viewer").then(() => resolve());
    });
  }
  return cargandoVisor;
}

// Cámara fija en todos los renders: así los píxeles por cm son los mismos al girar el modelo.
// Campo de visión corto y cámara lejos = casi sin deformación de perspectiva (aspecto de «foto con zoom»).
const FOV_GRADOS = 14;
const RADIO_M = 18;
const LADO_CSS = 700;
const LADO_MAX_SALIDA = 1000;

const dosCuadros = () => new Promise<void>((res) => requestAnimationFrame(() => requestAnimationFrame(() => res())));
const orbita = (giroGrados: number, phiGrados: number) => `${giroGrados}deg ${phiGrados}deg ${RADIO_M}m`;

export type VistaRender = RecorteListo & {
  /** Ancho que muestra este render en cm reales (cambia al girar el modelo). */
  anchoCm: number;
};

export interface Render3D {
  /** Ancho real del modelo visto de frente, en cm (sale del propio archivo .glb). */
  anchoRealCm: number;
  /** Modelo girado `giro`° y visto con la cámara a `phi`° (90 = a la altura del mueble, menos = desde arriba). */
  vista(giro: number, phi: number): Promise<VistaRender | null>;
  destruir(): void;
}

/** Monta un <model-viewer> invisible con el modelo, lo calibra de frente y devuelve el generador de vistas. */
export async function crearRender3D(url: string): Promise<Render3D> {
  await cargarModelViewer();
  const el: any = document.createElement("model-viewer");
  const attrs: Record<string, string> = {
    src: url,
    alt: "",
    "aria-hidden": "true",
    tabindex: "-1",
    "interaction-prompt": "none",
    "disable-zoom": "",
    "disable-pan": "",
    "shadow-intensity": "0",
    "camera-orbit": orbita(0, 90),
    "field-of-view": `${FOV_GRADOS}deg`,
    "min-camera-orbit": "auto auto 1m",
    "max-camera-orbit": "auto auto 60m",
    "min-field-of-view": "5deg",
    "max-field-of-view": "45deg",
  };
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  // Dentro de la pantalla (si no, el visor no renderiza) pero invisible y sin recibir toques
  el.style.cssText = `position:fixed;left:0;top:0;width:${LADO_CSS}px;height:${LADO_CSS}px;opacity:0;pointer-events:none;z-index:-1;`;
  document.body.appendChild(el);

  try {
    await new Promise<void>((resolve, reject) => {
      if (el.loaded) return resolve();
      el.addEventListener("load", () => resolve(), { once: true });
      el.addEventListener("error", () => reject(new Error("No se pudo cargar el modelo 3D")), { once: true });
    });

    // Un render a la vez (el mismo elemento): las llamadas se encolan
    let cola: Promise<unknown> = Promise.resolve();

    async function capturar(giro: number, phi: number) {
      el.cameraOrbit = orbita(giro, phi);
      el.fieldOfView = `${FOV_GRADOS}deg`;
      el.jumpCameraToGoal?.();
      await el.updateComplete;
      await dosCuadros();
      const blob: Blob = await el.toBlob({ mimeType: "image/png", idealAspect: false });
      const u = URL.createObjectURL(blob);
      try {
        const im = await cargarImagen(u);
        const c = document.createElement("canvas");
        c.width = im.naturalWidth;
        c.height = im.naturalHeight;
        const ctx = c.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(im, 0, 0);
        const caja = limitesOpacos(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
        return caja ? { canvas: c, caja } : null;
      } finally {
        URL.revokeObjectURL(u);
      }
    }

    // Calibración: de frente y a la altura del mueble, el render mide exactamente el ancho real del modelo
    const dims = el.getDimensions?.();
    const anchoRealCm = dims ? Math.round(dims.x * 1000) / 10 : 0;
    const frente = await capturar(0, 90);
    const pxCm = frente ? pxPorCmRender(frente.caja.w, anchoRealCm) : null;
    if (!pxCm) throw new Error("No se pudo calibrar el modelo 3D");

    return {
      anchoRealCm,
      vista(giro, phi) {
        const tarea = cola.then(async (): Promise<VistaRender | null> => {
          const r = await capturar(giro, phi);
          if (!r) return null;
          const { caja } = r;
          const k = Math.min(1, LADO_MAX_SALIDA / Math.max(caja.w, caja.h));
          const w = Math.max(1, Math.round(caja.w * k));
          const h = Math.max(1, Math.round(caja.h * k));
          const out = document.createElement("canvas");
          out.width = w;
          out.height = h;
          out.getContext("2d")!.drawImage(r.canvas, caja.x, caja.y, caja.w, caja.h, 0, 0, w, h);
          return { url: out.toDataURL("image/png"), canvas: out, w, h, fondoQuitado: true, anchoCm: caja.w / pxCm };
        });
        cola = tarea.catch(() => undefined);
        return tarea;
      },
      destruir() {
        el.remove();
      },
    };
  } catch (e) {
    el.remove();
    throw e;
  }
}
