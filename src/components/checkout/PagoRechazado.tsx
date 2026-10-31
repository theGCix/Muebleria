// src/components/checkout/PagoRechazado.tsx
// Pantalla de "pago no aprobado": hermana de PagoExitoso (mismo lienzo nogal/ámbar).
// Objetivo: que el cliente NO sienta que perdió la compra. Hace cuatro cosas:
//   1) dice con calma qué pasó, en lenguaje claro (traduce el código de Niubiz),
//   2) tranquiliza: no hubo cargo y el carrito sigue guardado,
//   3) da pasos concretos según el motivo,
//   4) deja reintentar en un toque o hablar con un asesor por WhatsApp.
import { useEffect, useMemo, useRef } from "react";
import { ArrowLeft, CreditCard, Info, MessageCircle, RefreshCw, ShieldCheck, ShoppingBag } from "lucide-react";
import { fmtPEN } from "@/lib/pricing";
import { WHATSAPP_NUMBER } from "@/config";
import "./pago-exitoso.css";
import "./pago-rechazado.css";

export interface PagoRechazadoItem {
  id: string;
  title: string;
  image?: string | null;
  qty: number;
  price: number;
}

export interface PagoRechazadoDatos {
  /** Texto que devolvió Niubiz o el servidor (ACTION_DESCRIPTION). */
  actionDesc?: string;
  /** Código de acción de Niubiz (p. ej. "116") o del servidor ("401", "406"). */
  actionCode?: string | number;
  /** true cuando no pudimos confirmar el resultado (sin respuesta del servidor). */
  sinConfirmar?: boolean;
  purchase?: string;
  date?: string;
  amount?: string;
  nombre?: string;
  items?: PagoRechazadoItem[];
}

interface Motivo {
  titulo: string;
  detalle: string;
  tips: string[];
  /** Si el problema es de la tienda/pasarela y no de la tarjeta del cliente. */
  nuestro?: boolean;
}

const VERIFICA = "Revisa que el número, la fecha de vencimiento y el código de seguridad estén bien escritos.";
const BANCO = "Llama al número que figura detrás de tu tarjeta para que tu banco libere la operación.";
const OTRA = "Prueba con otra tarjeta de crédito o débito.";

/** Traduce el código de Niubiz a algo que un cliente entienda y pueda accionar. */
function describirMotivo(code: string, desc?: string): Motivo {
  switch (code) {
    case "101":
      return { titulo: "Tu tarjeta está vencida", detalle: "El banco indica que la fecha de vencimiento ya pasó.", tips: ["Confirma la fecha de vencimiento impresa en la tarjeta.", OTRA, "Si tienes una tarjeta renovada, usa esa."] };
    case "102":
    case "113":
      return { titulo: "Tu banco no permitió esta compra", detalle: "La tarjeta no está habilitada para esta operación o este monto.", tips: [BANCO, "Pídele que habilite compras por internet y el monto de tu pedido.", OTRA] };
    case "116":
      return { titulo: "Fondos insuficientes", detalle: "El saldo o la línea disponible no alcanza para este pedido.", tips: ["Revisa tu saldo disponible.", OTRA, "Si prefieres, escríbenos y vemos cómo ayudarte con tu compra."] };
    case "118":
    case "129":
    case "180":
      return { titulo: "No pudimos validar tu tarjeta", detalle: "Algún dato de la tarjeta no coincide con el que tiene el banco.", tips: [VERIFICA, "Verifica que la tarjeta esté activa y habilitada para compras online.", OTRA] };
    case "191":
      return { titulo: "Tu banco necesita confirmar la compra", detalle: "El banco emisor pide que lo contactes para liberar la operación.", tips: [BANCO, "Cuando te confirmen, vuelve a intentar.", OTRA] };
    case "208":
    case "209":
      return { titulo: "Tu tarjeta está bloqueada", detalle: "El banco reporta la tarjeta como bloqueada y no puede usarse.", tips: [BANCO, OTRA] };
    case "670":
      return { titulo: "Tu banco frenó la compra por seguridad", detalle: "Su sistema antifraude detuvo la operación para protegerte.", tips: [BANCO, "Confirma que la compra es tuya y vuelve a intentar.", OTRA] };
    case "678":
      return { titulo: "No se completó la verificación de tu tarjeta", detalle: "El paso de autenticación con tu banco no terminó bien.", tips: ["Vuelve a intentar y completa la verificación de tu banco si te la piden.", BANCO, OTRA] };
    case "666":
      return { titulo: "Hubo un problema de comunicación", detalle: "No pudimos hablar con tu banco en este momento.", tips: ["Espera unos minutos y vuelve a intentar.", OTRA], nuestro: true };
    case "754":
    case "476":
    case "207":
      return { titulo: "Estamos resolviendo un tema con la pasarela", detalle: "Esto no tiene que ver con tu tarjeta: es un ajuste nuestro con el proveedor de pagos.", tips: ["Intenta de nuevo en unos minutos.", "Si persiste, escríbenos por WhatsApp y cerramos tu compra contigo."], nuestro: true };
    case "401":
      return { titulo: "No pudimos confirmar tu pago", detalle: "Tuvimos un problema al validar la operación con la pasarela de pagos.", tips: ["Intenta de nuevo en unos minutos.", "Si persiste, escríbenos por WhatsApp y cerramos tu compra contigo."], nuestro: true };
    case "406":
      return { titulo: "Esta operación ya se envió", detalle: "Detectamos un intento de pago idéntico hace instantes.", tips: ["Revisa en «Mis pedidos» si tu pedido ya aparece.", "Espera un par de minutos antes de reintentar."] };
    case "MONTO":
      return { titulo: "El monto no coincide", detalle: "El importe del pedido cambió mientras pagabas (por ejemplo, una oferta que terminó).", tips: ["Vuelve al pago: verás el total actualizado.", "Si el precio te parece raro, escríbenos."], nuestro: true };
    default:
      return {
        titulo: desc && desc.length < 60 ? desc : "El pago no fue aprobado",
        detalle: "Tu banco o la pasarela no aprobaron esta operación.",
        tips: [VERIFICA, "Vuelve a intentarlo en unos minutos.", OTRA],
      };
  }
}

export function PagoRechazado({
  datos, onReintentar, onVolver,
}: {
  datos: PagoRechazadoDatos;
  /** Cierra la pantalla y deja al cliente de nuevo en el checkout con su carrito intacto. */
  onReintentar: () => void;
  onVolver: () => void;
}) {
  const tituloRef = useRef<HTMLHeadingElement | null>(null);
  const code = String(datos.actionCode ?? "").trim();
  const motivo = useMemo(() => describirMotivo(code, datos.actionDesc), [code, datos.actionDesc]);
  const items = datos.items ?? [];
  const total = Number(datos.amount) || items.reduce((s, i) => s + i.price * i.qty, 0);
  const nombre = (() => {
    const n = (datos.nombre ?? "").trim().split(/\s+/)[0];
    return !n || n === "—" ? "" : n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
  })();

  // Bloquea el scroll de atrás, enfoca el título y deja salir con Escape
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    tituloRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onReintentar(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [onReintentar]);

  const mensajeAsesor = encodeURIComponent(
    `Hola G&M Mueblería, soy ${nombre || "cliente"}. Intenté pagar mi pedido${total ? ` de ${fmtPEN(total)}` : ""} y el pago no se aprobó` +
    `${code ? ` (código ${code})` : ""}. ¿Me ayudan a completarlo?`,
  );
  const linkAsesor = WHATSAPP_NUMBER ? `https://wa.me/${WHATSAPP_NUMBER}?text=${mensajeAsesor}` : null;

  return (
    <div className="gmp-root gmr-root" role="alertdialog" aria-modal="true" aria-labelledby="gmr-titulo">
      {/* ───────── Hero ───────── */}
      <header className="gmp-hero">
        <div className="relative mx-auto flex max-w-3xl flex-col items-center px-5 pb-24 pt-14 text-center sm:pb-28 sm:pt-18">
          <div className="gmp-badge" aria-hidden>
            <span className="gmp-pulse" />
            <span className="gmp-badge-disc" />
            <svg viewBox="0 0 52 52">
              <circle className="gmp-ring" cx="26" cy="26" r="24" />
              <path className="gmr-x" d="M17 17 L35 35 M35 17 L17 35" />
            </svg>
          </div>

          <p className="gmp-rise gmr-eyebrow mt-7 text-xs font-semibold uppercase tracking-[0.28em]" style={{ ["--gmp-d" as string]: "0.5s" }}>
            Pago no aprobado
          </p>
          <h1
            id="gmr-titulo"
            ref={tituloRef}
            tabIndex={-1}
            className="gmp-rise font-display mt-2 text-3xl font-semibold leading-tight outline-none sm:text-5xl"
            style={{ ["--gmp-d" as string]: "0.6s" }}
          >
            {nombre ? `${nombre}, no pudimos completar tu pago` : "No pudimos completar tu pago"}
          </h1>
          <p className="gmp-rise mt-3 max-w-lg text-[15px] leading-relaxed text-[#fbf4e8]/80" style={{ ["--gmp-d" as string]: "0.7s" }}>
            {datos.sinConfirmar
              ? "No recibimos la confirmación del pago. Tu pedido sigue guardado y lo resolvemos contigo."
              : "Tu pedido sigue esperándote. Con un pequeño ajuste lo cerramos en un minuto."}
          </p>
        </div>
      </header>

      {/* ───────── Contenido ───────── */}
      <main className="relative mx-auto -mt-14 w-full max-w-4xl px-4 pb-32 sm:-mt-16 lg:pb-16">
        <div className="grid gap-5 lg:grid-cols-5">
          {/* Qué pasó + qué hacer */}
          <section className="gmp-rise lg:col-span-3" style={{ ["--gmp-d" as string]: "0.85s" }} aria-label="Qué pasó">
            <div className="gmp-card h-full p-5 sm:p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">¿Qué pasó?</p>
              <h2 className="font-display mt-1 text-2xl font-semibold leading-tight sm:text-3xl">
                {datos.sinConfirmar ? "No pudimos confirmar tu pago" : motivo.titulo}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {datos.sinConfirmar
                  ? "Hubo un corte de conexión justo al confirmar. Puede que el pago sí se haya procesado."
                  : motivo.detalle}
              </p>

              <div className="mt-4">
                {datos.sinConfirmar ? (
                  <p className="gmr-warn">
                    <Info className="mt-px h-4 w-4 shrink-0" />
                    <span>Antes de reintentar, revisa «Mis pedidos». <b>Si ves un cargo en tu banco y no hay pedido, escríbenos</b> y lo verificamos de inmediato.</span>
                  </p>
                ) : (
                  <p className="gmr-safe">
                    <ShieldCheck className="mt-px h-4 w-4 shrink-0" />
                    <span><b>No se hizo ningún cargo</b> a tu tarjeta y tu carrito sigue guardado.</span>
                  </p>
                )}
              </div>

              {!datos.sinConfirmar && (
                <>
                  <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    {motivo.nuestro ? "Qué puedes hacer" : "Cómo resolverlo"}
                  </p>
                  <ol className="mt-3 space-y-3">
                    {motivo.tips.map((t, i) => (
                      <li key={i} className="gmr-tip">
                        <span className="gmr-tip-n">{i + 1}</span>
                        <p className="pt-0.5 text-sm leading-relaxed">{t}</p>
                      </li>
                    ))}
                  </ol>
                </>
              )}

              {(code || datos.date) && (
                <p className="mt-6 border-t border-dashed border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
                  Referencia para soporte{code ? ` · código ${code}` : ""}{datos.date ? ` · ${datos.date}` : ""}
                </p>
              )}
            </div>
          </section>

          {/* Tu pedido sigue aquí */}
          <section className="gmp-rise lg:col-span-2" style={{ ["--gmp-d" as string]: "1s" }} aria-label="Tu pedido">
            <div className="gmp-card h-full p-5 sm:p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Tu pedido sigue aquí</p>
              <h2 className="font-display mt-1 mb-4 text-xl font-semibold leading-tight">Nada se perdió</h2>

              {items.length > 0 ? (
                <ul className="space-y-3">
                  {items.map((it) => (
                    <li key={it.id} className="flex items-center gap-3">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-border/60 bg-[#f6efe4]">
                        {it.image
                          ? <img src={it.image} alt="" className="h-full w-full object-cover mix-blend-multiply" loading="lazy" />
                          : <ShoppingBag className="m-auto mt-4 h-5 w-5 text-muted-foreground" />}
                        {it.qty > 1 && <span className="absolute right-0 top-0 rounded-bl-lg bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">×{it.qty}</span>}
                      </div>
                      <p className="font-display min-w-0 flex-1 text-[15px] font-semibold leading-snug line-clamp-2">{it.title}</p>
                      <p className="shrink-0 text-sm font-semibold tabular-nums">{fmtPEN(it.price * it.qty)}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Tus productos siguen en el carrito.</p>
              )}

              {total > 0 && (
                <div className="mt-4 flex items-baseline justify-between border-t border-dashed border-border pt-3">
                  <span className="text-sm text-muted-foreground">Total a pagar</span>
                  <span className="font-display text-2xl font-semibold tabular-nums">{fmtPEN(total)}</span>
                </div>
              )}
              <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <CreditCard className="h-3.5 w-3.5" /> Tarjeta · Niubiz · Pago seguro
              </p>
            </div>
          </section>
        </div>

        {/* Acciones (escritorio) */}
        <section className="gmp-rise mt-5 hidden flex-wrap items-center gap-3 lg:flex" style={{ ["--gmp-d" as string]: "1.15s" }} aria-label="Acciones">
          <button type="button" onClick={onReintentar} className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
            <RefreshCw className="h-4 w-4" /> Intentar de nuevo
          </button>
          {linkAsesor && (
            <a href={linkAsesor} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-5 py-3 text-sm font-medium transition-colors hover:border-primary/40 hover:text-primary">
              <MessageCircle className="h-4 w-4" /> Hablar con un asesor
            </a>
          )}
          <button type="button" onClick={onVolver} className="ml-auto inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" /> Volver a la tienda
          </button>
        </section>
      </main>

      {/* Barra fija en móvil */}
      <div className="gmp-bar lg:hidden">
        <div className="mx-auto flex max-w-md items-center gap-2">
          <button type="button" onClick={onReintentar} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground">
            <RefreshCw className="h-4 w-4" /> Intentar de nuevo
          </button>
          {linkAsesor && (
            <a href={linkAsesor} target="_blank" rel="noreferrer" aria-label="Hablar con un asesor" className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-white">
              <MessageCircle className="h-[18px] w-[18px]" />
            </a>
          )}
          <button type="button" onClick={onVolver} aria-label="Volver a la tienda" className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-white">
            <ArrowLeft className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>
    </div>
  );
}
