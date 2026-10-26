/**
 * Dos superficies para el mismo portal:
 *  - <LoginModal />  montar UNA vez en el layout raíz (junto al <Outlet />).
 *  - <LoginPage />   componente de la ruta /login (ej. checkout redirige a
 *                    /login?redirect=/checkout).
 */
import { useRef } from "react";
import gsap from "gsap";
import { useNavigate } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { AuthPortal } from "./AuthPortal";
import { useAuthPortal } from "./auth-portal.store";

const reduced = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Revela/oculta el panel con un círculo que nace en el botón del navbar. */
function reveal(
  el: HTMLElement,
  origin: { x: number; y: number } | null,
  opening: boolean,
  done?: () => void
) {
  if (reduced()) {
    gsap.set(el, { clearProps: "clipPath" });
    return done?.();
  }
  const r = el.getBoundingClientRect();
  const x = (origin?.x ?? r.left + r.width / 2) - r.left;
  const y = (origin?.y ?? r.top + r.height / 2) - r.top;
  const full = `circle(${Math.hypot(r.width, r.height)}px at ${x}px ${y}px)`;
  const none = `circle(0px at ${x}px ${y}px)`;

  gsap.fromTo(
    el,
    { clipPath: opening ? none : full },
    {
      clipPath: opening ? full : none,
      duration: opening ? 0.7 : 0.4,
      ease: opening ? "power3.out" : "power3.in",
      onComplete: () => {
        if (opening) gsap.set(el, { clearProps: "clipPath" });
        done?.();
      },
    }
  );
}

export function LoginModal() {
  const { open, origin, redirect, close } = useAuthPortal();
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  const finish = () => {
    close();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (redirect) navigate({ to: redirect as any });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) return;
        // Mantenemos el diálogo montado hasta que termine la animación de salida.
        if (ref.current) reveal(ref.current, origin, false, close);
        else close();
      }}
    >
      <DialogContent
        ref={ref}
        // Oculto hasta que GSAP lo revele (evita el parpadeo del primer frame).
        style={{ clipPath: "circle(0px at 50% 50%)" }}
        onOpenAutoFocus={() => ref.current && reveal(ref.current, origin, true)}
        // Desactivamos la animación por defecto de shadcn para que no choque con GSAP.
        className="max-w-4xl overflow-hidden border-0 p-0 data-[state=closed]:animate-none data-[state=open]:animate-none"
      >
        <DialogTitle className="sr-only">Iniciar sesión</DialogTitle>
        <DialogDescription className="sr-only">
          Ingresa o crea tu cuenta de G&amp;M Mueblería
        </DialogDescription>
        <AuthPortal onDone={finish} />
      </DialogContent>
    </Dialog>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const redirect = new URLSearchParams(window.location.search).get("redirect");

  return (
    <main className="grid min-h-dvh place-items-center bg-[#1B1A18] p-4">
      <div className="w-full max-w-4xl overflow-hidden rounded-xl">
        <AuthPortal
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onDone={() => navigate({ to: (redirect ?? "/") as any })}
        />
      </div>
    </main>
  );
}