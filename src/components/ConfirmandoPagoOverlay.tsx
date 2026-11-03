// src/components/ConfirmandoPagoOverlay.tsx
// Pantalla completa mientras el servidor confirma el pago con Niubiz y guarda el pedido.
// Evita que el cliente cierre la pestaña, recargue o vuelva a pagar creyendo que no pasó nada.
import { useEffect, useState } from "react";

export function ConfirmandoPagoOverlay({ visible }: { visible: boolean }) {
  const [lento, setLento] = useState(false);

  useEffect(() => {
    if (!visible) { setLento(false); return; }
    const t = setTimeout(() => setLento(true), 8000);
    return () => clearTimeout(t);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-live="polite"
      aria-label="Confirmando tu pago"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm p-6"
    >
      <div className="max-w-sm w-full text-center space-y-4">
        <div className="mx-auto h-12 w-12 rounded-full border-4 border-muted border-t-primary animate-spin" />
        <h2 className="text-xl font-semibold">Confirmando tu pago…</h2>
        <p className="text-sm text-muted-foreground">
          No cierres ni recargues esta página. Solo tomará unos segundos.
        </p>
        {lento && (
          <p className="text-sm rounded-md border bg-muted/50 p-3">
            Está tardando un poco más de lo normal. Tu pago está seguro: no se cobrará dos veces.
            Espera un momento más.
          </p>
        )}
      </div>
    </div>
  );
}
