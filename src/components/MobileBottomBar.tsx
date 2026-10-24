import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Menu, ShoppingBag, ShoppingCart, Users, Wrench, type LucideIcon } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { useSidebarCounts } from "@/hooks/useSidebarCounts";
import type { AppRole } from "@/hooks/useAuth";

type Tab = { to: string; label: string; icon: LucideIcon; badge?: number };

// Barra inferior solo en pantallas chicas (< md): los accesos más usados a un toque.
// El resto del menú sigue disponible en el botón "Más" (abre el panel lateral).
export function MobileBottomBar({ roles }: { roles: AppRole[] }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { setOpenMobile } = useSidebar();
  const counts = useSidebarCounts(roles);

  const isStaff = roles.includes("admin") || roles.includes("vendedor");
  const isCarpintero = roles.includes("carpintero");

  // En el POS y en la central de KPIs la pantalla ya usa todo el espacio.
  if (pathname === "/pos" || pathname === "/central") return null;

  const left: Tab[] = isStaff
    ? [
        { to: "/dashboard", label: "Inicio", icon: LayoutDashboard },
        { to: "/pedidos", label: "Pedidos", icon: ShoppingBag, badge: counts.pedidos },
      ]
    : isCarpintero
      ? [{ to: "/mi-produccion", label: "Mis órdenes", icon: Wrench }]
      : [];
  const right: Tab[] = isStaff ? [{ to: "/clientes", label: "Clientes", icon: Users }] : [];

  const renderTab = (t: Tab) => {
    const active = pathname === t.to;
    return (
      <Link
        key={t.to}
        to={t.to}
        className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
          active ? "text-primary" : "text-muted-foreground"
        }`}
      >
        <t.icon className="h-5 w-5" />
        {t.label}
        {!!t.badge && t.badge > 0 && (
          <span className="absolute right-[calc(50%-20px)] top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold leading-none text-white tabular-nums">
            {t.badge > 99 ? "99+" : t.badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <nav
      aria-label="Navegación rápida"
      className="fixed inset-x-0 bottom-0 z-20 flex items-end border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {left.map(renderTab)}

      {isStaff && (
        <Link
          to="/pos"
          className="relative -top-3 mx-1 flex flex-col items-center gap-0.5 text-[11px] font-semibold text-primary"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
            <ShoppingCart className="h-6 w-6" />
          </span>
          Vender
        </Link>
      )}

      {right.map(renderTab)}

      <button
        type="button"
        onClick={() => setOpenMobile(true)}
        className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-muted-foreground"
      >
        <Menu className="h-5 w-5" />
        Más
      </button>
    </nav>
  );
}
