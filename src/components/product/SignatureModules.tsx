// src/components/product/SignatureModules.tsx
// El módulo "firma" de cada categoría: una pequeña herramienta que deja al cliente
// comprobar que la pieza encaja en SU casa antes de comprar. Todo es cálculo real
// (geometría y medidas estándar), no datos inventados.
import { useEffect, useId, useState, type ReactNode } from "react";
import type { ProductProfile } from "@/lib/productProfiles";
import "./product-experience.css";

export type SetPref = (key: string, value: string | null) => void;

interface ModuleProps {
  profile: ProductProfile;
  nombre: string;
  subcategoria: string | null;
  setPref: SetPref;
  ambient: boolean;
  setAmbient: (v: boolean) => void;
}

function Shell({ kicker, title, children }: { kicker: string; title: string; children: ReactNode }) {
  return (
    <section className="gmx-module">
      <div className="gmx-module-kicker">{kicker}</div>
      <h3 className="gmx-module-title">{title}</h3>
      {children}
    </section>
  );
}

function Chips<T extends string | number>({
  options, value, onPick, render,
}: { options: readonly T[]; value: T | null; onPick: (v: T) => void; render: (v: T) => string }) {
  return (
    <div className="gmx-chips" role="group">
      {options.map((o) => (
        <button key={String(o)} type="button" className="gmx-chip" aria-pressed={value === o} onClick={() => onPick(o)}>
          {render(o)}
        </button>
      ))}
    </div>
  );
}

/* ═════════════ 1 · TV: medidor de pantalla + modo noche ═════════════ */
const TV_SIZES = [43, 50, 55, 65, 75, 85] as const;
const TV_RATIO = 16 / Math.sqrt(16 ** 2 + 9 ** 2); // ancho/diagonal en 16:9

function TvFit({ setPref, ambient, setAmbient }: ModuleProps) {
  const gid = useId().replace(/:/g, "");
  const [picked, setPicked] = useState<number | null>(null);
  const size = picked ?? 55; // escena por defecto; el chip solo se marca cuando el cliente elige

  const tvW = size * 2.54 * TV_RATIO;                 // cm
  const recW = Math.ceil((tvW * 1.25) / 10) * 10;     // mueble ≥ 25 % más ancho que el TV
  const distMin = (size * 2.54 * 1.2) / 100;          // m
  const distMax = (size * 2.54 * 1.6) / 100;

  const S = 260 / 240;                                // px por cm (escala fija para comparar tamaños)
  const tvPx = tvW * S, tvH = tvPx * 9 / 16, unitPx = recW * S;
  const cx = 160;

  return (
    <Shell kicker="Asegúrate de que encaja" title="¿De cuántas pulgadas es tu TV?">
      <Chips options={TV_SIZES} value={picked} onPick={(v) => { setPicked(v); setPref("Pantalla", `${v}″`); }} render={(v) => `${v}″`} />

      <button type="button" role="switch" aria-checked={ambient} className="gmx-switch" onClick={() => setAmbient(!ambient)}>
        <span className="gmx-switch-track" /> Luz LED ambiente <span style={{ color: "var(--gm-muted)" }}>(míralo de noche en la foto)</span>
      </button>

      <svg className="gmx-viz" viewBox="0 0 320 200" role="img" aria-label={`Un TV de ${size} pulgadas sobre un mueble de ${recW} cm`}>
        <defs>
          <radialGradient id={`g${gid}`} cx="50%" cy="60%" r="60%">
            <stop offset="0" stopColor="#FFB860" stopOpacity={ambient ? 0.75 : 0} />
            <stop offset="1" stopColor="#FFB860" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="320" height="200" fill={ambient ? "#2A211B" : "#F7F4EF"} style={{ transition: "fill .6s" }} />
        <rect x={cx - unitPx / 2 - 14} y="120" width={unitPx + 28} height="70" fill={`url(#g${gid})`} />
        <rect x={cx - tvPx / 2} y={150 - tvH} width={tvPx} height={tvH} rx="3" fill="#15110E" />
        <rect x={cx - tvPx / 2 + 3} y={153 - tvH} width={tvPx - 6} height={tvH - 6} rx="2" fill={ambient ? "#26364a" : "#1d2733"} />
        <rect x={cx - unitPx / 2} y="156" width={unitPx} height="26" rx="3" fill="var(--gm-walnut-mid)" />
        <line x1={cx - unitPx / 2} x2={cx + unitPx / 2} y1="192" y2="192" stroke="var(--gmx-accent)" strokeWidth="1.5" />
        <text x={cx} y="198" textAnchor="middle" fontSize="8" fill={ambient ? "#e9dccb" : "#5A4035"}>{recW} cm</text>
      </svg>

      <p className="gmx-readout">
        Tu TV de {size}″ mide <b>~{Math.round(tvW)} cm</b> de ancho. Te recomendamos un mueble de <b>{recW} cm o más</b> y verlo
        desde <b>{distMin.toFixed(1)} a {distMax.toFixed(1)} m</b>. ¿Tu pared mide otra cosa? Lo hacemos a medida.
      </p>
    </Shell>
  );
}

/* ═════════════ 2 · Comedor: simulador de comensales ═════════════ */
const GUESTS = [2, 4, 6, 8, 10] as const;
const CAPS = [4, 6, 8];

function capacidadDe(nombre: string, sub: string | null): number | null {
  const m = (sub ?? "").match(/(\d+)/) ?? nombre.match(/(\d+)\s*sillas/i);
  return m ? Number(m[1]) : null;
}

function Seating({ nombre, subcategoria, setPref }: ModuleProps) {
  const cap = capacidadDe(nombre, subcategoria);
  const [picked, setPicked] = useState<number | null>(null);
  const g = picked ?? cap ?? 6;

  const dibujados = cap ? Math.min(g, cap) : g;
  const heads = dibujados >= 6 ? 2 : 0;
  const sides = dibujados - heads;
  const top = Math.ceil(sides / 2), bottom = Math.floor(sides / 2);
  const tw = Math.max(110, Math.max(top, bottom) * 42 + 28);
  const tx = 160 - tw / 2, ty = 70, th = 56;

  const chairs: { x: number; y: number }[] = [];
  const place = (n: number, y: number) => {
    for (let i = 0; i < n; i++) chairs.push({ x: tx + (tw / (n + 1)) * (i + 1), y });
  };
  place(top, ty - 16); place(bottom, ty + th + 16);
  if (heads) { chairs.push({ x: tx - 17, y: ty + th / 2 }, { x: tx + tw + 17, y: ty + th / 2 }); }

  const exceso = cap && g > cap ? g - cap : 0;
  const siguiente = CAPS.find((c) => c >= g);
  const ladoCm = Math.ceil(g / 2) * 60;

  return (
    <Shell kicker="Pruébalo antes de comprarlo" title="¿Cuántos se sientan a tu mesa?">
      <Chips options={GUESTS} value={picked} onPick={(v) => { setPicked(v); setPref("Comensales", `${v} personas`); }} render={(v) => `${v} personas`} />

      <svg className="gmx-viz" viewBox="0 0 320 190" role="img" aria-label={`Mesa vista desde arriba con ${dibujados} sillas`}>
        <rect x={tx} y={ty} width={tw} height={th} rx="8" fill="var(--gm-walnut-mid)" />
        <rect x={tx + 5} y={ty + 5} width={tw - 10} height={th - 10} rx="5" fill="none" stroke="rgba(255,255,255,.18)" />
        {chairs.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r="11" fill="var(--gmx-accent)" opacity=".92">
            <animate attributeName="r" from="0" to="11" dur=".25s" begin={`${i * 0.04}s`} fill="freeze" />
          </circle>
        ))}
        <text x="160" y="170" textAnchor="middle" fontSize="10" fill="#5A4035">
          {cap ? `Mesa pensada para ${cap}` : `Mesa de ~${ladoCm} cm de largo`}
        </text>
      </svg>

      <p className="gmx-readout">
        {cap == null && <>Para <b>{g} personas</b> calcula unos <b>{ladoCm} cm</b> de largo (60 cm por comensal). Cuéntanos tu espacio y la hacemos a tu medida.</>}
        {cap != null && !exceso && <>Para <b>{g} personas</b> esta mesa funciona perfecto: queda espacio para fuentes, copas y codos. </>}
        {cap != null && exceso > 0 && (
          <>Esta versión está pensada para <b>{cap}</b>; te faltarían <b>{exceso}</b> lugares. {siguiente
            ? <>Mira los <a href={`/categoria/comedores?sub=${siguiente}-sillas`}>comedores de {siguiente} sillas</a> o pídenos una a medida.</>
            : <>Pídenos una mesa a medida para {g} personas.</>}</>
        )}
      </p>
    </Shell>
  );
}

/* ═════════════ 3 · Recámara: tamaño de cama y espacio libre ═════════════ */
const CAMAS = [
  { k: "1 plaza", w: 0.9, l: 1.9 },
  { k: "1½ plazas", w: 1.05, l: 1.9 },
  { k: "2 plazas", w: 1.4, l: 1.9 },
  { k: "Queen", w: 1.6, l: 2.0 },
  { k: "King", w: 1.95, l: 2.0 },
] as const;

function Sleep({ setPref }: ModuleProps) {
  const [picked, setPicked] = useState<(typeof CAMAS)[number]["k"] | null>(null);
  const k = picked ?? "Queen";
  const cama = CAMAS.find((c) => c.k === k)!;

  const roomW = cama.w + 1.2;      // 60 cm de paso a cada lado
  const roomL = cama.l + 0.6;      // 60 cm a los pies (la cabecera va contra la pared)
  const P = 68;                    // px por metro
  const rx = 160 - (roomW * P) / 2, ry = 14;
  const bw = cama.w * P, bl = cama.l * P, bx = 160 - bw / 2, by = ry;
  const dosAlm = cama.w >= 1.4;

  return (
    <Shell kicker="Pruébalo antes de comprarlo" title="¿Qué tamaño de cama necesitas?">
      <Chips options={CAMAS.map((c) => c.k)} value={picked} onPick={(v) => { setPicked(v); setPref("Tamaño de cama", v); }} render={(v) => v} />

      <svg className="gmx-viz" viewBox="0 0 320 210" role="img" aria-label={`Cama ${k} con espacio libre`}>
        <rect x={rx} y={ry} width={roomW * P} height={roomL * P} fill="none" stroke="var(--gmx-accent)" strokeDasharray="5 4" strokeWidth="1.5" />
        <rect x={bx} y={by} width={bw} height={bl} rx="4" fill="#fff" stroke="var(--gm-walnut-mid)" strokeWidth="1.5" />
        <rect x={bx - 4} y={by - 6} width={bw + 8} height="9" rx="3" fill="var(--gm-walnut-mid)" />
        {dosAlm ? (
          <>
            <rect x={bx + bw * 0.08} y={by + 10} width={bw * 0.38} height="18" rx="6" fill="var(--gmx-accent-soft)" stroke="var(--gm-border)" />
            <rect x={bx + bw * 0.54} y={by + 10} width={bw * 0.38} height="18" rx="6" fill="var(--gmx-accent-soft)" stroke="var(--gm-border)" />
          </>
        ) : (
          <rect x={bx + bw * 0.15} y={by + 10} width={bw * 0.7} height="18" rx="6" fill="var(--gmx-accent-soft)" stroke="var(--gm-border)" />
        )}
        <text x="160" y={by + bl / 2 + 4} textAnchor="middle" fontSize="11" fill="#5A4035">{cama.w.toFixed(2)} × {cama.l.toFixed(2)} m</text>
        <text x="160" y={ry + roomL * P + 16} textAnchor="middle" fontSize="9" fill="var(--gmx-accent)">espacio libre recomendado</text>
      </svg>

      <p className="gmx-readout">
        Un colchón <b>{k}</b> mide <b>{cama.w.toFixed(2)} × {cama.l.toFixed(2)} m</b>. Para moverte con comodidad
        necesitas un cuarto de al menos <b>{roomW.toFixed(1)} × {roomL.toFixed(1)} m</b> libres alrededor.
        Confirmamos medidas exactas y disponibilidad al cotizar.
      </p>
    </Shell>
  );
}

/* ═════════════ 4 · Sala: firmeza + patas ═════════════ */
const FIRMEZAS = [
  { k: "Suave", dent: 14, txt: "Te hundes un poco: sensación envolvente, ideal para tardes de película." },
  { k: "Equilibrado", dent: 8, txt: "El punto medio: cómodo para sentarte horas y fácil para levantarte." },
  { k: "Firme", dent: 3, txt: "Apoyo marcado: buena postura para la espalda y para recibir visitas." },
] as const;
const PATAS = [
  { k: "Dorado", hex: "#C9A96E" },
  { k: "Negro", hex: "#2B2623" },
] as const;

function Comfort({ setPref }: ModuleProps) {
  const [f, setF] = useState<(typeof FIRMEZAS)[number]>(FIRMEZAS[1]);
  const [p, setP] = useState<(typeof PATAS)[number]["k"]>("Dorado");

  // En la sala, firmeza y patas son opciones del pedido: registramos el valor por defecto desde el inicio
  useEffect(() => { setPref("Firmeza", FIRMEZAS[1].k); setPref("Patas", PATAS[0].k); }, [setPref]);

  const y0 = 62, mid = 160;
  return (
    <Shell kicker="Hazlo tuyo" title="¿Cómo te gusta sentarte?">
      <Chips options={FIRMEZAS.map((x) => x.k)} value={f.k} onPick={(v) => { const n = FIRMEZAS.find((x) => x.k === v)!; setF(n); setPref("Firmeza", v); }} render={(v) => v} />

      <svg className="gmx-viz" viewBox="0 0 320 120" role="img" aria-label={`Cojín con firmeza ${f.k}`}>
        <rect x="40" y="76" width="240" height="26" rx="10" fill="var(--gmx-accent-soft)" stroke="var(--gm-border)" />
        <path d={`M40 ${y0} Q ${mid} ${y0 + f.dent * 2} 280 ${y0} L 280 86 L 40 86 Z`} fill="#fff" stroke="var(--gm-walnut-mid)" strokeWidth="1.5" />
        <circle cx={mid} cy={y0 + f.dent - 12} r="12" fill="var(--gmx-accent)" />
        <rect x="52" y="102" width="6" height="12" fill={PATAS.find((x) => x.k === p)!.hex} />
        <rect x="262" y="102" width="6" height="12" fill={PATAS.find((x) => x.k === p)!.hex} />
      </svg>
      <p className="gmx-readout">{f.txt}</p>

      <div className="gm-color-label" style={{ marginTop: 14 }}>Patas de metal</div>
      <div className="gmx-chips">
        {PATAS.map((x) => (
          <button key={x.k} type="button" className="gmx-chip" aria-pressed={p === x.k}
            onClick={() => { setP(x.k); setPref("Patas", x.k); }}>
            <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: x.hex, marginRight: 8, border: "1px solid rgba(0,0,0,.2)" }} />
            {x.k}
          </button>
        ))}
      </div>
    </Shell>
  );
}

/* ═════════════ 5 · Separador: medidas de tu espacio ═════════════ */
const num = (s: string) => parseFloat(s.replace(",", "."));

function CustomSpace({ setPref }: ModuleProps) {
  const [ancho, setAncho] = useState("2.4");
  const [alto, setAlto] = useState("2.6");
  const a = num(ancho), h = num(alto);
  const ok = a >= 0.5 && a <= 8 && h >= 1 && h <= 4;

  useEffect(() => {
    setPref("Espacio a cubrir", ok ? `${a.toFixed(2)} × ${h.toFixed(2)} m` : null);
  }, [ok, a, h, setPref]);

  const k = ok ? Math.min(250 / a, 120 / h) : 1;
  const w = ok ? a * k : 0, hh = ok ? h * k : 0;
  const slats = ok ? Math.max(4, Math.round(a / 0.12)) : 0;

  return (
    <Shell kicker="A la medida de tu espacio" title="¿Qué espacio quieres dividir?">
      <div className="gmx-inputs">
        <div className="gmx-field"><label htmlFor="gmx-ancho">Ancho (m)</label>
          <input id="gmx-ancho" inputMode="decimal" value={ancho} onChange={(e) => setAncho(e.target.value)} /></div>
        <div className="gmx-field"><label htmlFor="gmx-alto">Alto (m)</label>
          <input id="gmx-alto" inputMode="decimal" value={alto} onChange={(e) => setAlto(e.target.value)} /></div>
      </div>

      <svg className="gmx-viz" viewBox="0 0 320 150" role="img" aria-label="Vista frontal del separador">
        {ok && (
          <>
            <rect x={160 - w / 2} y={140 - hh} width={w} height={hh} fill="#fff" stroke="var(--gm-walnut-mid)" strokeWidth="1.5" />
            {Array.from({ length: slats }).map((_, i) => {
              const x = 160 - w / 2 + (w / (slats + 1)) * (i + 1);
              return <line key={i} x1={x} x2={x} y1={140 - hh + 4} y2={136} stroke="var(--gm-walnut-mid)" strokeWidth="3" opacity=".85" />;
            })}
          </>
        )}
        <line x1="20" x2="300" y1="141" y2="141" stroke="var(--gmx-accent)" strokeWidth="1.5" />
      </svg>

      <p className="gmx-readout">
        {ok
          ? <>Superficie a cubrir: <b>{(a * h).toFixed(1)} m²</b>. Guardamos estas medidas en tu cotización para que un asesor ajuste el diseño.</>
          : <>Ingresa un ancho entre 0.5 y 8 m, y un alto entre 1 y 4 m.</>}
      </p>
    </Shell>
  );
}

/* ═════════════ Selector ═════════════ */
export function SignatureModule(props: ModuleProps) {
  switch (props.profile.module) {
    case "tv-fit": return <TvFit {...props} />;
    case "seating": return <Seating {...props} />;
    case "sleep": return <Sleep {...props} />;
    case "comfort": return <Comfort {...props} />;
    case "custom-space": return <CustomSpace {...props} />;
    default: return null;
  }
}
