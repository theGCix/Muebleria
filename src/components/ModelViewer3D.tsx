// src/components/ModelViewer3D.tsx
import { useEffect, useRef, useState } from "react";
import { Loader2, RotateCcw, ZoomIn } from "lucide-react";
import { Button } from "./ui/button";

// Usa @google/model-viewer — web component nativo, sin bundle pesado
declare global {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<any, HTMLElement>;
    }
  }
}

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
  const [loaded, setLoaded]   = useState(false);
  const [arEnabled, setArEnabled] = useState(false);

  useEffect(() => {
    // Cargar el web component de Google si no está ya
    if (!customElements.get("model-viewer")) {
      const script = document.createElement("script");
      script.type = "module";
      script.src = "https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js";
      document.head.appendChild(script);
    }
    // Detectar soporte de AR
    setArEnabled("xr" in navigator || "webxr" in navigator);
  }, []);

  return (
    <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-secondary/20 border border-border/40">
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
        ar={arEnabled ? "" : undefined}
        ar-modes="webxr scene-viewer quick-look"
        style={{ width: "100%", height: "100%", opacity: loaded ? 1 : 0, transition: "opacity 0.3s" }}
        onLoad={() => setLoaded(true)}
      >
        {/* Botón de AR */}
        {arEnabled && (
          <button
            slot="ar-button"
            className="absolute bottom-4 right-4 px-3 py-2 rounded-lg text-xs font-medium"
            style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            Ver en mi sala
          </button>
        )}
      </model-viewer>

      {/* Controles flotantes */}
      {loaded && (
        <div className="absolute top-3 right-3 flex flex-col gap-1.5">
          <button
            onClick={() => viewerRef.current?.resetTurntableRotation()}
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-background/80 border border-border/60 hover:bg-background transition-colors"
            title="Resetear vista"
          >
            <RotateCcw className="h-3.5 w-3.5 text-foreground" />
          </button>
        </div>
      )}
    </div>
  );
}