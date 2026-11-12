import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";
import { Home, ChevronRight, Search, X } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuBadge, SidebarHeader, SidebarFooter, SidebarInput, useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SidebarUserBlock } from "@/components/SidebarUserBlock";
import { groups, POS_ITEM, canSee, type NavGroup } from "@/components/nav-config";
import { filtrarMenu, rangoCoincidencia } from "@/lib/buscarMenu";
import type { AppRole } from "@/hooks/useAuth";
import { useSidebarCounts, type CountKey, type SidebarCounts } from "@/hooks/useSidebarCounts";

const fmtCount = (n: number) => (n > 99 ? "99+" : String(n));

// Insumos bajo mínimo y caja con alerta son alertas (rojo); el resto son pendientes (ámbar).
const esAlerta = (key: CountKey) => key === "insumos" || key === "caja";
const badgeClass = (key: CountKey) =>
  esAlerta(key) ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800";
const dotClass = (key: CountKey) => (esAlerta(key) ? "bg-red-500" : "bg-amber-500");

// Ítem activo: fondo suave + barra de color a la izquierda.
const ACTIVE_ITEM =
  "relative before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-full before:bg-primary before:opacity-0 " +
  "data-[active=true]:bg-primary/10 data-[active=true]:font-semibold data-[active=true]:text-primary data-[active=true]:before:opacity-100";

// Resalta en el título lo que coincide con el filtro (sin tildes ni mayúsculas).
function Resaltado({ texto, filtro }: { texto: string; filtro: string }): ReactNode {
  const r = rangoCoincidencia(texto, filtro);
  if (!r) return texto;
  return (
    <>
      {texto.slice(0, r[0])}
      <mark className="rounded-sm bg-amber-200 px-0.5 text-inherit">{texto.slice(r[0], r[1])}</mark>
      {texto.slice(r[1])}
    </>
  );
}

function NavSection({
  group, currentPath, collapsed, counts, open, loaded, onOpenChange, filtro, onElegir,
}: {
  group: NavGroup; currentPath: string; collapsed: boolean; counts: SidebarCounts;
  open: boolean | undefined; loaded: boolean; onOpenChange: (open: boolean) => void; filtro: string; onElegir: () => void;
}) {
  const filtrando = filtro.trim() !== "";
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
  // Mientras se filtra, los grupos con coincidencias se muestran abiertos SIN tocar lo guardado:
  // el estado del usuario (openMap / localStorage) no cambia, así que al limpiar vuelve como estaba.
  const isOpen = collapsed || group.alwaysOpen || filtrando || effectiveOpen;

  // Total de pendientes del grupo: se muestra en el título cuando el grupo está plegado,
  // para que las alertas no queden escondidas.
  const groupTotal = group.items.reduce(
    (sum, i) => sum + (i.countKey ? counts[i.countKey] ?? 0 : 0),
    0,
  );

  const labelClass = "text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/80";

  return (
    <Collapsible open={isOpen} onOpenChange={(o) => { if (!filtrando) onOpenChange(o); }} asChild>
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
                      <Link to={item.url} data-menu-link onClick={filtrando ? onElegir : undefined}>
                        <item.icon className="h-4 w-4" />
                        <span>{filtrando ? <Resaltado texto={item.title} filtro={filtro} /> : item.title}</span>
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
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
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

  // Filtro del menú: solo en memoria (no se guarda). Se aplica sobre lo que el rol puede ver.
  const [filtro, setFiltro] = useState("");
  const filtrando = filtro.trim() !== "";
  const resultado = useMemo(() => filtrarMenu(groups, roles, filtro), [roles, filtro]);
  const visibleGroups = resultado.groups;
  const contenidoRef = useRef<HTMLDivElement>(null);
  const campoRef = useRef<HTMLInputElement>(null);

  // Al navegar (clic, Enter o cualquier otra vía) el filtro se limpia.
  useEffect(() => {
    setFiltro("");
  }, [currentPath]);

  // Se eligió una opción del filtro (clic o Enter): se limpia, incluso si ya se estaba en esa página,
  // y en móvil se cierra el panel.
  const terminarFiltro = () => {
    setFiltro("");
    if (isMobile) setOpenMobile(false);
  };

  const limpiar = () => {
    setFiltro("");
    campoRef.current?.focus();
  };

  const onKeyCampo = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      if (filtro) {
        e.preventDefault();
        e.stopPropagation();
        setFiltro("");
      }
    } else if (e.key === "ArrowDown") {
      const primero = contenidoRef.current?.querySelector<HTMLElement>("[data-menu-link]");
      if (primero) {
        e.preventDefault();
        primero.focus();
      }
    } else if (e.key === "Enter" && filtrando && resultado.primero) {
      e.preventDefault();
      navigate({ to: resultado.primero.url });
      terminarFiltro();
    }
  };

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
      <SidebarContent ref={contenidoRef}>
        {!collapsed && (
          <div role="search" className="px-2 pt-2">
            <div className="relative">
              <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <SidebarInput
                ref={campoRef}
                type="search"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                onKeyDown={onKeyCampo}
                placeholder="Filtrar menú…"
                aria-label="Filtrar el menú"
                autoComplete="off"
                className="h-11 pl-8 pr-9 text-base md:h-9 md:text-sm [&::-webkit-search-cancel-button]:hidden"
              />
              {filtro && (
                <button
                  type="button"
                  onClick={limpiar}
                  aria-label="Limpiar filtro"
                  className="absolute right-0.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring md:h-8 md:w-8"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <p className="sr-only" role="status" aria-live="polite">
              {filtrando ? (resultado.total === 0 ? "Sin resultados" : `${resultado.total} opciones`) : ""}
            </p>
          </div>
        )}
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
            filtro={filtro}
            onElegir={terminarFiltro}
          />
        ))}
        {filtrando && resultado.total === 0 && !collapsed && (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            <p>Sin resultados</p>
            <button
              type="button"
              onClick={limpiar}
              className="mt-2 inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring md:min-h-8"
            >
              Limpiar filtro
            </button>
          </div>
        )}
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
