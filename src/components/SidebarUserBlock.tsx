import { Link, useNavigate } from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";
import { ChevronsUpDown, LogOut, UserCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/hooks/useAuth";

// Orden de prioridad: si alguien tiene varios roles, se muestra el más alto.
const ROLE_PRIORITY: AppRole[] = ["admin", "vendedor", "carpintero", "cliente"];

const ROLE_META: Record<AppRole, { label: string; className: string }> = {
  admin:      { label: "Administrador", className: "bg-violet-100 text-violet-700" },
  vendedor:   { label: "Vendedor",      className: "bg-sky-100 text-sky-700" },
  carpintero: { label: "Carpintero",    className: "bg-emerald-100 text-emerald-700" },
  cliente:    { label: "Cliente",       className: "bg-muted text-muted-foreground" },
};

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : name.trim().slice(0, 2);
  return letters.toUpperCase() || "?";
}

export function SidebarUserBlock({ user, roles }: { user: User | null; roles: AppRole[] }) {
  const { state, isMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();

  const email = user?.email ?? "";
  const displayName: string =
    user?.user_metadata?.full_name ?? (email.split("@")[0] || "Mi cuenta");
  const avatarUrl: string | undefined = user?.user_metadata?.avatar_url;

  const sortedRoles = ROLE_PRIORITY.filter((r) => roles.includes(r));
  const mainRole = sortedRoles[0];
  const extraRoles = sortedRoles.length - 1;

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              tooltip={displayName}
              className="data-[state=open]:bg-sidebar-accent"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                <AvatarFallback className="rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                  {initialsOf(displayName)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate text-sm font-medium">{displayName}</span>
                {mainRole && (
                  <span className="truncate text-xs text-muted-foreground">
                    {ROLE_META[mainRole].label}
                    {extraRoles > 0 && ` +${extraRoles}`}
                  </span>
                )}
              </div>
              <ChevronsUpDown className="ml-auto h-4 w-4 text-muted-foreground" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-64 rounded-lg"
            side={isMobile || !collapsed ? "top" : "right"}
            align={collapsed && !isMobile ? "end" : "start"}
            sideOffset={8}
          >
            <DropdownMenuLabel className="font-normal">
              <div className="text-sm font-medium">{displayName}</div>
              {email && <div className="truncate text-xs text-muted-foreground">{email}</div>}
              {sortedRoles.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {sortedRoles.map((r) => (
                    <span
                      key={r}
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ROLE_META[r].className}`}
                    >
                      {ROLE_META[r].label}
                    </span>
                  ))}
                </div>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/perfil/datos" className="cursor-pointer">
                <UserCircle className="mr-2 h-4 w-4" />
                Mi cuenta
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={logout} className="cursor-pointer text-red-600 focus:text-red-600">
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}