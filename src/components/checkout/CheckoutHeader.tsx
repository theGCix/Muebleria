// src/components/checkout/CheckoutHeader.tsx
// Cabecera mínima del checkout: solo el logo (vuelve al inicio) y «Compra segura». Sin menú ni buscador
// para que el cliente no se distraiga mientras paga.
import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";

export function CheckoutHeader() {
  return (
    <header className="border-b border-border bg-background">
      <div className="container mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link
          to="/"
          aria-label="G&M Mueblería, ir al inicio"
          className="flex min-h-[44px] flex-col justify-center leading-none"
        >
          <span className="font-display text-xl font-bold tracking-tight text-foreground">G&amp;M</span>
          <span className="text-[10px] uppercase tracking-[0.25em] text-foreground/80">Mueblería</span>
        </Link>
        <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <Lock className="h-4 w-4 text-primary" aria-hidden /> Compra segura
        </p>
      </div>
    </header>
  );
}