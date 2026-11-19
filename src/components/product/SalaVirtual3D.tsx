// src/components/product/SalaVirtual3D.tsx
// «Sala virtual»: el modelo 3D en un ambiente aparte (pantalla completa) con luz de día/atardecer/noche,
// vistas de cámara, medidas reales tomadas del propio archivo y prueba de color del tapizado.
// Usa <model-viewer> (ya cargado desde CDN por ModelViewer3D); sin dependencias nuevas.
import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, Ruler, X } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cargarModelViewer } from "@/lib/modelViewer";
import { aplicarTapizado, PALETA_TAPIZADO } from "@/lib/tapizado3d";
import type { FotoEspacio } from "@/lib/fotoEspacio";
import { FotoEspacioPanel } from "./FotoEspacio";
import { AMBIENTES, VISTAS_CAMARA, puntosDeMedida, type AmbienteId, type PuntoMedida } from "@/lib/salaVirtual";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string;
  alt: string;
  poster?: string;
  /** Color de tapizado elegido en la ficha; sin valor → colores originales del modelo. */
  colorHex?: string | null;
  /** «Ver en tu espacio»: la sala se cierra y se abre el probador con foto. */
  onProbar?: () => void;
}

const MARFIL = "#F5F1E8";
const TEXTO = "#292824";
const BOTON_BASE =
  "min-h-11 px-4 rounded-lg text-xs font-medium inline-flex items-center justify-center gap-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

export function SalaVirtual3D({ open, onOpenChange, src, alt, poster, colorHex, onProbar }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="left-0 top-0 h-[100dvh] max-h-none w-screen max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-none border-0 p-0 sm:rounded-none data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100 [&>button:last-child]:hidden"
      >
        {/* La escena solo existe mientras la sala está abierta: al cerrar se libera el contexto 3D */}
        <Escena
          src={src}
          alt={alt}
          poster={poster}
          colorInicial={colorHex ?? null}
          onProbar={onProbar ? () => { onOpenChange(false); onProbar(); } : undefined}
        />
      </DialogContent>
    </Dialog>
  );
}

/** Sala (escenario 3D) o «Mi espacio» (foto del cliente); el color y la foto se conservan al alternar. */
function Escena({ src, alt, poster, colorInicial, onProbar }: {
  src: string; alt: string; poster?: string; colorInicial: string | null; onProbar?: () => void;
}) {
  const [modoEspacio, setModoEspacio] = useState(false);
  const [color, setColor] = useState<string | null>(colorInicial);
  const [foto, setFoto] = useState<FotoEspacio | null>(null);

  if (modoEspacio) {
    return (
      <FotoEspacioPanel
        src={src}
        alt={alt}
        nombre={alt}
        foto={foto}
        onFoto={setFoto}
        color={color}
        onColor={setColor}
        onVolver={() => setModoEspacio(false)}
      />
    );
  }
  return <EscenaSala src={src} alt={alt} poster={poster} color={color} setColor={setColor} onMiEspacio={() => setModoEspacio(true)} onProbar={onProbar} />;
}

function EscenaSala({ src, alt, poster, color, setColor, onMiEspacio, onProbar }: {
  src: string; alt: string; poster?: string; color: string | null; setColor: (hex: string | null) => void;
  onMiEspacio: () => void; onProbar?: () => void;
}) {
  const viewerRef = useRef<any>(null);
  const [cargado, setCargado] = useState(false);
  const [fallo, setFallo] = useState(false);
  const [ambienteId, setAmbienteId] = useState<AmbienteId>("dia");
  const [vistaId, setVistaId] = useState<string>(VISTAS_CAMARA[0].id);
  const [medidas, setMedidas] = useState(true);
  const [puntos, setPuntos] = useState<PuntoMedida[]>([]);
  const ambiente = AMBIENTES.find((a) => a.id === ambienteId) ?? AMBIENTES[0];

  useEffect(() => { cargarModelViewer().catch(() => setFallo(true)); }, []);

  // React 18 no enlaza eventos de elementos personalizados: se escuchan a mano (igual que ModelViewer3D)
  useEffect(() => {
    const el = viewerRef.current as HTMLElement | null;
    if (!el) return;
    const ok = () => {
      setCargado(true);
      const v: any = viewerRef.current;
      const tam = v?.getDimensions?.();
      const centro = v?.getBoundingBoxCenter?.();
      // Las cifras salen del archivo; si el visor no las entrega, simplemente no se muestran medidas
      setPuntos(tam && centro ? puntosDeMedida(centro, tam) : []);
    };
    const ko = () => setFallo(true);
    el.addEventListener("load", ok);
    el.addEventListener("error", ko);
    return () => { el.removeEventListener("load", ok); el.removeEventListener("error", ko); };
  }, [src]);

  useEffect(() => {
    if (!cargado || !viewerRef.current) return;
    void aplicarTapizado(viewerRef.current, color);
  }, [cargado, color, src]);

  function irAVista(id: string) {
    const vista = VISTAS_CAMARA.find((v) => v.id === id);
    if (!vista || !viewerRef.current) return;
    setVistaId(id);
    viewerRef.current.removeAttribute("auto-rotate");
    viewerRef.current.cameraOrbit = vista.orbita;
  }

  return (
    <div className="relative h-full w-full select-none" style={{ background: ambiente.fondo, transition: "background .5s" }}>
      <model-viewer
        ref={viewerRef}
        src={src}
        alt={alt}
        poster={poster}
        camera-controls
        auto-rotate
        auto-rotate-delay="2500"
        rotation-per-second="12deg"
        camera-orbit={VISTAS_CAMARA[0].orbita}
        min-camera-orbit="auto 25deg auto"
        max-camera-orbit="auto 90deg auto"
        environment-image="neutral"
        exposure={ambiente.exposicion}
        shadow-intensity={ambiente.sombra}
        shadow-softness="0.9"
        interaction-prompt="auto"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", background: "transparent", opacity: cargado ? 1 : 0, transition: "opacity .4s" }}
      >
        {medidas && puntos.map((p) => (
          <div
            key={p.id}
            slot={`hotspot-${p.id}`}
            data-position={p.posicion}
            data-visibility-attribute="visible"
            className="pointer-events-none rounded-full px-3 py-1 text-xs font-medium shadow-md"
            style={{ background: TEXTO, color: MARFIL, whiteSpace: "nowrap" }}
          >
            {p.etiqueta}
          </div>
        ))}
      </model-viewer>

      {!cargado && !fallo && (
        <div className="absolute inset-0 flex items-center justify-center" role="status" aria-label="Cargando el modelo 3D">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: ambienteId === "noche" ? MARFIL : TEXTO }} />
        </div>
      )}
      {fallo && (
        <div className="absolute inset-0 flex items-center justify-center p-8 text-center text-sm" style={{ color: ambienteId === "noche" ? MARFIL : TEXTO }}>
          No se pudo cargar el modelo 3D. Cierra esta ventana y mira las fotos del producto.
        </div>
      )}

      {/* Barra superior */}
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3 sm:p-5">
        <div className="rounded-xl px-4 py-2.5" style={{ background: "rgba(245,241,232,.92)", color: TEXTO }}>
          <DialogTitle className="font-display text-base font-normal tracking-normal sm:text-lg">Sala virtual</DialogTitle>
          <DialogDescription className="mt-0.5 text-xs" style={{ color: "#5b564d" }}>
            Gira, acerca y mira el mueble a su tamaño real. Con «Mi espacio» míralo en tu sala.
          </DialogDescription>
        </div>
        <DialogClose
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ background: "rgba(245,241,232,.92)", color: TEXTO }}
          aria-label="Cerrar la sala virtual"
        >
          <X className="h-5 w-5" aria-hidden />
        </DialogClose>
      </div>

      {/* Vistas de cámara */}
      {cargado && (
        <div className="absolute right-3 top-1/2 flex -translate-y-1/2 flex-col gap-2 sm:right-5" role="radiogroup" aria-label="Vista de cámara">
          {VISTAS_CAMARA.map((v) => (
            <button
              key={v.id}
              type="button"
              role="radio"
              aria-checked={vistaId === v.id}
              onClick={() => irAVista(v.id)}
              className={BOTON_BASE}
              style={{ background: vistaId === v.id ? "#34443A" : "rgba(245,241,232,.92)", color: vistaId === v.id ? MARFIL : TEXTO }}
            >
              {v.nombre}
            </button>
          ))}
        </div>
      )}

      {/* Barra inferior: ambiente, medidas, color y probador */}
      {cargado && (
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-3 sm:p-5">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4 sm:p-4" style={{ background: "rgba(245,241,232,.95)", color: TEXTO }}>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium">Color del tapizado: {PALETA_TAPIZADO.find((c) => c.hex === color)?.nombre ?? "Personalizado"}</span>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color del tapizado">
                {PALETA_TAPIZADO.map((c) => (
                  <button
                    key={c.nombre}
                    type="button"
                    role="radio"
                    aria-checked={c.hex === color}
                    aria-label={c.nombre}
                    title={c.nombre}
                    onClick={() => setColor(c.hex)}
                    className="h-11 w-11 rounded-full border-2 transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={{
                      background: c.hex ?? "conic-gradient(#d8cfc2, #8a8d90, #d8cfc2)",
                      borderColor: c.hex === color ? "#34443A" : "rgba(255,255,255,.9)",
                      boxShadow: "0 0 0 1px rgba(0,0,0,.25)",
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1 rounded-lg p-1" style={{ background: "#E4DCCB" }} role="radiogroup" aria-label="Ambiente de luz">
                {AMBIENTES.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    role="radio"
                    aria-checked={ambienteId === a.id}
                    onClick={() => setAmbienteId(a.id)}
                    className={BOTON_BASE}
                    style={{ background: ambienteId === a.id ? "#34443A" : "transparent", color: ambienteId === a.id ? MARFIL : TEXTO }}
                  >
                    {a.nombre}
                  </button>
                ))}
              </div>
              {puntos.length > 0 && (
                <button
                  type="button"
                  aria-pressed={medidas}
                  onClick={() => setMedidas((m) => !m)}
                  className={`${BOTON_BASE} border`}
                  style={{ borderColor: "#8B735B", background: medidas ? "#D8C3A5" : "transparent", color: TEXTO }}
                >
                  <Ruler className="h-4 w-4" aria-hidden />
                  Medidas
                </button>
              )}
              <button type="button" onClick={onMiEspacio} className={BOTON_BASE} style={{ background: "#34443A", color: MARFIL }}>
                <ImagePlus className="h-4 w-4" aria-hidden />
                Mi espacio
              </button>
              {onProbar && (
                <button type="button" onClick={onProbar} className={BOTON_BASE} style={{ background: "#34443A", color: MARFIL }}>
                  <Camera className="h-4 w-4" aria-hidden />
                  Ver en tu espacio
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
