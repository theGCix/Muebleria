import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AppRole } from "@/hooks/useAuth";
import { useCajaAlerta } from "@/hooks/useCajaAlerta";
import { fmtFechaHora } from "@/lib/caja.functions";
import { fechaLimaStr, HORA_RECORDATORIO_CIERRE } from "@/lib/cajaAlerta";

const CLAVE_POSPUESTO = "caja-recordatorio-pospuesto";
const CLAVE_TOAST = "caja-aviso-toast";

const leer = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const guardar = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };

/**
 * Aviso global (admin / vendedor) cuando la caja sigue abierta:
 *  · más de 24 h → banner rojo fijo (no se puede ocultar hasta cerrar la caja);
 *  · pasadas las 21:00 (Lima) → recordatorio de cierre diario; se puede posponer hasta mañana.
 * Solo avisa: la caja se cierra siempre a mano, con el conteo real de efectivo.
 */
export function CajaAlertBanner({ roles }: { roles: AppRole[] }) {
  const navigate = useNavigate();
  const { turno, alerta, ahora } = useCajaAlerta(roles);
  const hoy = fechaLimaStr(ahora);
  const [pospuestoHoy, setPospuestoHoy] = useState(() => leer(CLAVE_POSPUESTO) === hoy);

  useEffect(() => { setPospuestoHoy(leer(CLAVE_POSPUESTO) === hoy); }, [hoy]);

  // Un solo aviso emergente por día (además del banner).
  useEffect(() => {
    if (alerta.nivel === "ok" || !turno) return;
    const clave = `${hoy}:${alerta.nivel}`;
    if (leer(CLAVE_TOAST) === clave) return;
    guardar(CLAVE_TOAST, clave);
    toast.warning(
      alerta.nivel === "vencida"
        ? `La caja lleva abierta ${alerta.antiguedad}. Ciérrala con el conteo real de efectivo.`
        : "Recordatorio: cierra la caja del día.",
      { duration: 15_000, action: { label: "Ir a Caja", onClick: () => navigate({ to: "/caja" }) } },
    );
  }, [alerta.nivel, alerta.antiguedad, turno, hoy, navigate]);

  if (!turno || alerta.nivel === "ok") return null;
  if (alerta.nivel === "recordatorio" && pospuestoHoy) return null;

  const vencida = alerta.nivel === "vencida";
  return (
    <div
      role="alert"
      className={`mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-4 py-3 text-sm ${
        vencida ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-900"
      }`}
    >
      {vencida ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <Clock className="h-4 w-4 shrink-0" />}
      <p className="min-w-0 flex-1">
        {vencida ? (
          <>
            <strong>La caja lleva abierta {alerta.antiguedad}</strong> (desde {fmtFechaHora(turno.abierta_at)}).
            Cuenta el efectivo real y ciérrala; el cierre abarca todo ese período.
          </>
        ) : (
          <>
            <strong>Recordatorio de cierre:</strong> son más de las {HORA_RECORDATORIO_CIERRE}:00 y la caja sigue abierta
            (desde {fmtFechaHora(turno.abierta_at)}).
          </>
        )}
      </p>
      <div className="flex gap-2">
        <Button asChild size="sm" className="h-11 sm:h-8">
          <Link to="/caja">Ir a Caja</Link>
        </Button>
        {!vencida && (
          <Button
            size="sm" variant="outline" className="h-11 sm:h-8"
            onClick={() => { guardar(CLAVE_POSPUESTO, hoy); setPospuestoHoy(true); }}
          >
            Recordármelo mañana
          </Button>
        )}
      </div>
    </div>
  );
}
