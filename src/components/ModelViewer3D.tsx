// src/components/ModelViewer3D.tsx
import { useEffect, useRef, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";

// Usa @google/model-viewer — web component nativo, sin bundle pesado (se carga solo al abrir «Vista 3D»)
declare global {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<any, HTMLElement>;
    }
  }
}

const MODEL_VIEWER_SRC = "https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js";

export function ModelViewer3D({
  src,
  alt,
  poster,  // imagen de preview mientras carga el modelo
}: {
  src: string;
  alt: string;
  poster?: string;
}) {
  const viewerRef = useRef<any>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // Cargar el web component de Google si no está ya
    if (!customElements.get("model-viewer") && !document.querySelector(`script[src="${MODEL_VIEWER_SRC}"]`)) {
      const script = document.createElement("script");
      script.type = "module";
      script.src = MODEL_VIEWER_SRC;
      script.onerror = () => setFailed(true);
      document.head.appendChild(script);
    }
  }, []);

  // React 18 no enlaza eventos de elementos personalizados con onLoad/onError: se escuchan a mano
  useEffect(() => {
    const el = viewerRef.current as HTMLElement | null;
    if (!el) return;
    setLoaded(false);
    setFailed(false);
    const ok = () => setLoaded(true);
    const ko = () => setFailed(true);
    el.addEventListener("load", ok);
    el.addEventListener("error", ko);
    return () => {
      el.removeEventListener("load", ok);
      el.removeEventListener("error", ko);
    };
  }, [src]);

  return (
    <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-secondary/20 border border-border/40">
      {!loaded && !failed && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}
      {failed && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
          No se pudo cargar el modelo 3D. Mira las fotos del producto.
        </div>
      )}
      <model-viewer
        ref={viewerRef}
        src={src}
        alt={alt}
        poster={poster}
        camera-controls
        auto-rotate
        auto-rotate-delay="1000"
        rotation-per-second="30deg"
        shadow-intensity="1"
        ar
        ar-modes="scene-viewer webxr quick-look"
        ar-scale="fixed"
        ar-placement="floor"
        style={{ width: "100%", height: "100%", opacity: loaded ? 1 : 0, transition: "opacity 0.3s" }}
      >
        {/* Botón de AR: model-viewer solo lo muestra si el dispositivo la admite (celulares; en PC no aparece) */}
        <button
          slot="ar-button"
          className="absolute bottom-4 right-4 min-h-11 px-4 rounded-lg text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          Ver en tu espacio
        </button>
      </model-viewer>

      {/* Controles flotantes */}
      {loaded && (
        <div className="absolute top-3 right-3 flex flex-col gap-1.5">
          <button
            onClick={() => viewerRef.current?.resetTurntableRotation()}
            className="w-11 h-11 rounded-lg flex items-center justify-center bg-background/80 border border-border/60 hover:bg-background transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            title="Resetear vista"
            aria-label="Resetear vista"
          >
            <RotateCcw className="h-4 w-4 text-foreground" />
          </button>
        </div>
      )}
    </div>
  );
}
