// src/components/checkout/TerminosCheckout.tsx
// Casilla "He leído y acepto los Términos y condiciones" que va justo antes del botón Pagar.
// El enlace abre un modal con el resumen de las condiciones y el botón "Aceptar y continuar".
// El texto vive en TERMINOS_CHECKOUT: edítalo ahí. Es un resumen; el texto completo está en /terminos.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// BORRADOR: revísalo con un abogado, igual que /terminos.
export const TERMINOS_CHECKOUT: string[] = [
  "Al realizar tu compra en G&M Mueblería, aceptas que tu pedido se fabrica a pedido en nuestro taller de Lima y que la fecha de entrega estimada se confirma al pagar.",
  "Una vez confirmado el pago no se aceptan cambios ni devoluciones por tratarse de piezas hechas a pedido, salvo defectos de fabricación cubiertos por la garantía de 2 años en la estructura.",
  "Usaremos tus datos únicamente para gestionar tu compra, la entrega, la facturación y la comunicación sobre tu pedido.",
  "La información de pago será procesada mediante plataformas seguras autorizadas.",
  "Al continuar, declaras haber leído y aceptado estos términos y condiciones.",
];

interface Props {
  aceptado: boolean;
  onChange: (v: boolean) => void;
}

export function TerminosCheckout({ aceptado, onChange }: Props) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <div className="flex items-start gap-3">
        <Checkbox
          id="acepta-terminos"
          checked={aceptado}
          onCheckedChange={(v) => onChange(v === true)}
          className="mt-0.5"
        />
        <label htmlFor="acepta-terminos" className="cursor-pointer text-sm leading-snug">
          He leído y acepto los{" "}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault(); // no marcar/desmarcar la casilla al abrir el modal
              setAbierto(true);
            }}
            className="font-medium underline underline-offset-2 hover:text-primary"
          >
            Términos y condiciones
          </button>
        </label>
      </div>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Términos y condiciones</DialogTitle>
            <DialogDescription>Resumen de las condiciones de tu compra.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            {TERMINOS_CHECKOUT.map((p) => (
              <p key={p}>{p}</p>
            ))}
            <p>
              <Link to="/terminos" target="_blank" className="font-medium text-foreground underline underline-offset-2">
                Ver los términos completos
              </Link>
            </p>
          </div>

          <DialogFooter>
            <Button
              className="w-full rounded-full"
              onClick={() => {
                onChange(true);
                setAbierto(false);
              }}
            >
              Aceptar y continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
