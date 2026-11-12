// src/routes/_authenticated/carritos-abandonados.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {listCarritosAbandonados, updateCarritoEstado, type CarritoAbandonado,} from "@/lib/carrito.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RefreshCw, Mail, Phone, Send, ShoppingCart } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { canalesDisponibles, historialContacto, RecuperarCarritoDialog } from "@/components/admin/RecuperarCarritoDialog";
import { esCorreoValido } from "@/lib/recuperacionCarrito";
import { PeriodFilter, usePeriodo } from "@/components/admin/PeriodFilter";
import { CardGridSkeleton, EmptyState } from "@/components/states";

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

function CarritoCard({ carrito, esAdmin }: { carrito: CarritoAbandonado; esAdmin: boolean }) {
  const qc = useQueryClient();
  const [recuperando, setRecuperando] = useState(false);
  const disp = canalesDisponibles(carrito);
  const contactable = disp.correo || disp.whatsapp;
  const avisos = historialContacto(carrito);
  const mut = useMutation({
    mutationFn: (patch: Parameters<typeof updateCarritoEstado>[0]) => updateCarritoEstado(patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["carritos-abandonados"] });
      qc.invalidateQueries({ queryKey: ["sidebar-counts"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const cfg = ESTADO_CONFIG[carrito.estado];

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {/* Nombre; si no hay, el correo; solo si tampoco hay, «Visitante sin nombre» */}
          <p className="font-medium text-sm truncate">{carrito.nombre || carrito.email || "Visitante sin nombre"}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-0.5">
            {carrito.telefono && (
              <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {carrito.telefono}</span>
            )}
            {carrito.nombre && carrito.email && (
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
        {contactable ? (
          <Button size="sm" variant="outline" className="h-11 sm:h-8" onClick={() => setRecuperando(true)}>
            <Send className="h-3.5 w-3.5 mr-1.5" /> Recuperar
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground text-right">Sin teléfono ni correo válidos</span>
        )}
      </div>

      {avisos.length > 0 && (
        <p className="mt-2 text-[11px] leading-snug text-muted-foreground">{avisos[0]}</p>
      )}

      <div className="mt-2">
        <Select
          value={carrito.estado}
          onValueChange={(v) => mut.mutate({ id: carrito.id, estado: v as CarritoAbandonado["estado"] })}
        >
          <SelectTrigger className="h-11 sm:h-8 text-xs" aria-label="Estado del carrito"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(ESTADO_CONFIG) as CarritoAbandonado["estado"][]).map((e) => (
              <SelectItem key={e} value={e} className="text-xs">{ESTADO_CONFIG[e].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {recuperando && (
        <RecuperarCarritoDialog carrito={carrito} esAdmin={esAdmin} onClose={() => setRecuperando(false)} />
      )}
    </Card>
  );
}

function CarritosAbandonadosPage() {
  const { valor: periodo, setValor: setPeriodo, rango } =
    usePeriodo({ granularidad: "mes", offset: 0 });
  const qc = useQueryClient();
  const { roles } = useAuth();
  const esAdmin = roles.includes("admin");
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["carritos-abandonados"],
    queryFn: () => listCarritosAbandonados({ horasMin: 1 }),
  });

  // Carritos cuya última actividad cae en el periodo elegido. "Borrar" = todo el historial.
  const carritos = useMemo(
    () => (data?.carritos ?? []).filter((c) => rango.enRango(c.last_activity_at ?? c.created_at)),
    [data, rango],
  );
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
          variant="outline" size="sm" className="h-11 sm:h-8"
          onClick={() => qc.invalidateQueries({ queryKey: ["carritos-abandonados"] })}
        >
          <RefreshCw className={`h-4 w-4 mr-1.5 ${isFetching ? "animate-spin" : ""}`} /> Actualizar
        </Button>
      </div>

      {/* Periodo */}
      <PeriodFilter valor={periodo} onChange={setPeriodo} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border/50 rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Carritos abandonados</p>
          <p className="font-display text-2xl font-semibold">{carritos.length}</p>
        </div>
        <div className="bg-card border border-border/50 rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Valor potencial</p>
          <p className="font-display text-2xl font-semibold">{fmt(totalPotencial)}</p>
        </div>
        <div className="bg-card border border-border/50 rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Con correo</p>
          <p className="font-display text-2xl font-semibold">
            {carritos.filter((c) => esCorreoValido(c.email)).length}
          </p>
        </div>
        <div className="bg-card border border-border/50 rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Con teléfono</p>
          <p className="font-display text-2xl font-semibold">
            {carritos.filter((c) => c.telefono).length}
          </p>
        </div>
      </div>

      {isLoading ? (
        <CardGridSkeleton count={6} />
      ) : carritos.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="No hay carritos abandonados por ahora"
          description="Cuando un visitante deje productos sin comprar por más de 1 hora, aparecerá aquí para que lo contactes."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {carritos.map((c) => <CarritoCard key={c.id} carrito={c} esAdmin={esAdmin} />)}
        </div>
      )}
    </div>
  );
}