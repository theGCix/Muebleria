// src/components/AuthButton.tsx
// Acceso del navbar (desktop):
//  · sin sesión  → pastilla con brillo y llave que se balancea como las etiquetas del hero
//  · con sesión  → avatar con iniciales + menú de cuenta según rol
//  · al volver de un login exitoso, el avatar "aparece" con un aro y un saludo breve
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";
import { ChevronDown, Hammer, KeyRound, LayoutDashboard, LogOut, Package, UserRound } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AppRole } from "@/hooks/useAuth";

interface AuthButtonProps {
  user: User | null;
  roles: AppRole[];
  loading?: boolean;
  onLogin: () => void;
  onLogout: () => void;
}

const ROL_LABEL: Record<AppRole, string> = {
  admin: "Administrador",
  vendedor: "Vendedor",
  carpintero: "Carpintero",
  cliente: "Cliente",
};

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

const ITEM = "cursor-pointer gap-2 transition-transform data-[highlighted]:translate-x-0.5";

export function AuthButton({ user, roles, loading, onLogin, onLogout }: AuthButtonProps) {
  const [saludo, setSaludo] = useState(false);

  // Si el modal marcó un login reciente, animamos la aparición del avatar una sola vez
  useEffect(() => {
    if (!user) return;
    let reciente = false;
    try {
      reciente = sessionStorage.getItem("gm:welcome") === "1";
      if (reciente) sessionStorage.removeItem("gm:welcome");
    } catch {
      /* sin storage */
    }
    if (!reciente) return;
    setSaludo(true);
    const t = setTimeout(() => setSaludo(false), 2600);
    return () => clearTimeout(t);
  }, [user?.id]);

  // Evita el parpadeo "Iniciar sesión" → avatar mientras se resuelve la sesión
  if (loading) {
    return <div className="h-9 w-36 animate-pulse rounded-full bg-muted" aria-hidden="true" />;
  }

  if (!user) {
    return (
      <button
        type="button"
        onClick={onLogin}
        className="auth-shine auth-cta group relative flex items-center gap-2 rounded-full bg-[image:var(--gradient-warm)] py-1 pl-1 pr-4 text-sm font-medium text-accent-foreground shadow-sm transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:translate-y-0"
      >
        <span className="auth-cta-icon grid h-7 w-7 place-items-center rounded-full bg-white/20">
          <KeyRound className="h-3.5 w-3.5" />
        </span>
        Iniciar sesión
      </button>
    );
  }

  const isStaff = roles.includes("admin") || roles.includes("vendedor");
  const isCarpintero = roles.includes("carpintero") && !isStaff;
  const rol: AppRole = roles.includes("admin")
    ? "admin"
    : roles.includes("vendedor")
      ? "vendedor"
      : roles.includes("carpintero")
        ? "carpintero"
        : "cliente";
  const nombre = (user.user_metadata?.full_name as string | undefined) ?? user.email?.split("@")[0] ?? "Mi cuenta";
  const nombrePila = nombre.split(" ")[0];

  return (
    <div className="relative">
      {/* modal={false}: no bloquea el scroll del body, así el navbar sticky no se rompe */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="group flex items-center gap-2 rounded-full border border-border/60 bg-background/70 py-1 pl-1 pr-2.5 text-sm transition-[border-color,box-shadow] duration-200 hover:border-accent/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:border-accent"
          >
            <span
              className={`relative grid h-8 w-8 place-items-center rounded-full bg-[image:var(--gradient-warm)] text-xs font-semibold text-accent-foreground ${saludo ? "auth-pop" : ""}`}
            >
              {iniciales(nombre)}
              {saludo && <span className="auth-ring pointer-events-none absolute inset-0 rounded-full" />}
            </span>
            <span className="max-w-[8rem] truncate text-foreground/80">{nombrePila}</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" sideOffset={8} className="w-60">
          <DropdownMenuLabel className="font-normal">
            <p className="truncate text-sm font-medium">{nombre}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            <span className="mt-1.5 inline-block rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent">
              {ROL_LABEL[rol]}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {isStaff && (
            <DropdownMenuItem asChild className={ITEM}>
              <Link to="/dashboard">
                <LayoutDashboard className="h-4 w-4" /> Panel admin
              </Link>
            </DropdownMenuItem>
          )}
          {isCarpintero && (
            <DropdownMenuItem asChild className={ITEM}>
              <Link to="/mi-produccion">
                <Hammer className="h-4 w-4" /> Mis órdenes
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild className={ITEM}>
            <Link to="/perfil">
              <UserRound className="h-4 w-4" /> Mi cuenta
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className={ITEM}>
            <Link to="/perfil/pedidos">
              <Package className="h-4 w-4" /> Mis pedidos
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onLogout} className={`${ITEM} text-destructive focus:text-destructive`}>
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Saludo breve tras iniciar sesión */}
      {saludo && (
        <span
          role="status"
          className="pointer-events-none absolute right-0 top-full z-50 mt-2 whitespace-nowrap rounded-full bg-[var(--color-walnut)] px-3 py-1 text-xs text-[var(--color-cream)] shadow-lg animate-in fade-in slide-in-from-top-1 duration-300"
        >
          ¡Hola, {nombrePila}!
        </span>
      )}
    </div>
  );
}