// src/components/product/ProbarEnTuEspacio.tsx
// «Pruébalo en tu espacio»: el cliente sube una foto de su sala o dormitorio y coloca el mueble encima.
//  1. Foto: se queda en el dispositivo (no se sube a ningún servidor).
//  2. Escala: marca dos puntos sobre algo de medida conocida (p. ej. una puerta de 210 cm) y el mueble
//     se dibuja con su ancho real. Se puede omitir y ajustar a ojo.
//  3. Colocar: arrastrar, cambiar tamaño, voltear, sombra, probar acabados y descargar la imagen.
// Es una simulación 2D (sin perspectiva ni luz): la pantalla lo avisa.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Check, Download, FlipHorizontal2, ImagePlus, Loader2, RotateCcw, Ruler, Share2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { Pieza } from "@/lib/piezas";
import {
  AJUSTE_MAX,
  AJUSTE_MIN,
  REFERENCIAS,
  anchoFraccion,
  clamp,
  etiquetaMedida,
  piezaPrincipal,
  pxPorCm,
  quitarFondo,
  razonProporcion,
  type Punto,
} from "@/lib/escenaEspacio";

export interface AcabadoEspacio {
  id: string;
  nombre: string;
  hex: string | null;
  /** Foto del producto con este acabado (de preferencia sobre fondo liso). */
  img: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nombre: string;
  piezas: Pieza[];
  acabados: AcabadoEspacio[];
  /** Índice del acabado que el cliente ya tenía elegido en la ficha. */
  acabadoInicial?: number;
}

interface FotoCliente {
  img: HTMLImageElement;
  url: string;
  w: number;
  h: number;
}

interface RecorteListo {
  url: string; // dataURL (PNG con transparencia) o foto original si no se pudo recortar
  canvas: HTMLCanvasElement | HTMLImageElement;
  w: number;
  h: number;
  fondoQuitado: boolean;
}

const MAX_LADO = 1600;
const MAX_RECORTE = 900;

/** Carga una imagen; con crossOrigin anónimo para poder leer sus píxeles (Cloudinary lo permite). */
function cargarImagen(src: string, cors = false): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    if (cors) im.crossOrigin = "anonymous";
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error("No se pudo cargar la imagen"));
    im.src = src;
  });
}

/** Foto del cliente → imagen reducida a MAX_LADO (las fotos de celular pesan 10+ MB). */
async function prepararFoto(file: File): Promise<FotoCliente> {
  const origen = URL.createObjectURL(file);
  try {
    const im = await cargarImagen(origen);
    const k = Math.min(1, MAX_LADO / Math.max(im.naturalWidth, im.naturalHeight));
    const w = Math.round(im.naturalWidth * k);
    const h = Math.round(im.naturalHeight * k);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d")!.drawImage(im, 0, 0, w, h);
    const url = c.toDataURL("image/jpeg", 0.9);
    return { img: await cargarImagen(url), url, w, h };
  } finally {
    URL.revokeObjectURL(origen);
  }
}

/** Foto del producto → recorte con fondo transparente. Si no se puede, devuelve la foto tal cual. */
async function prepararRecorte(src: string): Promise<RecorteListo> {
  try {
    const im = await cargarImagen(src, true);
    const k = Math.min(1, MAX_RECORTE / Math.max(im.naturalWidth, im.naturalHeight));
    const w = Math.round(im.naturalWidth * k);
    const h = Math.round(im.naturalHeight * k);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(im, 0, 0, w, h);
    const px = ctx.getImageData(0, 0, w, h); // lanza si el canvas quedó «tainted» por CORS
    const r = quitarFondo(px.data, w, h);
    if (!r.fondoQuitado) return { url: src, canvas: im, w: im.naturalWidth, h: im.naturalHeight, fondoQuitado: false };
    const out = document.createElement("canvas");
    out.width = r.width;
    out.height = r.height;
    out.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(r.data), r.width, r.height), 0, 0);
    return { url: out.toDataURL("image/png"), canvas: out, w: r.width, h: r.height, fondoQuitado: true };
  } catch {
    const im = await cargarImagen(src);
    return { url: src, canvas: im, w: im.naturalWidth, h: im.naturalHeight, fondoQuitado: false };
  }
}

type Paso = "foto" | "escala" | "colocar";

export function ProbarEnTuEspacio({ open, onOpenChange, nombre, piezas, acabados, acabadoInicial = 0 }: Props) {
  const [paso, setPaso] = useState<Paso>("foto");
  const [foto, setFoto] = useState<FotoCliente | null>(null);
  const [cargandoFoto, setCargandoFoto] = useState(false);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);

  // Escala
  const [refId, setRefId] = useState<(typeof REFERENCIAS)[number]["id"]>("puerta");
  const [refLibre, setRefLibre] = useState("");
  const [puntos, setPuntos] = useState<Punto[]>([]);
  const [escala, setEscala] = useState<number | null>(null); // px de la foto por cm

  // Colocación
  const [pos, setPos] = useState<Punto>({ x: 0.5, y: 0.72 });
  const [ajuste, setAjuste] = useState(1);
  const [volteado, setVolteado] = useState(false);
  const [sombra, setSombra] = useState(true);
  const [acabadoIdx, setAcabadoIdx] = useState(acabadoInicial);
  const [piezaIdx, setPiezaIdx] = useState(0);

  const [recorte, setRecorte] = useState<RecorteListo | null>(null);
  const [cargandoRecorte, setCargandoRecorte] = useState(false);
  const cache = useRef(new Map<string, RecorteListo>());
  const escenaRef = useRef<HTMLDivElement>(null);
  const arrastre = useRef<{ dx: number; dy: number } | null>(null);

  const conMedidas = useMemo(() => piezas.filter((p) => p.ancho_cm !== null), [piezas]);
  const pieza: Pieza | null = conMedidas[piezaIdx] ?? piezaPrincipal(piezas);
  const acabado = acabados[acabadoIdx] ?? acabados[0];

  // Al abrir: acabado que ya tenía elegido y la pieza más ancha por defecto
  useEffect(() => {
    if (!open) return;
    setAcabadoIdx(clamp(acabadoInicial, 0, Math.max(0, acabados.length - 1)));
    const principal = piezaPrincipal(piezas);
    setPiezaIdx(Math.max(0, conMedidas.findIndex((p) => p === principal)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Recorte del acabado elegido (con caché por URL)
  useEffect(() => {
    if (!open || !acabado) return;
    const hit = cache.current.get(acabado.img);
    if (hit) {
      setRecorte(hit);
      return;
    }
    let vivo = true;
    setCargandoRecorte(true);
    prepararRecorte(acabado.img)
      .then((r) => {
        cache.current.set(acabado.img, r);
        if (vivo) setRecorte(r);
      })
      .catch(() => vivo && setRecorte(null))
      .finally(() => vivo && setCargandoRecorte(false));
    return () => {
      vivo = false;
    };
  }, [open, acabado?.img]);

  const reiniciar = useCallback(() => {
    setPaso("foto");
    setFoto(null);
    setPuntos([]);
    setEscala(null);
    setPos({ x: 0.5, y: 0.72 });
    setAjuste(1);
    setVolteado(false);
    setErrorFoto(null);
  }, []);

  const alElegirFoto = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrorFoto("Elige una imagen (JPG, PNG o foto del celular).");
      return;
    }
    setErrorFoto(null);
    setCargandoFoto(true);
    try {
      setFoto(await prepararFoto(file));
      setPuntos([]);
      setEscala(null);
      setPaso("escala");
    } catch {
      setErrorFoto("No pudimos abrir esa foto. Prueba con otra.");
    } finally {
      setCargandoFoto(false);
    }
  };

  /* ── Escala ── */
  const refCm = refId === "puerta" ? 210 : Number(refLibre.replace(",", "."));
  const escalaPrevia = foto && puntos.length === 2 ? pxPorCm(puntos[0], puntos[1], foto.w, foto.h, refCm) : null;

  const marcarPunto = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const p = { x: clamp((e.clientX - r.left) / r.width, 0, 1), y: clamp((e.clientY - r.top) / r.height, 0, 1) };
    setPuntos((prev) => (prev.length >= 2 ? [p] : [...prev, p]));
  };

  /* ── Colocar ── */
  const anchoCm = pieza?.ancho_cm ?? null;
  const calibrada = escala !== null && anchoCm !== null;
  const wFrac = foto ? anchoFraccion(anchoCm, escala, foto.w) * ajuste : 0;
  const razon = recorte?.fondoQuitado ? razonProporcion(recorte.w, recorte.h, anchoCm, pieza?.alto_cm ?? null) : null;
  const enAngulo = razon !== null && (razon < 0.75 || razon > 1.3);

  const iniciarArrastre = (e: React.PointerEvent<HTMLImageElement>) => {
    const r = escenaRef.current?.getBoundingClientRect();
    if (!r) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    arrastre.current = { dx: (e.clientX - r.left) / r.width - pos.x, dy: (e.clientY - r.top) / r.height - pos.y };
  };
  const moverArrastre = (e: React.PointerEvent<HTMLImageElement>) => {
    const r = escenaRef.current?.getBoundingClientRect();
    if (!r || !arrastre.current) return;
    setPos({
      x: clamp((e.clientX - r.left) / r.width - arrastre.current.dx, 0, 1),
      y: clamp((e.clientY - r.top) / r.height - arrastre.current.dy, 0, 1),
    });
  };
  const moverConTeclado = (e: React.KeyboardEvent) => {
    const paso = e.shiftKey ? 0.05 : 0.01;
    const d: Record<string, [number, number]> = { ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, -paso], ArrowDown: [0, paso] };
    const m = d[e.key];
    if (!m) return;
    e.preventDefault();
    setPos((p) => ({ x: clamp(p.x + m[0], 0, 1), y: clamp(p.y + m[1], 0, 1) }));
  };

  /* ── Exportar ── */
  const componer = async (): Promise<Blob | null> => {
    if (!foto || !recorte) return null;
    const c = document.createElement("canvas");
    c.width = foto.w;
    c.height = foto.h;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(foto.img, 0, 0, foto.w, foto.h);
    const wPx = wFrac * foto.w;
    const hPx = wPx * (recorte.h / recorte.w);
    ctx.save();
    ctx.translate(pos.x * foto.w, pos.y * foto.h);
    if (volteado) ctx.scale(-1, 1);
    if (sombra) {
      ctx.shadowColor = "rgba(0,0,0,0.28)";
      ctx.shadowBlur = Math.max(6, wPx * 0.025);
      ctx.shadowOffsetY = Math.max(3, wPx * 0.012);
    }
    if (!recorte.fondoQuitado) ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(recorte.canvas, -wPx / 2, -hPx / 2, wPx, hPx);
    ctx.restore();
    ctx.font = `${Math.max(12, Math.round(foto.w * 0.016))}px sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.textAlign = "right";
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 4;
    ctx.fillText("G&M Mueblería · simulación referencial", foto.w - 12, foto.h - 12);
    return new Promise((res) => c.toBlob((b) => res(b), "image/jpeg", 0.92));
  };

  const nombreArchivo = `${nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "mueble"}-en-mi-espacio.jpg`;

  const descargar = async () => {
    const blob = await componer();
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nombreArchivo;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const puedeCompartir = typeof navigator !== "undefined" && typeof navigator.canShare === "function";
  const compartir = async () => {
    const blob = await componer();
    if (!blob) return;
    const file = new File([blob], nombreArchivo, { type: "image/jpeg" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: nombre, text: `Así quedaría ${nombre} en mi espacio` });
      } catch {
        /* el cliente cerró el menú de compartir */
      }
    } else {
      void descargar();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] w-[calc(100vw-1rem)] max-w-5xl gap-0 overflow-y-auto p-0 sm:rounded-2xl">
        <div className="border-b border-border/60 px-5 py-4 pr-12">
          <DialogTitle className="font-display text-xl font-normal tracking-normal">Pruébalo en tu espacio</DialogTitle>
          <DialogDescription className="mt-1 text-sm">
            {paso === "foto" && "Sube una foto de tu sala o dormitorio y mira cómo quedaría."}
            {paso === "escala" && "Marca dos puntos sobre algo que mida lo que ya sabes, para dibujar el mueble a su tamaño real."}
            {paso === "colocar" && "Arrastra el mueble hasta donde lo quieres. Tu foto se queda en tu dispositivo."}
          </DialogDescription>
        </div>

        {/* ───── Paso 1: foto ───── */}
        {paso === "foto" && (
          <div className="grid gap-4 p-5 sm:p-8">
            <label className="flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-muted/50 px-6 py-10 text-center transition-colors hover:border-primary focus-within:ring-2 focus-within:ring-ring">
              {cargandoFoto ? (
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
              ) : (
                <ImagePlus className="h-8 w-8 text-primary" aria-hidden />
              )}
              <span className="t-producto">{cargandoFoto ? "Preparando tu foto…" : "Subir o tomar una foto"}</span>
              <span className="t-apoyo max-w-sm text-muted-foreground">
                Mejor de frente a la pared donde irá el mueble, con el piso a la vista.
              </span>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                data-testid="subir-foto"
                onChange={(e) => {
                  void alElegirFoto(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            {errorFoto && (
              <p role="alert" className="text-sm text-destructive">
                {errorFoto}
              </p>
            )}
            <p className="t-apoyo flex items-center justify-center gap-1.5 text-muted-foreground">
              <Camera className="h-3.5 w-3.5" aria-hidden /> No subimos tu foto: se procesa solo en tu dispositivo.
            </p>
          </div>
        )}

        {/* ───── Paso 2: escala ───── */}
        {paso === "escala" && foto && (
          <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[1.6fr_1fr]">
            <div
              onPointerDown={marcarPunto}
              className="relative cursor-crosshair touch-none select-none self-start overflow-hidden rounded-xl bg-muted"
              data-testid="foto-escala"
            >
              <img src={foto.url} alt="Tu espacio" className="block w-full" draggable={false} />
              <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
                {puntos.length === 2 && (
                  <line x1={puntos[0].x * 100} y1={puntos[0].y * 100} x2={puntos[1].x * 100} y2={puntos[1].y * 100} stroke="white" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
                )}
              </svg>
              {puntos.map((p, i) => (
                <span
                  key={i}
                  aria-hidden
                  className="pointer-events-none absolute grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-accent-strong text-[11px] font-bold text-accent-foreground shadow"
                  style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
                >
                  {i + 1}
                </span>
              ))}
            </div>

            <div className="space-y-4">
              <fieldset>
                <legend className="t-producto mb-2">¿Qué vas a medir en la foto?</legend>
                <div className="flex flex-wrap gap-2">
                  {REFERENCIAS.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      aria-pressed={refId === r.id}
                      onClick={() => setRefId(r.id)}
                      className={`min-h-[44px] rounded-full border px-4 text-sm transition-colors ${refId === r.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary"}`}
                    >
                      {r.nombre}
                      {r.cm ? ` (${r.cm} cm)` : ""}
                    </button>
                  ))}
                </div>
                {refId === "libre" && (
                  <label className="mt-3 flex items-center gap-2 text-sm">
                    Mide
                    <input
                      inputMode="decimal"
                      value={refLibre}
                      onChange={(e) => setRefLibre(e.target.value)}
                      placeholder="p. ej. 80"
                      aria-label="Medida real en centímetros"
                      className="h-11 w-24 rounded-lg border border-input bg-card px-3"
                    />
                    cm
                  </label>
                )}
              </fieldset>

              <p className="t-texto text-muted-foreground" aria-live="polite">
                {puntos.length === 0 && "Toca en la foto el punto 1 (por ejemplo, el piso al pie de la puerta)."}
                {puntos.length === 1 && "Ahora toca el punto 2 (el borde superior de la puerta)."}
                {puntos.length === 2 && (escalaPrevia ? "Listo. Si no quedó bien, toca otra vez para marcar de nuevo." : "Los puntos están muy juntos o falta la medida.")}
              </p>

              <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                <Button
                  type="button"
                  className="h-11 rounded-full"
                  disabled={!escalaPrevia}
                  onClick={() => {
                    setEscala(escalaPrevia);
                    setPaso("colocar");
                  }}
                >
                  <Ruler className="mr-2 h-4 w-4" aria-hidden /> Usar esta medida
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 rounded-full"
                  onClick={() => {
                    setEscala(null);
                    setPaso("colocar");
                  }}
                >
                  Omitir y ajustar a ojo
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ───── Paso 3: colocar ───── */}
        {paso === "colocar" && foto && (
          <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[1.6fr_1fr]">
            <div
              ref={escenaRef}
              className="relative touch-none select-none self-start overflow-hidden rounded-xl bg-muted"
              data-testid="escena"
            >
              <img src={foto.url} alt="Tu espacio" className="block w-full" draggable={false} />
              {recorte && (
                <img
                  src={recorte.url}
                  alt={`${nombre}${acabado ? `, acabado ${acabado.nombre}` : ""}, colocado en tu foto. Arrástralo o usa las flechas del teclado para moverlo.`}
                  tabIndex={0}
                  draggable={false}
                  data-testid="mueble"
                  onPointerDown={iniciarArrastre}
                  onPointerMove={moverArrastre}
                  onPointerUp={() => (arrastre.current = null)}
                  onPointerCancel={() => (arrastre.current = null)}
                  onKeyDown={moverConTeclado}
                  className="absolute cursor-grab touch-none outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring active:cursor-grabbing"
                  style={{
                    left: `${pos.x * 100}%`,
                    top: `${pos.y * 100}%`,
                    width: `${wFrac * 100}%`,
                    transform: `translate(-50%, -50%) scaleX(${volteado ? -1 : 1})`,
                    mixBlendMode: recorte.fondoQuitado ? undefined : "multiply",
                    filter: sombra ? "drop-shadow(0 6px 8px rgba(0,0,0,0.28))" : undefined,
                  }}
                />
              )}
              {(cargandoRecorte || !recorte) && (
                <div className="absolute inset-0 grid place-items-center bg-background/40" aria-live="polite">
                  <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" aria-label="Preparando el mueble" />
                </div>
              )}
            </div>

            <div className="space-y-4">
              {acabados.length > 1 && (
                <fieldset>
                  <legend className="t-producto mb-2">Acabado: <span className="font-normal text-muted-foreground">{acabado?.nombre}</span></legend>
                  <div className="flex flex-wrap gap-2.5">
                    {acabados.map((a, i) => (
                      <button
                        key={a.id}
                        type="button"
                        aria-pressed={i === acabadoIdx}
                        aria-label={a.nombre}
                        title={a.nombre}
                        onClick={() => setAcabadoIdx(i)}
                        className={`grid h-11 w-11 place-items-center rounded-full border-2 transition-shadow ${i === acabadoIdx ? "border-primary ring-2 ring-primary/30" : "border-border"}`}
                        style={{ background: a.hex ?? "var(--muted)" }}
                      >
                        {i === acabadoIdx && <Check className="h-4 w-4 text-white mix-blend-difference" aria-hidden />}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}

              {conMedidas.length > 1 && (
                <label className="block text-sm">
                  <span className="t-producto mb-1.5 block">Pieza</span>
                  <select
                    value={piezaIdx}
                    onChange={(e) => setPiezaIdx(Number(e.target.value))}
                    className="h-11 w-full rounded-lg border border-input bg-card px-3"
                  >
                    {conMedidas.map((p, i) => (
                      <option key={`${p.nombre}-${i}`} value={i}>
                        {p.nombre} · {p.ancho_cm} cm
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="block">
                <span className="t-producto mb-1.5 flex items-center justify-between">
                  Tamaño <span className="t-apoyo font-normal text-muted-foreground">{(calibrada ? etiquetaMedida(anchoCm, ajuste) : null) ?? `a ojo · ${Math.round(ajuste * 100)} %`}</span>
                </span>
                <input
                  type="range"
                  min={AJUSTE_MIN}
                  max={AJUSTE_MAX}
                  step={0.01}
                  value={ajuste}
                  onChange={(e) => setAjuste(Number(e.target.value))}
                  className="h-11 w-full accent-[var(--primary)]"
                  aria-label="Tamaño del mueble"
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="h-11 rounded-full" onClick={() => setVolteado((v) => !v)} aria-pressed={volteado}>
                  <FlipHorizontal2 className="mr-2 h-4 w-4" aria-hidden /> Voltear
                </Button>
                <Button type="button" variant="outline" className="h-11 rounded-full" onClick={() => setSombra((v) => !v)} aria-pressed={sombra}>
                  <Sparkles className="mr-2 h-4 w-4" aria-hidden /> Sombra {sombra ? "sí" : "no"}
                </Button>
                {!calibrada && (
                  <Button type="button" variant="ghost" className="h-11 rounded-full" onClick={() => setPaso("escala")}>
                    <Ruler className="mr-2 h-4 w-4" aria-hidden /> Calibrar tamaño
                  </Button>
                )}
              </div>

              <div className="space-y-1.5 text-xs text-muted-foreground" aria-live="polite">
                {calibrada ? (
                  <p>Tamaño según la medida que marcaste. Si el mueble va más al fondo del cuarto, hazlo un poco más pequeño.</p>
                ) : (
                  <p>Sin calibrar: el tamaño es a ojo. Calibra con una puerta para verlo a escala.</p>
                )}
                {recorte && !recorte.fondoQuitado && <p>Esta foto del producto tiene fondo, por eso se ve con un recuadro. Prueba otro acabado o pídenos una foto sobre fondo liso.</p>}
                {enAngulo && <p>La foto del producto está en ángulo: la medida es aproximada.</p>}
                <p>Simulación referencial en 2D: no incluye perspectiva ni iluminación.</p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                <Button type="button" className="h-11 rounded-full" onClick={descargar} disabled={!recorte}>
                  <Download className="mr-2 h-4 w-4" aria-hidden /> Descargar imagen
                </Button>
                {puedeCompartir && (
                  <Button type="button" variant="outline" className="h-11 rounded-full" onClick={compartir} disabled={!recorte}>
                    <Share2 className="mr-2 h-4 w-4" aria-hidden /> Compartir
                  </Button>
                )}
                <Button type="button" variant="ghost" className="h-11 rounded-full" onClick={reiniciar}>
                  <RotateCcw className="mr-2 h-4 w-4" aria-hidden /> Usar otra foto
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
