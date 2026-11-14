// src/components/EscenaPortada.tsx
// Escena de la portada: una sala pastel (pared con arco, piso y sombra) con la pieza real que
// alcanza con el presupuesto elegido. La foto del producto pierde el fondo en el navegador
// (lib/recorteImagen.ts); si la foto no tiene fondo liso, se muestra como cuadro en la pared.
// No ocupa toda la portada: es una tarjeta que acompaña al texto.
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { prepararRecorte, type RecorteListo } from "@/lib/recorteImagen";
import { fmtPEN } from "@/lib/pricing";

export interface PiezaEscena {
  id: string;
  nombre: string;
  precioFinal: number;
  /** Foto sin recorte de alto (conserva la proporción original). */
  src: string;
}

interface Props {
  pieza: PiezaEscena | null;
  /** Texto del presupuesto activo, p. ej. «De S/ 1,500 a S/ 2,000». */
  etiqueta: string;
  /** Fotos de las otras piezas: se preparan en segundo plano para que el cambio sea instantáneo. */
  precargar?: string[];
  className?: string;
}

// Un recorte por foto durante toda la sesión (evita repetir el trabajo al pasar el cursor)
const cache = new Map<string, RecorteListo>();

function useRecorte(src: string | null) {
  const [recorte, setRecorte] = useState<RecorteListo | null>(() => (src ? (cache.get(src) ?? null) : null));
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    setFallo(false);
    if (!src) {
      setRecorte(null);
      return;
    }
    const guardado = cache.get(src);
    if (guardado) {
      setRecorte(guardado);
      return;
    }
    setRecorte(null);
    let activo = true;
    prepararRecorte(src)
      .then((r) => {
        cache.set(src, r);
        if (activo) setRecorte(r);
      })
      .catch(() => activo && setFallo(true));
    return () => {
      activo = false;
    };
  }, [src]);

  return { recorte, fallo };
}

export function EscenaPortada({ pieza, etiqueta, precargar = [], className = "" }: Props) {
  const { recorte, fallo } = useRecorte(pieza?.src ?? null);

  // Prepara en segundo plano las demás piezas cuando el navegador está libre
  useEffect(() => {
    const pendientes = precargar.filter((s) => s && !cache.has(s));
    if (pendientes.length === 0) return;
    const correr = () => {
      pendientes.forEach((s) =>
        prepararRecorte(s)
          .then((r) => cache.set(s, r))
          .catch(() => undefined),
      );
    };
    // Safari no tiene requestIdleCallback: se usa un temporizador corto
    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (w.requestIdleCallback && w.cancelIdleCallback) {
      const id = w.requestIdleCallback(correr);
      const cancelar = w.cancelIdleCallback;
      return () => cancelar(id);
    }
    const t = window.setTimeout(correr, 1200);
    return () => window.clearTimeout(t);
  }, [precargar.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`escena-portada ${className}`} data-testid="escena-portada">
      <div className="escena-arco" aria-hidden />
      <div className="escena-piso" aria-hidden />

      {pieza && (
        <p className="escena-pildora t-apoyo">
          Lo que alcanza con <span className="font-semibold">{etiqueta.charAt(0).toLowerCase() + etiqueta.slice(1)}</span>
        </p>
      )}

      {pieza && recorte?.fondoQuitado && (
        <>
          <div key={`s-${pieza.id}`} className="escena-sombra" aria-hidden />
          <img key={pieza.id} src={recorte.url} alt={pieza.nombre} className="escena-mueble" />
        </>
      )}
      {pieza && recorte && !recorte.fondoQuitado && (
        <img key={pieza.id} src={pieza.src} alt={pieza.nombre} className="escena-cuadro" />
      )}
      {pieza && !recorte && !fallo && <div className="escena-carga" aria-hidden />}

      {pieza && (
        <Link
          to="/product/$handle"
          params={{ handle: pieza.id }}
          className="escena-etiqueta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <span className="min-w-0">
            <span className="t-producto block truncate">{pieza.nombre}</span>
            <span className="t-precio block text-primary">{fmtPEN(pieza.precioFinal)}</span>
          </span>
          <span className="escena-flecha" aria-hidden>
            <ArrowRight className="h-4 w-4" />
          </span>
          <span className="sr-only">Ver pieza</span>
        </Link>
      )}
    </div>
  );
}
