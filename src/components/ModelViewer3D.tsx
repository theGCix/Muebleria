// src/components/ModelViewer3D.tsx
import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, RotateCcw } from "lucide-react";
import { cargarModelViewer } from "@/lib/modelViewer";
import { aplicarTapizado, PALETA_TAPIZADO } from "@/lib/tapizado3d";

// Usa @google/model-viewer — web component nativo, sin bundle pesado (se carga solo al abrir «Vista 3D»)
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
  onProbar, // «Ver en tu espacio»: abre el probador con foto (cámara o galería) de «Pruébalo en tu espacio»
  colorHex, // color del tapizado elegido en la ficha; sin valor → colores originales del modelo
}: {
  src: string;
  alt: string;
  poster?: string;
  onProbar?: () => void;
  colorHex?: string | null;
}) {
  const viewerRef = useRef<any>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  // Color de prueba elegido aquí (solo visual); si la ficha manda un color, se parte de él
  const [elegido, setElegido] = useState<string | null>(colorHex ?? null);
  useEffect(() => { setElegido(colorHex ?? null); }, [colorHex]);

  useEffect(() => {
    cargarModelViewer().catch(() => setFailed(true));
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

  // Tapizado: se repinta al cargar el modelo y cada vez que cambia el color elegido
  useEffect(() => {
    if (!loaded || !viewerRef.current) return;
    void aplicarTapizado(viewerRef.current, elegido);
  }, [loaded, elegido, src]);

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
        style={{ width: "100%", height: "100%", opacity: loaded ? 1 : 0, transition: "opacity 0.3s" }}
      />

      {/* «Ver en tu espacio»: mismo probador que «Pruébalo en tu espacio» (foto con cámara o galería) */}
      {loaded && onProbar && (
        <button
          type="button"
          onClick={onProbar}
          className="absolute bottom-4 right-4 min-h-11 px-4 rounded-lg text-xs font-medium inline-flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          <Camera className="h-4 w-4" aria-hidden />
          Ver en tu espacio
        </button>
      )}

      {/* Color del tapizado: prueba visual sobre el modelo */}
      {loaded && (
        <div className="absolute bottom-4 left-4 right-40 flex flex-col gap-1.5">
          <span className="text-[11px] font-medium text-foreground/80">
            Prueba un color: {PALETA_TAPIZADO.find((c) => c.hex === elegido)?.nombre ?? "Personalizado"}
          </span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color del tapizado">
            {PALETA_TAPIZADO.map((c) => (
              <button
                key={c.nombre}
                type="button"
                role="radio"
                aria-checked={c.hex === elegido}
                aria-label={c.nombre}
                title={c.nombre}
                onClick={() => setElegido(c.hex)}
                className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{
                  background: c.hex ?? "conic-gradient(#d8cfc2, #8a8d90, #d8cfc2)",
                  borderColor: c.hex === elegido ? "var(--primary)" : "rgba(255,255,255,0.9)",
                  boxShadow: "0 0 0 1px rgba(0,0,0,0.25)",
                }}
              />
            ))}
          </div>
        </div>
      )}

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
