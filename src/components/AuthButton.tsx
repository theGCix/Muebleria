// src/components/AuthButton.tsx
// Botón de acceso para el navbar. Reemplaza tu botón/enlace actual de login por <AuthButton />.
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { LoginModal, fetchRoles, type Role } from "@/components/LoginModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Hammer, LayoutDashboard, LogOut,ShoppingBag, UserRound } from "lucide-react";

import { Link } from "@tanstack/react-router";

const NUDGE_KEY = "gm:auth-nudge-seen";

const motionOK = () =>
  typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function initials(session: Session) {
  const name = (session.user.user_metadata?.full_name as string | undefined) || session.user.email || "?";
  return name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function AuthButton({ className }: { className?: string }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [open, setOpen] = useState(false);
  const [nudge, setNudge] = useState(false);
  const avatarRef = useRef<HTMLButtonElement>(null);
  const nudgeRef = useRef<HTMLButtonElement>(null);

  // Sesión
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  // Roles (para mostrar el acceso correcto en el menú)
  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) {
      setRoles([]);
      return;
    }
    let alive = true;
    fetchRoles(userId).then((r) => alive && setRoles(r));
    return () => {
      alive = false;
    };
  }, [userId]);

  // Invitación discreta: una sola vez por sesión del navegador.
  useEffect(() => {
    if (!ready || session) return;
    let seen = false;
    try {
      seen = sessionStorage.getItem(NUDGE_KEY) === "1";
    } catch {
      /* ignorar */
    }
    if (seen) return;
    const show = setTimeout(() => {
      setNudge(true);
      try {
        sessionStorage.setItem(NUDGE_KEY, "1");
      } catch {
        /* ignorar */
      }
    }, 6000);
    return () => clearTimeout(show);
  }, [ready, session]);

  useEffect(() => {
    if (!nudge) return;
    if (motionOK() && nudgeRef.current) {
      gsap.fromTo(
        nudgeRef.current,
        { y: -8, opacity: 0, scale: 0.96 },
        { y: 0, opacity: 1, scale: 1, duration: 0.45, ease: "back.out(1.8)" },
      );
    }
    const hide = setTimeout(() => setNudge(false), 6000);
    return () => clearTimeout(hide);
  }, [nudge]);

  // Al iniciar sesión, el avatar aparece con un pequeño rebote (responde a la acción del usuario).
  useEffect(() => {
    if (!userId || !avatarRef.current || !motionOK()) return;
    gsap.fromTo(
      avatarRef.current,
      { scale: 0.6, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(2)" },
    );
  }, [userId]);

  const openLogin = () => {
    setNudge(false);
    setOpen(true);
  };

  const canSeePanel = roles.includes("admin") || roles.includes("vendedor");
  const name = (session?.user.user_metadata?.full_name as string | undefined) || session?.user.email || "";
  const avatarUrl = session?.user.user_metadata?.avatar_url as string | undefined;

  return (
    <div className={cn("relative", className)}>
      {!ready ? (
        <div className="h-10 w-24" aria-hidden="true" />
      ) : session ? (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button
              ref={avatarRef}
              type="button"
              aria-label="Menú de tu cuenta"
              className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-[#2A1B12] text-sm font-semibold text-[#F3E8D4] ring-offset-background transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A24B] focus-visible:ring-offset-2"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                initials(session)
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <p className="truncate text-sm font-medium">{name}</p>
              {session.user.email && name !== session.user.email && (
                <p className="truncate text-xs text-muted-foreground">{session.user.email}</p>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {canSeePanel && (
              <DropdownMenuItem asChild>
                <a href="/dashboard">
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  Panel
                </a>
              </DropdownMenuItem>
            )}
            {roles.includes("carpintero") && (
              <DropdownMenuItem asChild>
                <a href="/mi-produccion">
                  <Hammer className="mr-2 h-4 w-4" />
                  Mi producción
                </a>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
                <Link to="/perfil/pedidos">
                    <ShoppingBag className="mr-2 h-4 w-4" />
                    Mis pedidos
                </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                <Link to="/perfil/datos">
                    <UserRound className="mr-2 h-4 w-4" />
                    Mi cuenta
                </Link>
                </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => supabase.auth.signOut()}>
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <>
          <button
            type="button"
            onClick={openLogin}
            className="group relative inline-flex h-10 items-center gap-2 overflow-hidden rounded-full bg-[#2A1B12] px-4 text-sm font-medium text-[#F3E8D4] transition-colors hover:bg-[#3A2619] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A24B] focus-visible:ring-offset-2"
          >
            <UserRound className="h-4 w-4 transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110" />
            <span className="relative block h-5 min-w-[4.6rem] overflow-hidden">
              <span className="block whitespace-nowrap transition-transform duration-300 ease-out group-hover:-translate-y-full">
                Ingresar
              </span>
              <span className="absolute inset-x-0 top-full block whitespace-nowrap transition-transform duration-300 ease-out group-hover:-translate-y-full">
                Mi cuenta
              </span>
            </span>
          </button>

          {nudge && (
            <button
              ref={nudgeRef}
              type="button"
              role="status"
              onClick={openLogin}
              className="absolute right-0 top-full z-50 mt-3 w-56 rounded-xl bg-[#2A1B12] p-3 text-left text-sm text-[#F3E8D4] shadow-lg"
            >
              <span className="absolute -top-1 right-6 h-2.5 w-2.5 rotate-45 bg-[#2A1B12]" aria-hidden="true" />
              Ingresa y sigue tus pedidos desde un solo lugar.
            </button>
          )}
        </>
      )}

      <LoginModal open={open} onOpenChange={setOpen} />
    </div>
  );
}