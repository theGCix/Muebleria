import { useEffect, useState } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, ShoppingCart, ShoppingBag, ShoppingBasket, Receipt, Users, UserCog, Package,
  LogOut, Home, LayoutGrid, UserPlus, Star, Boxes, Hammer, Wrench, Truck, BarChart2,
  PackageCheck, Tag, ChevronRight, type LucideIcon,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/hooks/useAuth";

type NavItem = { title: string; url: string; icon: LucideIcon; roles: AppRole[] };
type NavGroup = { label: string; items: NavItem[]; alwaysOpen?: boolean };

const ADMIN_VENDEDOR: AppRole[] = ["admin", "vendedor"];
const ADMIN: AppRole[] = ["admin"];
const CARPINTERO: AppRole[] = ["carpintero"];

// Agrupación del menú. Si cambias o agregas rutas, hazlo aquí.
// Un grupo sin ítems visibles para el rol del usuario no se muestra.
const groups: NavGroup[] = [
  {
    label: "General",
    alwaysOpen: true,
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, roles: ADMIN_VENDEDOR },
      { title: "Analytics", url: "/analytics", icon: BarChart2, roles: ADMIN_VENDEDOR },
    ],
  },
  {
    label: "Ventas",
    items: [
      { title: "Realizar Venta", url: "/pos", icon: ShoppingCart, roles: ADMIN_VENDEDOR },
      { title: "Pedidos", url: "/pedidos", icon: ShoppingBag, roles: ADMIN_VENDEDOR },
      { title: "Ventas Realizadas", url: "/ventas", icon: Receipt, roles: ADMIN_VENDEDOR },
    ],
  },
  {
    label: "Clientes y Marketing",
    items: [
      { title: "Clientes", url: "/clientes", icon: Users, roles: ADMIN_VENDEDOR },
      { title: "Leads", url: "/leads", icon: UserPlus, roles: ADMIN_VENDEDOR },
      { title: "Carritos abandonados", url: "/carritos-abandonados", icon: ShoppingBasket, roles: ADMIN_VENDEDOR },
      { title: "Reseñas", url: "/resenas", icon: Star, roles: ADMIN_VENDEDOR },
      { title: "Cupones", url: "/cupones", icon: Tag, roles: ADMIN },
    ],
  },
  {
    label: "Catálogo",
    items: [
      { title: "Productos", url: "/productos", icon: Package, roles: ADMIN },
      { title: "Combos", url: "/combos", icon: PackageCheck, roles: ADMIN },
    ],
  },
  {
    label: "Fabricación",
    items: [
      { title: "Mis órdenes", url: "/mi-produccion", icon: Wrench, roles: CARPINTERO },
      { title: "Producción", url: "/produccion", icon: Hammer, roles: ADMIN_VENDEDOR },
      { title: "Insumos MRP", url: "/insumos", icon: Boxes, roles: ADMIN_VENDEDOR },
      { title: "Proveedores", url: "/proveedores", icon: Truck, roles: ADMIN_VENDEDOR },
    ],
  },
  {
    label: "Administración",
    items: [
      { title: "Usuarios", url: "/usuarios", icon: UserCog, roles: ADMIN },
    ],
  },
];

function NavSection({
  group, currentPath, collapsed,
}: { group: NavGroup; currentPath: string; collapsed: boolean }) {
  const hasActive = group.items.some((i) => currentPath === i.url);
  const [open, setOpen] = useState(group.alwaysOpen || hasActive);

  // Si se navega a una ruta de este grupo (ej. desde un enlace interno), se abre solo.
  useEffect(() => {
    if (hasActive) setOpen(true);
  }, [hasActive]);

  // Con la barra colapsada a iconos, siempre se muestran todos los íconos.
  const isOpen = collapsed || group.alwaysOpen || open;

  return (
    <Collapsible open={isOpen} onOpenChange={setOpen} asChild>
      <SidebarGroup className="py-1">
        {group.alwaysOpen ? (
          <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
        ) : (
          <SidebarGroupLabel asChild>
            <CollapsibleTrigger className="group/label w-full cursor-pointer hover:text-sidebar-foreground">
              {group.label}
              <ChevronRight className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/label:rotate-90" />
            </CollapsibleTrigger>
          </SidebarGroupLabel>
        )}
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={currentPath === item.url} tooltip={item.title}>
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}

export function AppSidebar({ roles }: { roles: AppRole[] }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();

  const visibleGroups = groups
    .map((g) => ({ ...g, items: g.items.filter((i) => i.roles.some((r) => roles.includes(r))) }))
    .filter((g) => g.items.length > 0);

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b">
        <div className="px-2 py-3">
          {!collapsed ? (
            <Link to="/" className="block">
              <div className="font-display text-lg font-semibold leading-tight">G&M</div>
              <div className="text-xs text-muted-foreground">Mueblería · POS</div>
            </Link>
          ) : (
            <div className="font-display text-lg font-semibold text-center">G</div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        {visibleGroups.map((group) => (
          <NavSection key={group.label} group={group} currentPath={currentPath} collapsed={collapsed} />
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link to="/"><Home className="h-4 w-4" /><span>Ir a la tienda</span></Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link to="/central">
                <LayoutGrid className="h-4 w-4" />
                <span>Central KPIs</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={logout}>
              <LogOut className="h-4 w-4" /><span>Cerrar sesión</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}