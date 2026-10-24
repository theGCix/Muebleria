import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";
import { Home, ChevronRight } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuBadge, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SidebarUserBlock } from "@/components/SidebarUserBlock";
import { groups, POS_ITEM, canSee, type NavGroup } from "@/components/nav-config";
import type { AppRole } from "@/hooks/useAuth";
import { useSidebarCounts, type CountKey, type SidebarCounts } from "@/hooks/useSidebarCounts";

const fmtCount = (n: number) => (n > 99 ? "99+" : String(n));

// Insumos bajo mínimo es una alerta (rojo); el resto son pendientes (ámbar).
const badgeClass = (key: CountKey) =>
  key === "insumos" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800";

function NavSection({
  group, currentPath, collapsed, counts,
}: { group: NavGroup; currentPath: string; collapsed: boolean; counts: SidebarCounts }) {
  const hasActive = group.items.some((i) => currentPath === i.url);
  const [open, setOpen] = useState(group.alwaysOpen || hasActive);

  // Si se navega a una ruta de este grupo (ej. desde un enlace interno), se abre solo.
  useEffect(() => {
    if (hasActive) setOpen(true);
  }, [hasActive]);

  // Con la barra colapsada a iconos, siempre se muestran todos los íconos.
  const isOpen = collapsed || group.alwaysOpen || open;

  // Total de pendientes del grupo: se muestra en el título cuando el grupo está plegado,
  // para que las alertas no queden escondidas.
  const groupTotal = group.items.reduce(
    (sum, i) => sum + (i.countKey ? counts[i.countKey] ?? 0 : 0),
    0,
  );

  return (
    <Collapsible open={isOpen} onOpenChange={setOpen} asChild>
      <SidebarGroup className="py-1">
        {group.alwaysOpen ? (
          <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
        ) : (
          <SidebarGroupLabel asChild>
            <CollapsibleTrigger className="group/label w-full cursor-pointer hover:text-sidebar-foreground">
              {group.label}
              {!isOpen && groupTotal > 0 && (
                <span className="ml-2 rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold leading-4 text-amber-800 tabular-nums">
                  {fmtCount(groupTotal)}
                </span>
              )}
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
                  {item.countKey && (counts[item.countKey] ?? 0) > 0 && (
                    <SidebarMenuBadge
                      className={`${badgeClass(item.countKey)} rounded-full text-[11px] font-semibold`}
                      aria-label={`${counts[item.countKey]} pendientes`}
                    >
                      {fmtCount(counts[item.countKey] ?? 0)}
                    </SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}

export function AppSidebar({ roles, user }: { roles: AppRole[]; user: User | null }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const counts = useSidebarCounts(roles);

  const visibleGroups = groups
    .map((g) => ({ ...g, items: g.items.filter((i) => canSee(i, roles)) }))
    .filter((g) => g.items.length > 0);

  const showPos = canSee(POS_ITEM, roles);

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
        {showPos && (
          <SidebarGroup className="pb-0">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  size="lg"
                  tooltip={POS_ITEM.title}
                  className="justify-center bg-primary font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground group-data-[collapsible=icon]:justify-center"
                >
                  <Link to={POS_ITEM.url}>
                    <POS_ITEM.icon className="h-5 w-5" />
                    <span>{POS_ITEM.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        )}
        {visibleGroups.map((group) => (
          <NavSection key={group.label} group={group} currentPath={currentPath} collapsed={collapsed} counts={counts} />
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Ir a la tienda">
              <Link to="/"><Home className="h-4 w-4" /><span>Ir a la tienda</span></Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarUserBlock user={user} roles={roles} />
      </SidebarFooter>
    </Sidebar>
  );
}
