// src/components/ModelViewer3D.tsx
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Maximize2, Palette, RotateCcw } from "lucide-react";
import { cargarModelViewer } from "@/lib/modelViewer";
import { aplicarSeleccion, SIN_TAPIZADO, type Tapizado } from "@/lib/tapizado3d";
import { SelectorTela } from "@/components/product/SelectorTela";

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
  onAbrirSala, // «Abrir sala virtual»: el 3D en un ambiente aparte (pantalla completa); desde ahí se llega a «Ver en tu espacio»
  colorHex, // color del tapizado elegido en la ficha; sin valor → colores originales del modelo
}: {
  src: string;
  alt: string;
  poster?: string;
  onAbrirSala?: () => void;
  colorHex?: string | null;
}) {
  const viewerRef = useRef<any>(null);
  const [loaded, setLoaded] = useState(false);
  const [telasAbiertas, setTelasAbiertas] = useState(false); // selector plegado por defecto: no tapa el modelo
  const [failed, setFailed] = useState(false);
  // Color de prueba elegido aquí (solo visual); si la ficha manda un color, se parte de él
  const [elegido, setElegido] = useState<Tapizado>({ ...SIN_TAPIZADO, hex: colorHex ?? null });
  useEffect(() => { setElegido({ ...SIN_TAPIZADO, hex: colorHex ?? null }); }, [colorHex]);

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
    void aplicarSeleccion(viewerRef.current, elegido);
  }, [loaded, elegido, src]);

  return (
    <div className="flex w-full flex-col gap-2">
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

      {/* «Abrir sala virtual»: ambiente aparte con luz, medidas y vistas; allí está «Ver en tu espacio» */}
      {loaded && onAbrirSala && (
        <button
          type="button"
          onClick={onAbrirSala}
          className="absolute bottom-4 right-4 min-h-11 px-4 rounded-lg text-xs font-medium inline-flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          <Maximize2 className="h-4 w-4" aria-hidden />
          Abrir sala virtual
        </button>
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

      {/* Tapizado: fuera del recuadro 3D para que nunca tape el modelo; plegable */}
      {loaded && (
        <div className="rounded-xl border border-border/40 bg-background/90">
          <button
            type="button"
            onClick={() => setTelasAbiertas((v) => !v)}
            aria-expanded={telasAbiertas}
            className="flex min-h-11 w-full items-center justify-between gap-2 px-3 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <span className="inline-flex items-center gap-2"><Palette className="h-4 w-4" aria-hidden />Probar tapizado y telas</span>
            {telasAbiertas ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
          </button>
          {telasAbiertas && (
            <div className="max-h-[50dvh] overflow-y-auto p-3 pt-0">
              <SelectorTela value={elegido} onChange={setElegido} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
