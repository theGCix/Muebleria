import { Link } from "@tanstack/react-router";
import { Bell, CheckCircle2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSidebarCounts, type CountKey } from "@/hooks/useSidebarCounts";
import type { AppRole } from "@/hooks/useAuth";

const ITEMS: Array<{ key: CountKey; to: string; one: string; many: string; alert?: boolean }> = [
  { key: "pedidos",  to: "/pedidos",              one: "pedido por atender",               many: "pedidos por atender" },
  { key: "leads",    to: "/leads",                one: "lead nuevo sin contactar",         many: "leads nuevos sin contactar" },
  { key: "carritos", to: "/carritos-abandonados", one: "carrito abandonado sin contactar", many: "carritos abandonados sin contactar" },
  { key: "resenas",  to: "/resenas",              one: "reseña por moderar",               many: "reseñas por moderar" },
  { key: "testimonios", to: "/fotos-clientes", one: "foto de cliente por aprobar", many: "fotos de clientes por aprobar" },
  { key: "insumos",  to: "/insumos",              one: "insumo bajo el stock mínimo",      many: "insumos bajo el stock mínimo", alert: true },
];

export function NotificationsBell({ roles }: { roles: AppRole[] }) {
  // Comparte la consulta (y la caché) con los contadores del sidebar.
  const counts = useSidebarCounts(roles);
  const pending = ITEMS.filter((i) => (counts[i.key] ?? 0) > 0);
  const total = pending.reduce((sum, i) => sum + (counts[i.key] ?? 0), 0);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={total > 0 ? `${total} pendientes` : "Sin pendientes"}
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <Bell className="h-5 w-5" />
          {total > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white tabular-nums">
              {total > 99 ? "99+" : total}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-4 py-3 text-sm font-semibold">Pendientes</div>
        {pending.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-muted-foreground">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            Todo al día, no hay nada pendiente.
          </div>
        ) : (
          <ul className="py-1">
            {pending.map((i) => {
              const n = counts[i.key] ?? 0;
              return (
                <li key={i.key}>
                  <Link
                    to={i.to}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent"
                  >
                    <span
                      className={`flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-semibold tabular-nums ${
                        i.alert ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {n > 99 ? "99+" : n}
                    </span>
                    <span>{n === 1 ? i.one : i.many}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}