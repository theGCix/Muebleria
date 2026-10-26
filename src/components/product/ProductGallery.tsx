// src/components/product/ProductGallery.tsx
// Galería "showroom": tarjeta con inclinación 3D y brillo que sigue al cursor, aura de color tomada de la
// propia foto, transición deslizante, barra de progreso, deslizar (swipe), teclado y lightbox con zoom.
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import "./product-experience.css";

interface Props {
  images: string[];
  alt: string;
  index: number;
  onIndexChange: (i: number) => void;
  /** Modo "noche" (luz LED) de la ficha: oscurece la foto y enciende el brillo cálido. */
  night?: boolean;
  /** Insignias (categoría, oferta, nuevo) que se dibujan sobre la foto. */
  children?: React.ReactNode;
}

const reduceMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function ProductGallery({ images, alt, index, onIndexChange, night = false, children }: Props) {
  const n = images.length;
  const safe = n ? ((index % n) + n) % n : 0;
  const [dir, setDir] = useState<1 | -1>(1);
  const [lightbox, setLightbox] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const press = useRef<{ x: number; moved: boolean } | null>(null);

  const select = useCallback(
    (i: number) => {
      if (!n || i === safe) return;
      setDir(i > safe ? 1 : -1);
      onIndexChange(i);
    },
    [n, safe, onIndexChange],
  );
  const step = useCallback(
    (delta: 1 | -1) => {
      if (n < 2) return;
      setDir(delta);
      onIndexChange((safe + delta + n) % n);
    },
    [n, safe, onIndexChange],
  );

  // Precarga las fotos vecinas para que el deslizamiento sea instantáneo
  useEffect(() => {
    if (n < 2) return;
    [images[(safe + 1) % n], images[(safe - 1 + n) % n]].forEach((src) => {
      const im = new Image();
      im.src = src;
    });
  }, [images, n, safe]);

  // ── Inclinación 3D + brillo (solo ratón, y respetando "reducir movimiento") ──
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || reduceMotion()) return;
    const card = cardRef.current;
    if (!card) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    card.style.setProperty("--rx", `${((0.5 - py) * 7).toFixed(2)}deg`);
    card.style.setProperty("--ry", `${((px - 0.5) * 9).toFixed(2)}deg`);
    card.style.setProperty("--lx", `${(px * 100).toFixed(1)}%`);
    card.style.setProperty("--ly", `${(py * 100).toFixed(1)}%`);
  };
  const onLeave = () => {
    const card = cardRef.current;
    if (!card) return;
    card.style.setProperty("--rx", "0deg");
    card.style.setProperty("--ry", "0deg");
  };

  // ── Deslizar con el dedo / arrastrar ──
  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    press.current = { x: e.clientX, moved: false };
  };
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = press.current;
    press.current = null;
    if (!p) return;
    const dx = e.clientX - p.x;
    if (Math.abs(dx) > 42) step(dx < 0 ? 1 : -1);
    else if ((e.target as HTMLElement).closest("button, a") == null) setLightbox(true);
  };

  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setLightbox(true); }
  };

  if (!n) {
    return (
      <div className="gmg">
        <div className="gmg-stage gmg-empty">🪑</div>
      </div>
    );
  }

  return (
    <div className="gmg">
      {/* Aura: la propia foto, desenfocada, tiñe el fondo detrás de la tarjeta */}
      <div className="gmg-aura" aria-hidden style={{ backgroundImage: `url(${images[safe]})` }} />

      <div
        className={`gmg-stage gmx-stage${night ? " is-night" : ""}`}
        tabIndex={0}
        role="group"
        aria-roledescription="galería"
        aria-label={`${alt}: foto ${safe + 1} de ${n}. Usa las flechas para cambiar y Enter para ampliar.`}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerCancel={() => { press.current = null; }}
        onKeyDown={onKey}
      >
        <div className="gmg-card" ref={cardRef}>
          <img
            key={safe}
            className={`gmg-img ${dir > 0 ? "from-right" : "from-left"}`}
            src={images[safe]}
            alt={alt}
            draggable={false}
          />
          <div className="gmx-glow" />
          <div className="gmg-shine" aria-hidden />
          {children}

          {n > 1 && (
            <div className="gmg-progress" aria-hidden>
              {images.map((_, i) => (
                <span key={i} className={i === safe ? "on" : i < safe ? "done" : ""} />
              ))}
            </div>
          )}

          <div className="gmg-meta">
            {n > 1 && <span className="gmg-count">{safe + 1} / {n}</span>}
            <button type="button" className="gmg-expand" onClick={() => setLightbox(true)} aria-label="Ampliar foto">
              <Expand size={14} /> Ampliar
            </button>
          </div>
        </div>

        {n > 1 && (
          <>
            <button type="button" className="gmg-arrow prev" onClick={() => step(-1)} aria-label="Foto anterior">
              <ChevronLeft size={20} />
            </button>
            <button type="button" className="gmg-arrow next" onClick={() => step(1)} aria-label="Foto siguiente">
              <ChevronRight size={20} />
            </button>
          </>
        )}
      </div>

      {n > 1 && (
        <div className="gmg-rail" role="tablist" aria-label="Miniaturas">
          {images.map((src, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === safe}
              aria-label={`Ver foto ${i + 1}`}
              className={`gmg-thumb${i === safe ? " active" : ""}`}
              onClick={() => select(i)}
            >
              <img src={src} alt="" draggable={false} />
            </button>
          ))}
        </div>
      )}

      {lightbox && (
        <Lightbox
          images={images}
          alt={alt}
          index={safe}
          onClose={() => setLightbox(false)}
          onIndex={(i) => { setDir(i > safe ? 1 : -1); onIndexChange(i); }}
        />
      )}
    </div>
  );
}

/* ─── Lightbox a pantalla completa: flechas, Esc, zoom al tocar ─── */
function Lightbox({
  images, alt, index, onClose, onIndex,
}: { images: string[]; alt: string; index: number; onClose: () => void; onIndex: (i: number) => void }) {
  const n = images.length;
  const [zoom, setZoom] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const go = useCallback(
    (d: 1 | -1) => { setZoom(false); onIndex((index + d + n) % n); },
    [index, n, onIndex],
  );

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" && n > 1) go(1);
      else if (e.key === "ArrowLeft" && n > 1) go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [go, n, onClose]);

  const onImgMove = (e: React.PointerEvent<HTMLImageElement>) => {
    if (!zoom) return;
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
  };

  return createPortal(
    <div className="gmg-lb" role="dialog" aria-modal="true" aria-label={`${alt} — galería ampliada`} onClick={onClose}>
      <button type="button" className="gmg-lb-close" onClick={onClose} aria-label="Cerrar">
        <X size={20} />
      </button>
      <div className="gmg-lb-stage" onClick={(e) => e.stopPropagation()}>
        <img
          ref={imgRef}
          key={index}
          src={images[index]}
          alt={alt}
          draggable={false}
          className={zoom ? "zoomed" : ""}
          onClick={() => setZoom((z) => !z)}
          onPointerMove={onImgMove}
        />
      </div>
      {n > 1 && (
        <>
          <button type="button" className="gmg-lb-arrow prev" onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label="Foto anterior">
            <ChevronLeft size={26} />
          </button>
          <button type="button" className="gmg-lb-arrow next" onClick={(e) => { e.stopPropagation(); go(1); }} aria-label="Foto siguiente">
            <ChevronRight size={26} />
          </button>
        </>
      )}
      <div className="gmg-lb-foot" onClick={(e) => e.stopPropagation()}>
        <span>{index + 1} / {n} · {zoom ? "Toca para alejar" : "Toca la foto para acercar"}</span>
        {n > 1 && (
          <div className="gmg-lb-thumbs">
            {images.map((src, i) => (
              <button key={i} type="button" className={i === index ? "active" : ""} onClick={() => { setZoom(false); onIndex(i); }} aria-label={`Ver foto ${i + 1}`}>
                <img src={src} alt="" draggable={false} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
