/**
 * ScrollAwareHeader — envuelve tu navbar/mega-menú actual SIN reescribirlo.
 *
 *   <ScrollAwareHeader>
 *     ...tu logo, mega-menú, buscador...
 *     <AuthSlot />
 *   </ScrollAwareHeader>
 *
 * Comportamiento:
 *  - Sobre el hero: transparente, texto claro (hereda currentColor).
 *  - Tras 48px: se vuelve sólido con blur.
 *  - Bajando rápido: se esconde. Subiendo, o con hover/foco dentro (mega-menú
 *    abierto), vuelve a aparecer.
 *  - Si la página no tiene hero oscuro, usa overHero={false}.
 *
 * Para que el texto cambie de color tus enlaces deben usar `currentColor`
 * (text-inherit) y no un color fijo.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthPortal } from "./auth-portal.store";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export function ScrollAwareHeader({
  children,
  overHero = true,
}: {
  children: ReactNode;
  overHero?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = ref.current!;
      const setSolid = (y: number) => {
        el.dataset.solid = String(!overHero || y > 48);
      };
      setSolid(window.scrollY);

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        let hidden = false;
        const setHidden = (h: boolean) => {
          if (h === hidden) return;
          hidden = h;
          gsap.to(el, { yPercent: h ? -100 : 0, duration: 0.4, ease: "power3.out", overwrite: "auto" });
        };
        ScrollTrigger.create({
          start: 0,
          end: "max",
          onUpdate: (self) => {
            const y = self.scroll();
            setSolid(y);
            const busy = el.matches(":hover, :focus-within");
            setHidden(y > 320 && self.direction === 1 && !busy);
          },
        });
      });
      mm.add("(prefers-reduced-motion: reduce)", () => {
        ScrollTrigger.create({ start: 0, end: "max", onUpdate: (s) => setSolid(s.scroll()) });
      });
      return () => mm.revert();
    },
    { scope: ref, dependencies: [overHero] }
  );

  return (
    <header
      ref={ref}
      data-solid="false"
      className="fixed inset-x-0 top-0 z-50 text-[#F5F3EE] transition-[background-color,box-shadow,color] duration-300
        data-[solid=true]:bg-[#F5F3EE]/85 data-[solid=true]:text-[#1B1A18] data-[solid=true]:shadow-[0_1px_0_rgba(42,29,21,.12)] data-[solid=true]:backdrop-blur-md"
    >
      {children}
    </header>
  );
}

function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  return { session, ready };
}

/** Botón "Ingresar" que se transforma en avatar con saludo al iniciar sesión. */
export function AuthSlot() {
  const { session, ready } = useSession();
  const openPortal = useAuthPortal((s) => s.openPortal);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const prev = useRef<boolean | undefined>(undefined);

  const signed = !!session;
  const meta = session?.user.user_metadata;
  const first: string = (meta?.full_name ?? session?.user.email ?? "").split(/[ @]/)[0];

  // Transformación invitado → sesión (no se anima en la carga inicial).
  useGSAP(
    () => {
      if (!ready) return;
      if (prev.current === undefined) {
        prev.current = signed;
        return;
      }
      if (prev.current === signed) return;
      prev.current = signed;

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(wrap.current, { scale: 0.85, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.5, ease: "back.out(1.7)" });
        if (signed) {
          gsap
            .timeline()
            .to(".greet", { width: "auto", autoAlpha: 1, marginRight: 8, duration: 0.6, ease: "power3.out" })
            .to(".greet", { width: 0, autoAlpha: 0, marginRight: 0, duration: 0.4 }, "+=2.5");
        }
      });
    },
    { scope: wrap, dependencies: [signed, ready] }
  );

  // Imán sutil en el botón "Ingresar" (solo con mouse).
  useGSAP(
    () => {
      const b = btn.current;
      if (!b) return;
      const mm = gsap.matchMedia();
      mm.add("(hover: hover) and (prefers-reduced-motion: no-preference)", () => {
        const qx = gsap.quickTo(b, "x", { duration: 0.4, ease: "power3" });
        const qy = gsap.quickTo(b, "y", { duration: 0.4, ease: "power3" });
        const move = (e: MouseEvent) => {
          const r = b.getBoundingClientRect();
          qx((e.clientX - (r.left + r.width / 2)) * 0.25);
          qy((e.clientY - (r.top + r.height / 2)) * 0.25);
        };
        const leave = () => {
          qx(0);
          qy(0);
        };
        b.addEventListener("mousemove", move);
        b.addEventListener("mouseleave", leave);
        return () => {
          b.removeEventListener("mousemove", move);
          b.removeEventListener("mouseleave", leave);
        };
      });
      return () => mm.revert();
    },
    { dependencies: [signed, ready] }
  );

  if (!ready) return <div className="h-9 w-24" aria-hidden="true" />;

  return (
    <div ref={wrap} className="flex items-center">
      {signed ? (
        <DropdownMenu>
          <span
            className="greet overflow-hidden whitespace-nowrap text-sm"
            style={{ width: 0, opacity: 0 }}
            aria-live="polite"
          >
            Hola, {first}
          </span>
          <DropdownMenuTrigger
            aria-label="Menú de tu cuenta"
            className="grid size-9 place-items-center rounded-full bg-[#A87B4F] font-medium text-[#2A1D15] outline-none focus-visible:ring-2 focus-visible:ring-[#A87B4F] focus-visible:ring-offset-2"
          >
            {first.charAt(0).toUpperCase()}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {/* Agrega aquí "Mis pedidos", "Favoritos", etc. */}
            <DropdownMenuItem onSelect={() => supabase.auth.signOut()}>
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <button
          ref={btn}
          type="button"
          onClick={(e) => openPortal(e.currentTarget)}
          className="rounded-full border border-current px-4 py-1.5 text-sm outline-none transition-colors hover:bg-[#A87B4F] hover:text-[#2A1D15] hover:border-[#A87B4F] focus-visible:ring-2 focus-visible:ring-[#A87B4F] focus-visible:ring-offset-2"
        >
          Ingresar
        </button>
      )}
    </div>
  );
}