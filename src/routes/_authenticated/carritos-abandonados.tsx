// src/routes/_authenticated/carritos-abandonados.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {listCarritosAbandonados, updateCarritoEstado, type CarritoAbandonado,} from "@/lib/carrito.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, RefreshCw, MessageCircle, Mail, Phone, ShoppingCart } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/carritos-abandonados")({
  head: () => ({ meta: [{ title: "Carritos abandonados — G&M" }] }),
  component: CarritosAbandonadosPage,
});

const ESTADO_CONFIG: Record<CarritoAbandonado["estado"], { label: string; color: string; bg: string }> = {
  activo:      { label: "Activo",      color: "#1e40af", bg: "#dbeafe" },
  contactado:  { label: "Contactado",  color: "#78350f", bg: "#fef3c7" },
  recuperado:  { label: "Recuperado",  color: "#065f46", bg: "#d1fae5" },
  perdido:     { label: "Perdido",     color: "#6b7280", bg: "#f3f4f6" },
};

const fmt = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n);

function waLink(telefono: string, nombre: string) {
  const digits = telefono.replace(/\D/g, "");
  const withCountry = digits.startsWith("51") ? digits : `51${digits}`;
  const msg = encodeURIComponent(
    `Hola ${nombre || ""} 👋 Vimos que dejaste productos en tu carrito de G&M Mueblería. ¿Te ayudamos a completar tu compra?`
  );
  return `https://wa.me/${withCountry}?text=${msg}`;
}

function CarritoCard({ carrito }: { carrito: CarritoAbandonado }) {
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: (patch: Parameters<typeof updateCarritoEstado>[0]) => updateCarritoEstado(patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["carritos-abandonados"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const cfg = ESTADO_CONFIG[carrito.estado];

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{carrito.nombre || "Visitante sin nombre"}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-0.5">
            {carrito.telefono && (
              <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {carrito.telefono}</span>
            )}
            {carrito.email && (
              <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {carrito.email}</span>
            )}
            {carrito.distrito && <span>{carrito.distrito}</span>}
          </div>
        </div>
        <span
          className="text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0"
          style={{ color: cfg.color, background: cfg.bg }}
        >
          {cfg.label}
        </span>
      </div>

      <div className="mt-3 space-y-1">
        {carrito.items.slice(0, 4).map((item) => (
          <div key={item.id} className="flex items-center justify-between text-xs">
            <span className="truncate">{item.qty}× {item.title}</span>
            <span className="text-muted-foreground flex-shrink-0 ml-2">{fmt(item.price * item.qty)}</span>
          </div>
        ))}
        {carrito.items.length > 4 && (
          <p className="text-xs text-muted-foreground">+{carrito.items.length - 4} más</p>
        )}
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
        <div>
          <p className="font-display font-semibold">{fmt(carrito.subtotal)}</p>
          <p className="text-[10px] text-muted-foreground">
            hace {formatDistanceToNow(new Date(carrito.last_activity_at), { locale: es })}
          </p>
        </div>
        {carrito.telefono && (
          <Button size="sm" variant="outline" asChild>
            <a
              href={waLink(carrito.telefono, carrito.nombre ?? "")}
              target="_blank"
              rel="noreferrer"
              onClick={() => carrito.estado === "activo" && mut.mutate({ id: carrito.id, estado: "contactado" })}
            >
              <MessageCircle className="h-3.5 w-3.5 mr-1.5" /> WhatsApp
            </a>
          </Button>
        )}
      </div>

      <div className="mt-2">
        <Select
          value={carrito.estado}
          onValueChange={(v) => mut.mutate({ id: carrito.id, estado: v as CarritoAbandonado["estado"] })}
        >
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(ESTADO_CONFIG) as CarritoAbandonado["estado"][]).map((e) => (
              <SelectItem key={e} value={e} className="text-xs">{ESTADO_CONFIG[e].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </Card>
  );
}

function CarritosAbandonadosPage() {
  const qc = useQueryClient();
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["carritos-abandonados"],
    queryFn: () => listCarritosAbandonados({ horasMin: 1 }),
  });

  const carritos = data?.carritos ?? [];
  const totalPotencial = carritos.reduce((s, c) => s + c.subtotal, 0);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold">Carritos abandonados</h1>
          <p className="text-muted-foreground mt-0.5">
            Visitantes que dejaron productos sin comprar hace más de 1 hora
          </p>
        </div>
        <Button
          variant="outline" size="sm"
          onClick={() => qc.invalidateQueries({ queryKey: ["carritos-abandonados"] })}
        >
          <RefreshCw className={`h-4 w-4 mr-1.5 ${isFetching ? "animate-spin" : ""}`} /> Actualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border/50 rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Carritos abandonados</p>
          <p className="font-display text-2xl font-semibold">{carritos.length}</p>
        </div>
        <div className="bg-card border border-border/50 rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Valor potencial</p>
          <p className="font-display text-2xl font-semibold">{fmt(totalPotencial)}</p>
        </div>
        <div className="bg-card border border-border/50 rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Con teléfono</p>
          <p className="font-display text-2xl font-semibold">
            {carritos.filter((c) => c.telefono).length}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-14">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : carritos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <ShoppingCart className="h-10 w-10 mb-3 opacity-40" />
          <p>No hay carritos abandonados por ahora 🎉</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {carritos.map((c) => <CarritoCard key={c.id} carrito={c} />)}
        </div>
      )}
    </div>
  );
}