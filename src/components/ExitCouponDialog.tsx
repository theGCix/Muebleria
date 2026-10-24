// src/components/ExitCouponDialog.tsx
// Cupón de salida: cuando el visitante está por irse, se le ofrece un cupón personal
// (un solo uso, con vencimiento real) a cambio de su correo. El cupón se crea en el servidor
// (POST /api/cupones/salida) y queda guardado en el navegador: una pastilla con cuenta regresiva
// lo mantiene a la vista y el checkout lo aplica solo.
import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Check, Copy, Loader2, Tag, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { API_URL as API } from "@/config";
import { useAuth } from "@/hooks/useAuth";
import { useExitIntent } from "@/hooks/useExitIntent";
import { useCountdown } from "@/hooks/useCountdown";
import {
  borrarCuponSalida,
  guardarCuponSalida,
  leerCuponSalida,
  marcarModalMostrado,
  ocultarPastilla,
  pastillaOculta,
  puedeMostrarModal,
  type CuponSalida,
} from "@/lib/cupon-salida";

interface Oferta {
  activo: boolean;
  porcentaje: number;
  horas: number;
  minimo: number;
}

const dos = (n: number) => String(n).padStart(2, "0");
const soles = (n: number) => `S/ ${Number.isInteger(n) ? n : n.toFixed(2)}`;
const SERIF = { fontFamily: '"Cormorant Garamond", Georgia, serif' } as const;

/** Solo en las páginas donde alguien navega y compra: nunca en checkout, login, perfil ni admin */
function esPaginaPublica(p: string) {
  return (
    p === "/" ||
    p.startsWith("/catalogo") ||
    p.startsWith("/categoria") ||
    p.startsWith("/product") ||
    p.startsWith("/combo")
  );
}

function formatoRestante(ms: number) {
  const t = Math.floor(ms / 1000);
  return `${dos(Math.floor(t / 3600))}:${dos(Math.floor((t % 3600) / 60))}:${dos(t % 60)}`;
}

async function copiar(codigo: string) {
  try {
    await navigator.clipboard.writeText(codigo);
    toast.success("Código copiado");
  } catch {
    toast.message(`Tu código: ${codigo}`);
  }
}

export function ExitCouponDialog() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, roles, loading } = useAuth();

  const [cupon, setCupon] = useState<CuponSalida | null>(() => leerCuponSalida());
  const [oferta, setOferta] = useState<Oferta | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [pastillaVisible, setPastillaVisible] = useState(() => !pastillaOculta());

  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [correo, setCorreo] = useState<"enviado" | "en_cola" | "no">("no");

  const publica = esPaginaPublica(pathname);
  const esStaff = roles.some((r) => r !== "cliente");
  const armado = publica && !loading && !esStaff && !cupon && !abierto && puedeMostrarModal();

  useExitIntent(
    async () => {
      if (!puedeMostrarModal()) return;
      try {
        // Un cliente que ya compró no es "primera compra": no le mostramos algo que no podrá usar
        if (user) {
          const { count } = await supabase
            .from("orders")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .not("paid_at", "is", null);
          if ((count ?? 0) > 0) return;
        }
        const res = await fetch(`${API}/api/cupones/salida/oferta`);
        const o = (await res.json()) as Oferta;
        if (!o?.activo) return;
        setOferta(o);
        marcarModalMostrado();
        setAbierto(true);
      } catch {
        /* sin red o endpoint caído: simplemente no mostramos nada */
      }
    },
    { enabled: armado },
  );

  const r = useCountdown(cupon ? new Date(cupon.vence_el).getTime() : null);
  useEffect(() => {
    if (cupon && r?.terminada) {
      borrarCuponSalida();
      setCupon(null);
    }
  }, [cupon, r?.terminada]);

  async function pedirCupon(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/cupones/salida`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "No pudimos generar tu cupón. Inténtalo de nuevo.");
        return;
      }
      const { correo: estadoCorreo, ...datosCupon } = data as CuponSalida & {
        correo?: "enviado" | "en_cola" | "no";
      };
      guardarCuponSalida(datosCupon);
      setCupon(datosCupon);
      setCorreo(estadoCorreo ?? "no");
      setPastillaVisible(true);
      navigator.clipboard?.writeText(data.codigo).catch(() => {});
    } catch {
      setError("No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  const pct = cupon?.porcentaje ?? oferta?.porcentaje ?? 0;
  const minimo = cupon?.minimo ?? oferta?.minimo ?? 0;

  return (
    <>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md gap-0 overflow-hidden rounded-xl p-0 [&>button]:text-primary-foreground [&>button]:opacity-80">
          <div className="bg-primary px-6 pb-5 pt-7 text-center text-primary-foreground">
            <p className="text-xs uppercase tracking-[0.2em] opacity-80">
              {cupon ? "Tu cupón está listo" : "Antes de irte"}
            </p>
            <p className="mt-1 text-6xl font-semibold leading-none" style={SERIF}>
              -{pct}%
            </p>
            <p className="mt-1 text-sm opacity-90">en tu primera compra</p>
          </div>

          <div className="space-y-4 px-6 py-5">
            {!cupon ? (
              <form onSubmit={pedirCupon} className="space-y-3">
                <DialogTitle className="text-base">
                  Deja tu correo y recibe tu cupón personal
                </DialogTitle>
                <DialogDescription>
                  Válido por {oferta?.horas ?? 48} horas desde que lo pidas, en compras desde{" "}
                  {soles(minimo)}. Un cupón por correo.
                </DialogDescription>
                <div className="space-y-1.5">
                  <Label htmlFor="cupon-email" className="sr-only">
                    Correo electrónico
                  </Label>
                  <Input
                    id="cupon-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="tucorreo@ejemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    aria-invalid={!!error}
                  />
                  {error && (
                    <p role="alert" className="text-xs text-destructive">
                      {error}
                    </p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={enviando || !email.trim()}>
                  {enviando ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    `Quiero mi ${pct}% de descuento`
                  )}
                </Button>
                <button
                  type="button"
                  onClick={() => setAbierto(false)}
                  className="mx-auto block text-xs text-muted-foreground underline-offset-2 hover:underline"
                >
                  No, gracias
                </button>
              </form>
            ) : (
              <div className="space-y-4 text-center">
                <DialogTitle className="text-base">Este es tu código</DialogTitle>
                <DialogDescription className="sr-only">
                  Cupón de descuento de primera compra
                </DialogDescription>
                <button
                  type="button"
                  onClick={() => copiar(cupon.codigo)}
                  className="mx-auto flex w-full items-center justify-center gap-2 rounded-md border-2 border-dashed border-primary/40 bg-muted/50 px-4 py-3 font-mono text-2xl font-semibold tracking-widest transition-colors hover:bg-muted"
                  aria-label={`Copiar código ${cupon.codigo}`}
                >
                  {cupon.codigo}
                  <Copy className="h-4 w-4 opacity-60" />
                </button>
                <p className="text-sm text-muted-foreground">
                  Vence en{" "}
                  <span className="font-semibold tabular-nums text-foreground">
                    {r ? formatoRestante(r.ms) : "--:--:--"}
                  </span>
                  . Compra mínima {soles(cupon.minimo)}. Lo aplicamos solo en el checkout.
                </p>
                {correo !== "no" && (
                  <p className="text-xs text-muted-foreground">
                    {correo === "enviado"
                      ? `También te lo enviamos a ${email.trim().toLowerCase()}.`
                      : `En unos minutos te llegará una copia a ${email.trim().toLowerCase()}.`}
                  </p>
                )}
                <Button className="w-full" onClick={() => setAbierto(false)}>
                  Seguir comprando
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Pastilla: mantiene el cupón a la vista mientras siga vigente */}
      {cupon && r && !r.terminada && !abierto && publica && pastillaVisible && (
        <div className="fixed bottom-20 left-3 z-30 flex items-center overflow-hidden rounded-full border bg-background shadow-lg md:bottom-4">
          <button
            type="button"
            title="Copiar código"
            onClick={() => copiar(cupon.codigo)}
            className="flex items-center gap-2 py-2 pl-3 pr-2 text-xs transition-colors hover:bg-muted"
          >
            <Tag className="h-3.5 w-3.5 text-primary" />
            <span className="font-mono font-semibold tracking-wider">{cupon.codigo}</span>
            <span className="tabular-nums text-muted-foreground">{formatoRestante(r.ms)}</span>
          </button>
          <button
            type="button"
            aria-label="Ocultar cupón"
            onClick={() => {
              ocultarPastilla();
              setPastillaVisible(false);
            }}
            className="px-2 py-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </>
  );
}
