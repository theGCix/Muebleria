import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, ShoppingCart, Receipt, Users, UserCog, Package, LogOut, Home } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/hooks/useAuth";

const items = [
  { title: "POS", url: "/pos", icon: ShoppingCart, roles: ["admin", "vendedor"] as AppRole[] },
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, roles: ["admin", "vendedor"] as AppRole[] },
  { title: "Ventas", url: "/ventas", icon: Receipt, roles: ["admin", "vendedor"] as AppRole[] },
  { title: "Clientes", url: "/clientes", icon: Users, roles: ["admin", "vendedor"] as AppRole[] },
  { title: "Productos", url: "/productos", icon: Package, roles: ["admin"] as AppRole[] },
  { title: "Usuarios", url: "/usuarios", icon: UserCog, roles: ["admin"] as AppRole[] },
];

export function AppSidebar({ roles }: { roles: AppRole[] }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();

  const visible = items.filter((i) => i.roles.some((r) => roles.includes(r)));

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
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
        <SidebarGroup>
          <SidebarGroupLabel>Operación</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visible.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={currentPath === item.url}>
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link to="/"><Home className="h-4 w-4" /><span>Ir a la tienda</span></Link>
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
