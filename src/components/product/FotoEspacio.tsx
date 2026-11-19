// src/components/product/FotoEspacio.tsx
// Modo «Mi espacio» de la sala virtual: la foto del cliente (cámara o galería) de fondo y el sofá 3D en vivo encima.
// Un dedo lo mueve, dos dedos (pellizco) o la barra «Tamaño» lo agrandan o reducen, la barra «Giro» lo rota.
// Sin medida real (el tamaño es solo visual). La foto se queda en el dispositivo. Sin dependencias nuevas.
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, Download, ImagePlus, Loader2, Share2, X } from "lucide-react";
import { DialogClose, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cargarImagen } from "@/lib/recorteImagen";
import { cargarModelViewer } from "@/lib/modelViewer";
import { prepararFotoEspacio, type FotoEspacio as Foto } from "@/lib/fotoEspacio";
import { aplicarTapizado, PALETA_TAPIZADO } from "@/lib/tapizado3d";
import {
  BRILLO_MAX, BRILLO_MIN, TAMANO_INICIAL, TAMANO_MAX, TAMANO_MIN,
  ajustarAlEspacio, cajaDelMueble, limitarBrillo, limitarTamano, moverCentro, normalizarGiro, tamanoPorPellizco,
  type Centro,
} from "@/lib/salaVirtual";

interface Props {
  src: string;
  alt: string;
  nombre: string;
  foto: Foto | null;
  onFoto: (f: Foto) => void;
  color: string | null;
  onColor: (hex: string | null) => void;
  onVolver: () => void;
}

const MARFIL = "#F5F1E8";
const TEXTO = "#292824";
const VERDE = "#34443A";
const BOTON =
  "min-h-11 px-4 rounded-lg text-xs font-medium inline-flex items-center justify-center gap-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";
const ETIQUETA_FOTO =
  "flex min-h-[160px] cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2";
const BARRA = "h-11 w-full cursor-pointer accent-[#34443A]";

export function FotoEspacioPanel({ src, alt, nombre, foto, onFoto, color, onColor, onVolver }: Props) {
  // En celular se ofrece «Tomar foto» (abre la cámara); en PC solo subir un archivo
  const esTactil = typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches;
  const [cargandoFoto, setCargandoFoto] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [cargado, setCargado] = useState(false);
  const [fallo, setFallo] = useState(false);
  const [tamano, setTamano] = useState(TAMANO_INICIAL);
  const [giro, setGiro] = useState(20);
  const [brillo, setBrillo] = useState(1);
  const [sombra, setSombra] = useState(true);
  const [centro, setCentro] = useState<Centro>({ x: 0.5, y: 0.66 });
  const [generando, setGenerando] = useState(false);

  const visorRef = useRef<any>(null);
  const zonaRef = useRef<HTMLDivElement>(null);
  const [libre, setLibre] = useState({ w: 0, h: 0 });

  // Espacio disponible para la foto (se mide: cambia con la barra de controles y al girar el celular)
  useEffect(() => {
    const el = zonaRef.current;
    if (!el) return;
    // Se descuenta el relleno (p-2 = 8 px por lado) para que la foto quepa justo en el espacio libre
    const medir = () => setLibre({ w: Math.max(0, el.clientWidth - 16), h: Math.max(0, el.clientHeight - 16) });
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [foto]);

  const escenario = foto ? ajustarAlEspacio(foto.w, foto.h, libre.w, libre.h) : { w: 0, h: 0 };
  const caja = cajaDelMueble(centro, tamano, escenario.w, escenario.h);

  useEffect(() => { if (foto) cargarModelViewer().catch(() => setFallo(true)); }, [foto]);

  // React 18 no enlaza eventos de elementos personalizados: se escuchan a mano
  useEffect(() => {
    const el = visorRef.current as HTMLElement | null;
    if (!el) return;
    const ok = () => setCargado(true);
    const ko = () => setFallo(true);
    el.addEventListener("load", ok);
    el.addEventListener("error", ko);
    return () => { el.removeEventListener("load", ok); el.removeEventListener("error", ko); };
  }, [src, foto]);

  useEffect(() => {
    if (!cargado || !visorRef.current) return;
    void aplicarTapizado(visorRef.current, color);
  }, [cargado, color, src]);

  /* ── Foto ── */
  async function alElegirFoto(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Elige una imagen (JPG, PNG o foto del celular)."); return; }
    setError(null);
    setCargandoFoto(true);
    try {
      onFoto(await prepararFotoEspacio(file));
      setCentro({ x: 0.5, y: 0.66 });
      setTamano(TAMANO_INICIAL);
    } catch {
      setError("No pudimos abrir esa foto. Prueba con otra.");
    } finally {
      setCargandoFoto(false);
    }
  }

  /* ── Gestos: un dedo mueve, dos dedos (pellizco) cambian el tamaño, la rueda también (PC) ── */
  const punteros = useRef(new Map<number, { x: number; y: number }>());
  const pellizco = useRef<{ dist: number; base: number } | null>(null);

  const distancia = () => {
    const [a, b] = [...punteros.current.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };

  function alPresionar(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (punteros.current.size === 2) pellizco.current = { dist: distancia(), base: tamano };
  }

  function alMover(e: React.PointerEvent<HTMLDivElement>) {
    const previo = punteros.current.get(e.pointerId);
    if (!previo) return;
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (punteros.current.size >= 2 && pellizco.current) {
      setTamano(tamanoPorPellizco(pellizco.current.base, pellizco.current.dist, distancia()));
    } else if (punteros.current.size === 1) {
      setCentro((c) => moverCentro(c, e.clientX - previo.x, e.clientY - previo.y, escenario.w, escenario.h));
    }
  }

  function alSoltar(e: React.PointerEvent<HTMLDivElement>) {
    punteros.current.delete(e.pointerId);
    pellizco.current = punteros.current.size >= 2 ? { dist: distancia(), base: tamano } : null;
  }

  // La rueda se enlaza a mano con passive:false para poder evitar el desplazamiento de la página
  const capaRef = useRef<HTMLDivElement>(null);
  const tamanoRef = useRef(tamano);
  tamanoRef.current = tamano;
  useEffect(() => {
    const el = capaRef.current;
    if (!el) return;
    const rueda = (e: WheelEvent) => {
      e.preventDefault();
      setTamano(limitarTamano(tamanoRef.current * (e.deltaY < 0 ? 1.06 : 1 / 1.06)));
    };
    el.addEventListener("wheel", rueda, { passive: false });
    return () => el.removeEventListener("wheel", rueda);
  }, [foto]);

  /* ── Imagen final: foto + sofá tal como se ve en pantalla ── */
  const nombreArchivo = `${nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "mueble"}-en-mi-espacio.jpg`;

  async function componer(): Promise<Blob | null> {
    if (!foto || !visorRef.current || escenario.w <= 0) return null;
    const png: Blob = await visorRef.current.toBlob({ mimeType: "image/png", idealAspect: false });
    const urlSofa = URL.createObjectURL(png);
    try {
      const sofa = await cargarImagen(urlSofa);
      const k = foto.w / escenario.w;
      const c = document.createElement("canvas");
      c.width = foto.w;
      c.height = foto.h;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(foto.img, 0, 0, foto.w, foto.h);
      ctx.drawImage(sofa, caja.left * k, caja.top * k, caja.lado * k, caja.lado * k);
      ctx.font = `${Math.max(12, Math.round(foto.w * 0.016))}px sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.textAlign = "right";
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 4;
      ctx.fillText("G&M Mueblería · simulación referencial", foto.w - 12, foto.h - 12);
      return await new Promise<Blob | null>((res) => c.toBlob((b) => res(b), "image/jpeg", 0.92));
    } finally {
      URL.revokeObjectURL(urlSofa);
    }
  }

  async function generar(accion: "descargar" | "compartir") {
    setGenerando(true);
    setError(null);
    try {
      const blob = await componer();
      if (!blob) throw new Error("sin imagen");
      const file = new File([blob], nombreArchivo, { type: "image/jpeg" });
      if (accion === "compartir" && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: nombre, text: `Así quedaría ${nombre} en mi espacio` });
        } catch { /* el cliente cerró el menú de compartir */ }
        return;
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = nombreArchivo;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch {
      setError("No pudimos crear la imagen en este dispositivo. Haz una captura de pantalla de tu sala.");
    } finally {
      setGenerando(false);
    }
  }

  const puedeCompartir = typeof navigator !== "undefined" && typeof navigator.canShare === "function";

  return (
    <div className="flex h-full min-h-0 w-full flex-col select-none" style={{ background: "#1E2621", color: MARFIL }}>
      {/* Cabecera */}
      <div className="flex items-center justify-between gap-2 p-3 sm:p-4" style={{ background: "rgba(245,241,232,.96)", color: TEXTO }}>
        <button type="button" onClick={onVolver} className={BOTON} style={{ background: "#E4DCCB", color: TEXTO }}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Volver a la sala
        </button>
        <div className="min-w-0 flex-1 text-center">
          <DialogTitle className="font-display text-base font-normal tracking-normal sm:text-lg">Mi espacio</DialogTitle>
          <DialogDescription className="text-xs" style={{ color: "#5b564d" }}>
            {foto ? "Arrastra para mover y pellizca para cambiar el tamaño." : "Toma o elige una foto de tu sala."}
          </DialogDescription>
        </div>
        <DialogClose
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ background: "#E4DCCB", color: TEXTO }}
          aria-label="Cerrar la sala virtual"
        >
          <X className="h-5 w-5" aria-hidden />
        </DialogClose>
      </div>

      {/* Paso 1: elegir la foto */}
      {!foto && (
        <div className="flex flex-1 items-center justify-center overflow-y-auto p-4 sm:p-8">
          <div className="grid w-full max-w-3xl gap-3 sm:grid-cols-2">
            {esTactil && (
              <label className={ETIQUETA_FOTO} style={{ borderColor: MARFIL, background: "rgba(245,241,232,.08)" }}>
                {cargandoFoto ? <Loader2 className="h-8 w-8 animate-spin" aria-hidden /> : <Camera className="h-8 w-8" aria-hidden />}
                <span className="text-base font-semibold">{cargandoFoto ? "Preparando tu foto…" : "Tomar foto"}</span>
                <span className="max-w-sm text-xs opacity-85">Abre la cámara de tu celular.</span>
                <input
                  type="file" accept="image/*" capture="environment" className="sr-only" data-testid="tomar-foto"
                  onChange={(e) => { void alElegirFoto(e.target.files?.[0]); e.target.value = ""; }}
                />
              </label>
            )}
            <label className={`${ETIQUETA_FOTO} ${esTactil ? "" : "sm:col-span-2"}`} style={{ borderColor: "rgba(245,241,232,.5)", background: "rgba(245,241,232,.04)" }}>
              {cargandoFoto && !esTactil ? <Loader2 className="h-8 w-8 animate-spin" aria-hidden /> : <ImagePlus className="h-8 w-8" aria-hidden />}
              <span className="text-base font-semibold">
                {cargandoFoto && !esTactil ? "Preparando tu foto…" : esTactil ? "Elegir de la galería" : "Subir una foto"}
              </span>
              <span className="max-w-sm text-xs opacity-85">Mejor de frente a la pared donde irá el mueble, con el piso a la vista.</span>
              <input
                type="file" accept="image/*" className="sr-only" data-testid="subir-foto"
                onChange={(e) => { void alElegirFoto(e.target.files?.[0]); e.target.value = ""; }}
              />
            </label>
            {error && <p role="alert" className="text-xs sm:col-span-2" style={{ color: "#F2C9B8" }}>{error}</p>}
            <p className="text-xs opacity-85 sm:col-span-2">Tu foto se queda en tu dispositivo: no se sube a ningún servidor.</p>
          </div>
        </div>
      )}

      {/* Paso 2: foto + sofá en vivo */}
      {foto && (
        <>
          <div ref={zonaRef} className="relative min-h-0 flex-1 overflow-hidden p-2">
            {escenario.w > 0 && (
              // Posición absoluta: el tamaño de la foto no puede influir en el de la zona que se mide (evita el bucle de crecimiento)
              <div
                className="absolute overflow-hidden rounded-lg"
                style={{ width: escenario.w, height: escenario.h, left: 8 + (libre.w - escenario.w) / 2, top: 8 + (libre.h - escenario.h) / 2 }}
              >
                <img src={foto.url} alt="Tu espacio" className="absolute inset-0 h-full w-full" draggable={false} />
                <model-viewer
                  ref={visorRef}
                  src={src}
                  alt={alt}
                  camera-orbit={`${giro}deg 78deg auto`}
                  environment-image="neutral"
                  exposure={brillo}
                  shadow-intensity={sombra ? 1 : 0}
                  shadow-softness="0.9"
                  interaction-prompt="none"
                  disable-zoom
                  disable-pan
                  style={{
                    position: "absolute", left: caja.left, top: caja.top, width: caja.lado, height: caja.lado,
                    background: "transparent", opacity: cargado ? 1 : 0, transition: "opacity .3s", pointerEvents: "none",
                  }}
                />
                {/* Capa de gestos: sobre toda la foto, para no chocar con el visor */}
                <div
                  ref={capaRef}
                  className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
                  onPointerDown={alPresionar}
                  onPointerMove={alMover}
                  onPointerUp={alSoltar}
                  onPointerCancel={alSoltar}
                  aria-label="Arrastra para mover el mueble sobre la foto"
                  role="application"
                />
                {!cargado && !fallo && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center" role="status" aria-label="Cargando el modelo 3D">
                    <Loader2 className="h-8 w-8 animate-spin" style={{ color: MARFIL }} />
                  </div>
                )}
                {fallo && (
                  <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm" style={{ background: "rgba(30,38,33,.8)" }}>
                    No se pudo cargar el modelo 3D. Vuelve a la sala o mira las fotos del producto.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Controles */}
          <div className="max-h-[46dvh] overflow-y-auto p-3 sm:p-4" style={{ background: "rgba(245,241,232,.97)", color: TEXTO }}>
            <div className="mx-auto grid w-full max-w-4xl gap-x-5 gap-y-1 sm:grid-cols-3">
              <label className="flex flex-col text-xs font-medium">
                Tamaño
                <input
                  type="range" className={BARRA} min={TAMANO_MIN} max={TAMANO_MAX} step={0.01} value={tamano}
                  onChange={(e) => setTamano(limitarTamano(Number(e.target.value)))}
                  aria-valuetext={`${Math.round((tamano / TAMANO_INICIAL) * 100)} %`}
                />
              </label>
              <label className="flex flex-col text-xs font-medium">
                Giro: {Math.round(giro)}°
                <input
                  type="range" className={BARRA} min={0} max={359} step={1} value={giro}
                  onChange={(e) => setGiro(normalizarGiro(Number(e.target.value)))}
                />
              </label>
              <label className="flex flex-col text-xs font-medium">
                Brillo
                <input
                  type="range" className={BARRA} min={BRILLO_MIN} max={BRILLO_MAX} step={0.01} value={brillo}
                  onChange={(e) => setBrillo(limitarBrillo(Number(e.target.value)))}
                  aria-valuetext={`${Math.round(brillo * 100)} %`}
                />
              </label>
            </div>

            <div className="mx-auto mt-2 flex w-full max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium">Color del tapizado: {PALETA_TAPIZADO.find((c) => c.hex === color)?.nombre ?? "Personalizado"}</span>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color del tapizado">
                  {PALETA_TAPIZADO.map((c) => (
                    <button
                      key={c.nombre} type="button" role="radio" aria-checked={c.hex === color} aria-label={c.nombre} title={c.nombre}
                      onClick={() => onColor(c.hex)}
                      className="h-11 w-11 rounded-full border-2 transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                      style={{
                        background: c.hex ?? "conic-gradient(#d8cfc2, #8a8d90, #d8cfc2)",
                        borderColor: c.hex === color ? VERDE : "rgba(255,255,255,.9)",
                        boxShadow: "0 0 0 1px rgba(0,0,0,.25)",
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button" aria-pressed={sombra} onClick={() => setSombra((s) => !s)} className={`${BOTON} border`}
                  style={{ borderColor: "#8B735B", background: sombra ? "#D8C3A5" : "transparent", color: TEXTO }}
                >
                  Sombra
                </button>
                <button type="button" onClick={() => void generar("descargar")} disabled={!cargado || generando} className={`${BOTON} disabled:opacity-50`} style={{ background: VERDE, color: MARFIL }}>
                  {generando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
                  Descargar
                </button>
                {puedeCompartir && (
                  <button type="button" onClick={() => void generar("compartir")} disabled={!cargado || generando} className={`${BOTON} border disabled:opacity-50`} style={{ borderColor: VERDE, color: VERDE }}>
                    <Share2 className="h-4 w-4" aria-hidden />
                    Compartir
                  </button>
                )}
                <label className={`${BOTON} cursor-pointer border`} style={{ borderColor: "#8B735B", color: TEXTO }}>
                  <ImagePlus className="h-4 w-4" aria-hidden />
                  Cambiar foto
                  <input
                    type="file" accept="image/*" className="sr-only"
                    onChange={(e) => { void alElegirFoto(e.target.files?.[0]); e.target.value = ""; }}
                  />
                </label>
              </div>
            </div>
            {error && <p role="alert" className="mx-auto mt-2 max-w-4xl text-xs" style={{ color: "#8A3B22" }}>{error}</p>}
            <p className="mx-auto mt-2 max-w-4xl text-xs" style={{ color: "#5b564d" }}>
              Simulación referencial: el tamaño es visual, no a escala real. Tu foto se queda en tu dispositivo.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
