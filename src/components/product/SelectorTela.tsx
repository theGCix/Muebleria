// src/components/product/SelectorTela.tsx
// Selector de tapizado de las vistas 3D: primero el TIPO de tela (36, en 5 categorías) y luego el TONO.
// Devuelve un solo valor —el hex con el que se pinta el modelo— para que los visores no cambien de contrato.
// `compacto`: barra de la sala / «Mi espacio» (tira de muestras con scroll); sin él: rejilla con nombres (visor de la ficha).
import { useEffect, useId, useState } from "react";
import type { Tapizado } from "@/lib/tapizado3d";
import {
  CATEGORIAS_TELA, TONOS, buscarTela, buscarTono, hexTapizado, nombreTapizado, telasDeCategoria,
  type Tela, type Tono,
} from "@/lib/telas";

interface Props {
  value: Tapizado;
  onChange: (sel: Tapizado) => void;
  compacto?: boolean;
  /** Color de acento (borde de lo elegido y chip activo); por defecto el primario del tema. */
  acento?: string;
  /** Color del texto sobre el fondo donde se coloca. */
  texto?: string;
}

export function SelectorTela({ value, onChange, compacto = false, acento = "var(--primary)", texto = "inherit" }: Props) {
  const uid = useId();
  // Tono que corresponde a la selección que llega de fuera (por su hex; «Original» si no coincide con ninguno)
  const tonoDe = (v: Tapizado) => TONOS.find((t) => t.hex && t.hex.toLowerCase() === v.tonoHex?.toLowerCase())?.id
    ?? (v.telaId ? "original" : TONOS.find((t) => t.hex && t.hex.toLowerCase() === v.hex?.toLowerCase())?.id ?? "original");
  const [telaId, setTelaId] = useState<string | null>(value.telaId);
  const [tonoId, setTonoId] = useState<string>(tonoDe(value));
  const [categoria, setCategoria] = useState<number>(buscarTela(value.telaId)?.categoria ?? CATEGORIAS_TELA[0].id);

  // Si otra vista (o la ficha) cambia la selección, se refleja aquí
  useEffect(() => {
    setTelaId(value.telaId);
    setTonoId(tonoDe(value));
    const t = buscarTela(value.telaId);
    if (t) setCategoria(t.categoria);
  }, [value.telaId, value.tonoHex, value.hex]); // eslint-disable-line react-hooks/exhaustive-deps

  const tela = buscarTela(telaId);
  const tono = buscarTono(tonoId);

  const elegir = (t: Tela | null, n: Tono | null) => {
    onChange({ telaId: t?.id ?? null, imagen: t?.imagen ?? null, tonoHex: n?.hex ?? null, hex: hexTapizado(t, n) });
  };
  const alElegirTela = (t: Tela) => {
    // Al cambiar de tela se parte del color propio de la tela; el tono se elige después
    setTelaId(t.id);
    setTonoId("original");
    elegir(t, buscarTono("original"));
  };
  const alElegirTono = (n: Tono) => {
    setTonoId(n.id);
    elegir(tela, n);
  };
  const quitarTela = () => {
    setTelaId(null);
    setTonoId("original");
    elegir(null, buscarTono("original"));
  };

  const enCategoria = telasDeCategoria(categoria);
  const lado = compacto ? "w-10 h-10" : "w-14 h-14";
  const anillo = (activo: boolean) => ({
    borderColor: activo ? acento : "rgba(255,255,255,0.9)",
    boxShadow: activo ? `0 0 0 1px ${acento}` : "0 0 0 1px rgba(0,0,0,0.25)",
  });

  return (
    <div className="flex min-w-0 flex-col gap-2" style={{ color: texto }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span id={`${uid}-titulo`} className="text-xs font-medium">
          Tapizado: {nombreTapizado(tela, tono)}
        </span>
        {tela && (
          <button
            type="button"
            onClick={quitarTela}
            className="min-h-8 rounded-md px-2 text-[11px] underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Quitar tela
          </button>
        )}
      </div>

      {/* Tipo de tela: categorías + muestras */}
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Categoría de tela">
        {CATEGORIAS_TELA.map((c) => {
          const activa = c.id === categoria;
          return (
            <button
              key={c.id}
              type="button"
              role="tab"
              id={`${uid}-cat-${c.id}`}
              aria-selected={activa}
              aria-controls={`${uid}-telas`}
              onClick={() => setCategoria(c.id)}
              className="min-h-8 rounded-full border px-3 text-[11px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ borderColor: acento, background: activa ? acento : "transparent", color: activa ? "#fff" : "inherit" }}
            >
              {c.nombre}
            </button>
          );
        })}
      </div>

      <div
        id={`${uid}-telas`}
        role="radiogroup"
        aria-labelledby={`${uid}-titulo`}
        aria-label="Tipo de tela"
        className={compacto ? "flex gap-2 overflow-x-auto pb-1" : "grid grid-cols-3 gap-2 sm:grid-cols-6"}
      >
        {enCategoria.map((t) => {
          const activa = t.id === telaId;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={activa}
              aria-label={`${t.nombre}: ${t.descripcion}`}
              title={`${t.nombre} · ${t.descripcion}`}
              onClick={() => alElegirTela(t)}
              className={`flex shrink-0 flex-col items-center gap-1 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${compacto ? "" : "p-1"}`}
            >
              <img
                src={t.imagen}
                alt=""
                loading="lazy"
                draggable={false}
                className={`${lado} rounded-lg border-2 object-cover transition-transform hover:scale-105`}
                style={anillo(activa)}
              />
              {!compacto && <span className="text-center text-[10px] leading-tight">{t.nombre}</span>}
            </button>
          );
        })}
      </div>

      {/* Tono */}
      <div className="flex flex-col gap-1">
        <span className="text-[11px] opacity-80">Tono{tela ? ` para ${tela.nombre}` : ""}</span>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tono del tapizado">
          {TONOS.map((n) => {
            const activo = n.id === tonoId;
            const fondo = n.hex ?? tela?.hex ?? null;
            return (
              <button
                key={n.id}
                type="button"
                role="radio"
                aria-checked={activo}
                aria-label={n.hex ? n.nombre : tela ? `${n.nombre} de la tela` : "Color original del modelo"}
                title={n.nombre}
                onClick={() => alElegirTono(n)}
                className={`${compacto ? "h-11 w-11" : "h-7 w-7"} rounded-full border-2 transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2`}
                style={{ background: fondo ?? "conic-gradient(#d8cfc2, #8a8d90, #d8cfc2)", ...anillo(activo) }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
