import { useEffect, useRef, useState } from "react";
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
const dotClass = (key: CountKey) => (key === "insumos" ? "bg-red-500" : "bg-amber-500");

// Ítem activo: fondo suave + barra de color a la izquierda.
const ACTIVE_ITEM =
  "relative before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-full before:bg-primary before:opacity-0 " +
  "data-[active=true]:bg-primary/10 data-[active=true]:font-semibold data-[active=true]:text-primary data-[active=true]:before:opacity-100";

function NavSection({
  group, currentPath, collapsed, counts, open, loaded, onOpenChange,
}: {
  group: NavGroup; currentPath: string; collapsed: boolean; counts: SidebarCounts;
  open: boolean | undefined; loaded: boolean; onOpenChange: (open: boolean) => void;
}) {
  const hasActive = group.items.some((i) => currentPath === i.url);

  // Estado efectivo: lo que la persona dejó guardado; si no hay nada guardado, abierto solo si contiene la página actual.
  const effectiveOpen = open ?? hasActive;

  // Al navegar a una página de este grupo, se abre solo, aunque estuviera plegado.
  // Se compara con la ruta anterior para no reabrirlo cuando la persona lo pliega a propósito.
  const lastPath = useRef<string | null>(null);
  useEffect(() => {
    if (!loaded) return;
    if (lastPath.current !== currentPath && hasActive && open === false) onOpenChange(true);
    lastPath.current = currentPath;
  }, [loaded, currentPath, hasActive, open, onOpenChange]);

  // Con la barra colapsada a iconos, siempre se muestran todos los íconos.
  const isOpen = collapsed || group.alwaysOpen || effectiveOpen;

  // Total de pendientes del grupo: se muestra en el título cuando el grupo está plegado,
  // para que las alertas no queden escondidas.
  const groupTotal = group.items.reduce(
    (sum, i) => sum + (i.countKey ? counts[i.countKey] ?? 0 : 0),
    0,
  );

  const labelClass = "text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/80";

  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange} asChild>
      <SidebarGroup className="py-1">
        {group.alwaysOpen ? (
          <SidebarGroupLabel className={labelClass}>{group.label}</SidebarGroupLabel>
        ) : (
          <SidebarGroupLabel asChild className={labelClass}>
            <CollapsibleTrigger className="group/label w-full cursor-pointer hover:text-sidebar-foreground">
              {group.label}
              {!isOpen && groupTotal > 0 && (
                <span className="ml-2 rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold leading-4 text-amber-800 tabular-nums normal-case tracking-normal">
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
              {group.items.map((item) => {
                const n = item.countKey ? counts[item.countKey] ?? 0 : 0;
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={currentPath === item.url}
                      tooltip={item.title}
                      className={ACTIVE_ITEM}
                    >
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                    {item.countKey && n > 0 && (
                      <>
                        <SidebarMenuBadge
                          className={`${badgeClass(item.countKey)} rounded-full text-[11px] font-semibold`}
                          aria-label={`${n} pendientes`}
                        >
                          {fmtCount(n)}
                        </SidebarMenuBadge>
                        {/* Con la barra colapsada el número se oculta: queda un punto sobre el ícono */}
                        <span
                          aria-hidden
                          className={`pointer-events-none absolute right-1 top-1 hidden h-2 w-2 rounded-full ring-2 ring-sidebar group-data-[collapsible=icon]:block ${dotClass(item.countKey)}`}
                        />
                      </>
                    )}
                  </SidebarMenuItem>
                );
              })}
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

  // Grupos abiertos/plegados, recordados por persona en este navegador.
  const storageKey = `gm.sidebar.groups:${user?.id ?? "anon"}`;
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      setOpenMap(raw ? JSON.parse(raw) : {});
    } catch {
      setOpenMap({});
    }
    setLoaded(true);
  }, [storageKey]);

  const setGroupOpen = (label: string, open: boolean) => {
    setOpenMap((prev) => {
      const next = { ...prev, [label]: open };
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* almacenamiento no disponible: se sigue sin recordar */
      }
      return next;
    });
  };

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
          <NavSection
            key={group.label}
            group={group}
            currentPath={currentPath}
            collapsed={collapsed}
            counts={counts}
            open={openMap[group.label]}
            loaded={loaded}
            onOpenChange={(o) => setGroupOpen(group.label, o)}
          />
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
