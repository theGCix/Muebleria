// src/components/checkout/PagoExitoso.tsx
// Pantalla de "pago aprobado". Es el momento de mayor confianza del cliente, así que hace cuatro cosas:
//   1) celebra (ver "bien hecho" en lugar de un modal gris),
//   2) da certeza (qué sigue y cuándo llega, con los MISMOS estados que verá en Mis pedidos),
//   3) resuelve lo inmediato (copiar N°, agregar la entrega al calendario, hablar con un asesor),
//   4) abre la siguiente compra y el boca a boca (otros ambientes + compartir por WhatsApp).
// Todo sale de datos reales del pedido; nada inventado.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Check, Copy, CalendarPlus, MessageCircle, Share2, Truck, Store, MapPin, ShieldCheck,
  PackageCheck, Hammer, BadgeCheck, Sparkles, ArrowRight, CreditCard, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { fmtPEN, ofertaInfo } from "@/lib/pricing";
import { APP_URL, WHATSAPP_NUMBER } from "@/config";
import {
  ENTREGA_MIN_DIAS, ENTREGA_MAX_DIAS, addBusinessDays, fmtDia,
} from "@/lib/entrega";
import "./pago-exitoso.css";

export interface PagoExitosoItem {
  id: string;
  title: string;
  image?: string | null;
  qty: number;
  price: number;
}

export interface PagoExitosoDatos {
  purchase: string;
  date: string;
  amount: string;               // total pagado, p. ej. "2100.00"
  currency?: string;
  nombre?: string;
  email?: string;
  direccion?: string;
  distrito?: string;
  metodoEntrega?: "domicilio" | "recojo_tienda";
  modoEntrega?: "unificada" | "parcial" | null;
  subtotal?: number;
  envio?: number;
  items?: PagoExitosoItem[];
}

const COLORES = ["#6b4423", "#f0a020", "#f3dfb8", "#c8553d", "#8a5a34", "#fff4d6", "#2f6f73"];
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const reduceMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** "carlos PEREZ" → "Carlos" */
function primerNombre(nombre?: string) {
  const n = (nombre ?? "").trim().split(/\s+/)[0];
  if (!n || n === "—") return "";
  return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
}

/** Cuenta de 0 al valor final (respeta "reducir movimiento"). */
function useCountUp(target: number, ms = 1400, delay = 450) {
  const [v, setV] = useState(() => (reduceMotion() ? target : 0));
  useEffect(() => {
    if (reduceMotion()) { setV(target); return; }
    let raf = 0;
    const t0 = performance.now() + delay;
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - t0) / ms));
      setV(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, delay]);
  return v;
}

/** Ráfaga desde la insignia + confeti cayendo, en los colores de la marca. */
function Celebracion() {
  const piezas = useMemo(() => {
    if (reduceMotion()) return { burst: [], fall: [] };
    const burst = Array.from({ length: 34 }, (_, i) => {
      const ang = (i / 34) * Math.PI * 2 + rand(-0.15, 0.15);
      const dist = rand(90, 230);
      const alargada = Math.random() > 0.45;
      return {
        "--tx": `${Math.cos(ang) * dist}px`,
        "--ty": `${Math.sin(ang) * dist - 30}px`,
        "--rot": `${rand(-540, 540)}deg`,
        "--w": `${alargada ? rand(6, 11) : rand(6, 9)}px`,
        "--h": `${alargada ? rand(11, 18) : rand(6, 9)}px`,
        "--r": alargada ? "2px" : "9999px",
        "--c": COLORES[i % COLORES.length],
        "--d": `${rand(1.7, 2.5)}s`,
        "--delay": `${rand(0.95, 1.1)}s`,
      } as React.CSSProperties;
    });
    const fall = Array.from({ length: 30 }, (_, i) => ({
      "--x": `${rand(2, 98)}%`,
      "--w": `${rand(6, 10)}px`,
      "--h": `${rand(10, 16)}px`,
      "--r": "2px",
      "--c": COLORES[(i + 2) % COLORES.length],
      "--d": `${rand(3.2, 5.2)}s`,
      "--delay": `${rand(1.1, 2.6)}s`,
      "--sway": `${rand(-70, 70)}px`,
      "--rot": `${rand(280, 900)}deg`,
    } as React.CSSProperties));
    return { burst, fall };
  }, []);

  return (
    <div className="gmp-fx" aria-hidden>
      {piezas.burst.map((s, i) => <span key={`b${i}`} className="gmp-p" style={s} />)}
      {piezas.fall.map((s, i) => <span key={`f${i}`} className="gmp-fall" style={s} />)}
    </div>
  );
}

/** Descarga un .ics con la ventana de entrega (evento de día completo). */
function descargarCalendario(d: PagoExitosoDatos, desde: Date, hasta: Date) {
  const ymd = (x: Date) =>
    `${x.getFullYear()}${String(x.getMonth() + 1).padStart(2, "0")}${String(x.getDate()).padStart(2, "0")}`;
  const finExclusivo = new Date(hasta);
  finExclusivo.setDate(finExclusivo.getDate() + 1); // en iCalendar el fin de un evento de día completo es exclusivo
  const lugar = [d.direccion, d.distrito].filter(Boolean).join(", ");
  const esc = (s: string) => s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//G&M Muebleria//Pedido//ES", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
    `UID:${d.purchase}@gm-muebleria`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`,
    `DTSTART;VALUE=DATE:${ymd(desde)}`,
    `DTEND;VALUE=DATE:${ymd(finExclusivo)}`,
    `SUMMARY:${esc("Entrega de tu pedido · G&M Mueblería")}`,
    `DESCRIPTION:${esc(`Pedido ${d.purchase}. Te avisamos por WhatsApp antes de la entrega.`)}`,
    lugar ? `LOCATION:${esc(lugar)}` : "",
    "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `entrega-${d.purchase}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Otros ambientes: productos activos de categorías distintas a las que compró (1 por categoría). */
async function fetchCompletaTuEspacio(ids: string[]) {
  if (!ids.length) return [];
  const { data: comprados } = await supabase.from("products").select("categoria").in("id", ids);
  const cats = Array.from(new Set(((comprados ?? []) as { categoria: string | null }[]).map((r) => r.categoria).filter(Boolean))) as string[];
  const { data, error } = await supabase
    .from("products")
    .select("id,nombre,precio,categoria,stock,imagen_url,imagen_public_id,descuento_porcentaje,oferta_vence_el")
    .eq("activo", true)
    .not("id", "in", `(${ids.join(",")})`)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  const libres = ((data ?? []) as any[]).filter((p) => (p.stock ?? 1) > 0);
  const otras = libres.filter((p) => !cats.includes(p.categoria));
  const unaPorCategoria: any[] = [];
  for (const p of [...otras, ...libres]) {
    if (unaPorCategoria.length >= 3) break;
    if (!unaPorCategoria.some((x) => x.id === p.id || (x.categoria === p.categoria && otras.length >= 3))) unaPorCategoria.push(p);
  }
  return unaPorCategoria;
}

export function PagoExitoso({
  datos, modo = "gracias", onCerrar,
}: {
  datos: PagoExitosoDatos;
  /** "gracias": pantalla tras pagar. "comprobante": la misma vista, reabierta luego desde Mis pedidos. */
  modo?: "gracias" | "comprobante";
  onCerrar?: () => void;
}) {
  const esComprobante = modo === "comprobante";
  const navigate = useNavigate();
  const tituloRef = useRef<HTMLHeadingElement | null>(null);
  const [copiado, setCopiado] = useState(false);

  const total = Number(datos.amount) || 0;
  const totalAnimado = useCountUp(total);
  const nombre = primerNombre(datos.nombre);
  const items = datos.items ?? [];
  const recojo = datos.metodoEntrega === "recojo_tienda";

  // Ventana de entrega: misma regla que la ficha y las tarjetas (lib/entrega)
  const { desde, hasta } = useMemo(() => {
    const hoy = new Date();
    return { desde: addBusinessDays(hoy, ENTREGA_MIN_DIAS), hasta: addBusinessDays(hoy, ENTREGA_MAX_DIAS) };
  }, []);

  const descuento = Math.max(0, (datos.subtotal ?? 0) + (datos.envio ?? 0) - total);

  const { data: sugeridos } = useQuery({
    queryKey: ["pago-completa-espacio", items.map((i) => i.id).join(",")],
    queryFn: () => fetchCompletaTuEspacio(items.map((i) => i.id)),
    enabled: items.length > 0 && !esComprobante,
    staleTime: 300_000,
    retry: 1,
  });

  // Bloquea el scroll de la página de atrás y enfoca el título (lectores de pantalla)
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    tituloRef.current?.focus();
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    if (!esComprobante || !onCerrar) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCerrar(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [esComprobante, onCerrar]);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(datos.purchase);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch { /* sin permiso de portapapeles: no pasa nada */ }
  };

  const mensajeAsesor = encodeURIComponent(`Hola G&M Mueblería, soy ${nombre || "cliente"}. Quisiera coordinar mi pedido ${datos.purchase}.`);
  const linkAsesor = WHATSAPP_NUMBER ? `https://wa.me/${WHATSAPP_NUMBER}?text=${mensajeAsesor}` : null;

  const base = (APP_URL as string | undefined) || (typeof window !== "undefined" ? window.location.origin : "");
  const mensajeCompartir = encodeURIComponent(
    `Acabo de comprar en G&M Mueblería 🪑 Muebles hechos con calidad y entrega en 5–7 días hábiles en Lima. Míralos aquí: ${base}/?utm_source=compartir&utm_medium=whatsapp&utm_campaign=postcompra`,
  );

  // Mismos estados que ve el cliente en Mis pedidos
  const pasos = [
    { key: "pagado", titulo: "Pago recibido", detalle: datos.date, icono: BadgeCheck, estado: "done" as const },
    { key: "en_produccion", titulo: "En producción", detalle: "Empezamos a fabricar y preparar tu pedido.", icono: Hammer, estado: "now" as const },
    { key: "control_calidad", titulo: "Control de calidad", detalle: "Revisamos cada acabado antes de despachar.", icono: ShieldCheck, estado: "todo" as const },
    { key: "listo_despacho", titulo: recojo ? "Listo para recoger" : "Listo para despacho", detalle: recojo ? "Te avisamos para que pases por tienda." : "Coordinamos contigo el horario de entrega.", icono: PackageCheck, estado: "todo" as const },
    ...(recojo ? [] : [{ key: "enviado", titulo: "En camino", detalle: "Sale de nuestro taller hacia tu casa.", icono: Truck, estado: "todo" as const }]),
    { key: "entregado", titulo: recojo ? "Recogido en tienda" : "Entregado", detalle: recojo ? "Disfrútalo. Después te invitaremos a dejar tu reseña." : `Llega entre el ${fmtDia(desde)} y el ${fmtDia(hasta)}.`, icono: Sparkles, estado: "goal" as const },
  ];

  const irAPedidos = () => navigate({ to: "/perfil/pedidos" });
  const accionPrincipal = esComprobante && onCerrar ? onCerrar : irAPedidos;
  const textoPrincipal = esComprobante ? "Volver a mis pedidos" : "Ver mi pedido";

  return (
    <div className="gmp-root" role="dialog" aria-modal="true" aria-labelledby="gmp-titulo">
      {/* ───────── Hero ───────── */}
      {esComprobante && onCerrar && (
        <button type="button" onClick={onCerrar} aria-label="Cerrar comprobante"
          className="fixed right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur transition-colors hover:bg-black/55">
          <X className="h-5 w-5" />
        </button>
      )}
      <header className="gmp-hero">
        {!esComprobante && <Celebracion />}
        <div className="relative mx-auto flex max-w-3xl flex-col items-center px-5 pb-28 pt-16 text-center sm:pb-32 sm:pt-20">
          <div className="gmp-badge" aria-hidden>
            <span className="gmp-pulse" />
            <span className="gmp-badge-disc" />
            <svg viewBox="0 0 52 52">
              <circle className="gmp-ring" cx="26" cy="26" r="24" />
              <path className="gmp-tick" d="M15 27 l8 8 l15 -17" />
            </svg>
          </div>

          <p className="gmp-rise mt-7 text-xs font-semibold uppercase tracking-[0.28em] text-[#f0a020]" style={{ ["--gmp-d" as string]: "0.9s" }}>
            {esComprobante ? "Comprobante de pago" : "Pago aprobado"}
          </p>
          <h1
            id="gmp-titulo"
            ref={tituloRef}
            tabIndex={-1}
            className="gmp-rise font-display mt-2 text-4xl font-semibold leading-tight outline-none sm:text-6xl"
            style={{ ["--gmp-d" as string]: "1s" }}
          >
            {esComprobante
              ? "Tu pago fue aprobado"
              : nombre ? `¡Gracias, ${nombre}!` : "¡Gracias por tu compra!"}
          </h1>
          <p className="gmp-rise mt-3 max-w-lg text-[15px] leading-relaxed text-[#fbf4e8]/80" style={{ ["--gmp-d" as string]: "1.1s" }}>
            {esComprobante
              ? "Este es el detalle de tu compra. Para ver en qué etapa va, vuelve a Mis pedidos."
              : "Recibimos tu pago y tu pedido pasa a producción. Aquí tienes todo lo que sigue, sin sorpresas."}
          </p>

          <div className="gmp-rise mt-7" style={{ ["--gmp-d" as string]: "1.2s" }}>
            <p className="text-[11px] uppercase tracking-[0.22em] text-[#fbf4e8]/60">Total pagado</p>
            <p className="font-display text-5xl font-semibold tabular-nums sm:text-6xl" aria-label={fmtPEN(total)}>
              {fmtPEN(totalAnimado)}
            </p>
            <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-[#fbf4e8]/70">
              <CreditCard className="h-3.5 w-3.5" /> Tarjeta · Niubiz · Pago seguro
            </p>
          </div>

          {!esComprobante && (
          <div className="gmp-rise mt-6 inline-flex items-center gap-2.5 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm backdrop-blur" style={{ ["--gmp-d" as string]: "1.35s" }}>
            {recojo ? <Store className="h-4 w-4 text-[#f0a020]" /> : <Truck className="h-4 w-4 text-[#f0a020]" />}
            {recojo ? (
              <span>Te avisamos cuando puedas <b>recogerlo en tienda</b></span>
            ) : (
              <span>Llega entre el <b>{fmtDia(desde)}</b> y el <b>{fmtDia(hasta)}</b></span>
            )}
          </div>
          )}
        </div>
      </header>

      {/* ───────── Contenido ───────── */}
      <main className="relative mx-auto -mt-16 max-w-5xl px-4 pb-32 sm:-mt-20 lg:pb-16">
        <div className="grid gap-5 lg:grid-cols-5">
          {/* Ticket del pedido */}
          <section className={`gmp-rise lg:col-span-3${esComprobante ? " lg:col-start-2" : ""}`} style={{ ["--gmp-d" as string]: "1.5s" }} aria-label="Resumen de tu pedido">
            <div className="gmp-card gmp-ticket h-full" style={{ ["--notch-y" as string]: "98px" }}>
              <span className="gmp-stamp" aria-hidden>Pagado</span>

              <div className="p-5 pb-5 pr-28 sm:p-6 sm:pr-40">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Tu pedido</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span className="break-all font-mono text-[13px] font-semibold tracking-tight sm:text-[15px]">{datos.purchase}</span>
                  <button
                    type="button"
                    onClick={copiar}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                    aria-label="Copiar número de pedido"
                  >
                    {copiado ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                    <span aria-live="polite">{copiado ? "Copiado" : "Copiar"}</span>
                  </button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{datos.date}</p>
              </div>

              <div className="gmp-perf" />

              <div className="p-5 sm:p-6">
                {items.length > 0 ? (
                  <ul className="space-y-3.5">
                    {items.map((it) => (
                      <li key={it.id} className="flex items-center gap-3.5">
                        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-border/60 bg-[#f6efe4]">
                          {it.image ? (
                            <img src={it.image} alt="" className="h-full w-full object-cover mix-blend-multiply" loading="lazy" />
                          ) : (
                            <PackageCheck className="m-auto mt-5 h-6 w-6 text-muted-foreground" />
                          )}
                          {it.qty > 1 && (
                            <span className="absolute -right-0 -top-0 rounded-bl-lg bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">×{it.qty}</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-display text-[17px] font-semibold leading-snug line-clamp-2">{it.title}</p>
                          <p className="text-xs text-muted-foreground">{it.qty} {it.qty === 1 ? "unidad" : "unidades"} · {fmtPEN(it.price)} c/u</p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold tabular-nums">{fmtPEN(it.price * it.qty)}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">El detalle de tu pedido estará disponible en Mis pedidos.</p>
                )}

                <dl className="mt-5 space-y-1.5 border-t border-border/60 pt-4 text-sm">
                  {datos.subtotal != null && (
                    <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular-nums">{fmtPEN(datos.subtotal)}</dd></div>
                  )}
                  {datos.envio != null && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">{recojo ? "Recojo en tienda" : "Envío"}{!recojo && datos.distrito ? ` · ${datos.distrito}` : ""}</dt>
                      <dd className="tabular-nums">{datos.envio > 0 ? fmtPEN(datos.envio) : "Gratis"}</dd>
                    </div>
                  )}
                  {descuento > 0.01 && (
                    <div className="flex justify-between text-emerald-700"><dt>Descuento aplicado</dt><dd className="tabular-nums">−{fmtPEN(descuento)}</dd></div>
                  )}
                  <div className="flex items-baseline justify-between border-t border-dashed border-border pt-3">
                    <dt className="font-display text-lg font-semibold">Total pagado</dt>
                    <dd className="font-display text-2xl font-semibold tabular-nums">{fmtPEN(total)}</dd>
                  </div>
                </dl>

                {!recojo && (datos.direccion || datos.distrito) && (
                  <p className="mt-4 flex items-start gap-2 rounded-xl bg-[#f6efe4] px-3.5 py-2.5 text-xs text-muted-foreground">
                    <MapPin className="mt-px h-3.5 w-3.5 shrink-0 text-primary" />
                    <span>Entrega en <b className="font-semibold text-foreground">{[datos.direccion, datos.distrito].filter(Boolean).join(", ")}</b></span>
                  </p>
                )}
                {datos.modoEntrega === "parcial" && (
                  <p className="mt-2 flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
                    <Truck className="mt-px h-3.5 w-3.5 shrink-0" />
                    <span>Elegiste <b>entrega parcial</b>: lo disponible sale primero y coordinamos contigo el resto.</span>
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Línea de tiempo */}
          {!esComprobante && (
          <section className="gmp-rise lg:col-span-2" style={{ ["--gmp-d" as string]: "1.65s" }} aria-label="Lo que sigue">
            <div className="gmp-card h-full p-5 sm:p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Lo que sigue</p>
              <h2 className="font-display mt-1 mb-5 text-2xl font-semibold leading-tight">El camino de tu pedido</h2>
              <ol>
                {pasos.map((p) => {
                  const Icono = p.icono;
                  return (
                    <li key={p.key} className={`gmp-step ${p.estado === "done" ? "is-done" : p.estado === "now" ? "is-now" : p.estado === "goal" ? "is-goal" : ""}`}>
                      <span className="gmp-node">{p.estado === "done" ? <Check className="h-4 w-4" /> : <Icono className="h-4 w-4" />}</span>
                      <div className="min-w-0 pt-0.5">
                        <p className={`text-sm font-semibold ${p.estado === "todo" ? "text-muted-foreground" : ""}`}>
                          {p.titulo}
                          {p.estado === "now" && <span className="ml-2 rounded-full bg-[#f0a020]/20 px-2 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-[#8a5a00]">Siguiente</span>}
                        </p>
                        <p className={`text-xs leading-relaxed ${p.estado === "goal" ? "font-medium text-foreground" : "text-muted-foreground"}`}>{p.detalle}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-5 rounded-xl bg-[#f6efe4] px-3.5 py-2.5 text-xs leading-relaxed text-muted-foreground">
                Seguimiento por WhatsApp en tiempo real. Y cuando lo recibas, te invitaremos a contarnos cómo quedó.
              </p>
            </div>
          </section>
          )}
        </div>

        {/* Acciones */}
        <section className="gmp-rise mt-5 hidden flex-wrap items-center gap-3 lg:flex" style={{ ["--gmp-d" as string]: "1.8s" }} aria-label="Acciones">
          <button type="button" onClick={accionPrincipal} className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
            {textoPrincipal} <ArrowRight className="h-4 w-4" />
          </button>
          {!recojo && !esComprobante && (
            <button type="button" onClick={() => descargarCalendario(datos, desde, hasta)} className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-5 py-3 text-sm font-medium transition-colors hover:border-primary/40 hover:text-primary">
              <CalendarPlus className="h-4 w-4" /> Agregar entrega al calendario
            </button>
          )}
          {linkAsesor && (
            <a href={linkAsesor} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-5 py-3 text-sm font-medium transition-colors hover:border-primary/40 hover:text-primary">
              <MessageCircle className="h-4 w-4" /> Hablar con un asesor
            </a>
          )}
          {!esComprobante && <Link to="/" className="ml-auto text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline">Seguir comprando</Link>}
        </section>

        {/* Completa tu espacio */}
        {sugeridos && sugeridos.length > 0 && (
          <section className="gmp-rise mt-10" style={{ ["--gmp-d" as string]: "1.95s" }} aria-label="Completa tu espacio">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Mientras fabricamos tu pedido</p>
                <h2 className="font-display text-2xl font-semibold sm:text-3xl">Completa tu espacio</h2>
              </div>
              <Link to="/catalogo" className="shrink-0 text-sm text-primary underline-offset-4 hover:underline">Ver catálogo</Link>
            </div>
            <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
              {sugeridos.map((p: any) => {
                const { precioFinal, activa } = ofertaInfo(p);
                const img = p.imagen_public_id ? cloudinaryUrl(p.imagen_public_id, { w: 400, h: 300 }) : p.imagen_url;
                return (
                  <Link key={p.id} to="/product/$handle" params={{ handle: p.id }} className="gmp-card group w-[240px] shrink-0 snap-start overflow-hidden transition-all hover:-translate-y-1 sm:w-auto">
                    <div className="aspect-[4/3] overflow-hidden bg-[#f6efe4]">
                      {img && <img src={img} alt={p.nombre} loading="lazy" className="h-full w-full object-cover mix-blend-multiply transition-transform duration-700 group-hover:scale-105" />}
                    </div>
                    <div className="p-4">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{p.categoria}</p>
                      <p className="font-display mt-0.5 text-lg font-semibold leading-snug line-clamp-1">{p.nombre}</p>
                      <p className="mt-1 flex items-baseline gap-2">
                        <span className={`font-display text-xl font-bold ${activa ? "text-destructive" : ""}`}>{fmtPEN(precioFinal)}</span>
                        {activa && <span className="text-xs text-muted-foreground line-through">{fmtPEN(p.precio)}</span>}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Boca a boca */}
                {!esComprobante && (
<section className="gmp-rise mt-10 overflow-hidden rounded-2xl bg-[var(--gmp-walnut-deep)] p-6 text-[#fbf4e8] sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-8" style={{ ["--gmp-d" as string]: "2.1s" }}>
          <div>
            <p className="font-display text-2xl font-semibold sm:text-3xl">¿Conoces a alguien que está amueblando?</p>
            <p className="mt-1 text-sm text-[#fbf4e8]/70">Cuéntale dónde compraste. Una recomendación tuya vale más que cualquier anuncio.</p>
          </div>
          <a href={`https://wa.me/?text=${mensajeCompartir}`} target="_blank" rel="noreferrer" className="mt-4 inline-flex shrink-0 items-center gap-2 rounded-full bg-[#f0a020] px-6 py-3 text-sm font-semibold text-[#2b1a08] transition-all hover:-translate-y-0.5 hover:shadow-lg sm:mt-0">
            <Share2 className="h-4 w-4" /> Compartir por WhatsApp
          </a>
        </section>
        )}
      </main>

      {/* Barra fija: acciones principales en móvil */}
      <div className="gmp-bar lg:hidden">
        <div className="mx-auto flex max-w-md items-center gap-2">
          <button type="button" onClick={accionPrincipal} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground">
            {textoPrincipal} <ArrowRight className="h-4 w-4" />
          </button>
          {!recojo && !esComprobante && (
            <button type="button" onClick={() => descargarCalendario(datos, desde, hasta)} aria-label="Agregar entrega al calendario" className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-white">
              <CalendarPlus className="h-4.5 w-4.5" />
            </button>
          )}
          {linkAsesor && (
            <a href={linkAsesor} target="_blank" rel="noreferrer" aria-label="Hablar con un asesor" className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-white">
              <MessageCircle className="h-4.5 w-4.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}