// src/components/CarritoAvisos.tsx
// Aviso de cambios en el carrito (precio antes → ahora, sin stock, combo vencido). Lo usan CartDrawer y checkout.
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/stores/cartStore";
import { fmtPEN } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import type { AvisoCarrito } from "@/hooks/useValidarCarrito";

const QUITABLES = new Set<AvisoCarrito["tipo"]>(["no_disponible", "sin_stock", "combo_no_disponible"]);

function Texto({ a }: { a: AvisoCarrito }) {
  switch (a.tipo) {
    case "precio_cambio":
      return (
        <>
          <span className="font-medium">{a.title}</span>: antes{" "}
          <span className="line-through">{fmtPEN(a.antes ?? 0)}</span> → ahora{" "}
          <span className="font-semibold">{fmtPEN(a.ahora ?? 0)}</span>
        </>
      );
    case "stock_insuficiente":
      return (
        <>
          <span className="font-medium">{a.title}</span>: solo quedan {a.stock}{" "}
          {a.stock === 1 ? "unidad" : "unidades"}. Ajusta la cantidad.
        </>
      );
    case "sin_stock":
      return (
        <>
          <span className="font-medium">{a.title}</span>: agotado por ahora.
        </>
      );
    case "combo_no_disponible":
      return (
        <>
          <span className="font-medium">{a.title}</span>: el combo ya no está disponible.
        </>
      );
    default:
      return (
        <>
          <span className="font-medium">{a.title}</span>: ya no está disponible.
        </>
      );
  }
}

export function CarritoAvisos({
  avisos,
  onEntendido,
  className,
}: {
  avisos: AvisoCarrito[];
  onEntendido: () => void;
  className?: string;
}) {
  const removeItem = useCartStore((s) => s.removeItem);
  const removeCombo = useCartStore((s) => s.removeCombo);
  if (avisos.length === 0) return null;

  return (
    <Alert className={cn("border-accent/60 bg-accent/10", className)}>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Actualizamos tu carrito</AlertTitle>
      <AlertDescription>
        <ul className="mt-2 space-y-2">
          {avisos.map((a) => (
            <li key={`${a.id}|${a.comboId ?? ""}|${a.tipo}`} className="flex items-start justify-between gap-2">
              <span className="min-w-0 flex-1">
                <Texto a={a} />
              </span>
              {QUITABLES.has(a.tipo) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-[44px] flex-shrink-0"
                  onClick={() => (a.comboId ? removeCombo(a.comboId) : removeItem(a.id))}
                >
                  Quitar
                </Button>
              )}
            </li>
          ))}
        </ul>
        <Button type="button" size="sm" className="mt-3 min-h-[44px] w-full" onClick={onEntendido}>
          Entendido, continuar
        </Button>
      </AlertDescription>
    </Alert>
  );
}