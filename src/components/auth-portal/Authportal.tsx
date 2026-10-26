/**
 * AuthPortal — cuerpo compartido por <LoginModal /> y la ruta /login.
 *
 * Idea: el login es "entrar al taller". A la izquierda, la veta de la madera
 * se dibuja sola y se desplaza al avanzar de paso; al iniciar sesión las
 * líneas se cierran y aparece el saludo. Es el único gesto llamativo: todo lo
 * demás es quieto y legible.
 *
 * Tokens (cámbialos por los de tu marca):
 *   nogal  #2A1D15   roble  #A87B4F   hueso  #F5F3EE   grafito #1B1A18
 * Tipografía: usa una clase `font-display` (ej. "Bricolage Grotesque") para
 * títulos y deja tu sans actual para el resto.
 *
 * Dependencias: npm i gsap @gsap/react
 */
import { useMemo, useRef, useState, type FormEvent } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

gsap.registerPlugin(useGSAP);

type Step = "email" | "password" | "done";
type Mode = "login" | "signup";

const W = 600;
const H = 800;
const LINES = 26;

/** Curvas con amplitud irregular para que parezcan veta y no ondas. */
function buildGrain() {
  return Array.from({ length: LINES }, (_, i) => {
    const y = 30 + (i * (H - 60)) / (LINES - 1);
    const a = 18 + ((i * 37) % 29);
    const s = i % 2 ? 1 : -1;
    return `M-20 ${y} C 140 ${y - a * s}, 260 ${y + a * s}, 320 ${y} S 500 ${y - a * s * 0.6}, 620 ${y + a * 0.4}`;
  });
}

const reduced = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

interface Props {
  /** Se llama cuando la animación de éxito terminó. */
  onDone: () => void;
}

export function AuthPortal({ onDone }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<Step>("email");
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const lines = useMemo(buildGrain, []);

  const copy = {
    email: {
      title: "Tus muebles, tu cuenta.",
      text: "Guarda favoritos, retoma tu carrito y sigue cada pedido desde el taller hasta tu casa.",
    },
    password: {
      title: mode === "login" ? "Qué bueno verte de nuevo." : "Vamos a abrirte la puerta.",
      text:
        mode === "login"
          ? "Tu carrito y tus favoritos están donde los dejaste."
          : "Con tu cuenta puedes cotizar a medida y seguir tus pedidos.",
    },
    done: { title: `Hola, ${name}.`, text: "Abriendo tu cuenta." },
  }[step];

  // 1) Entrada única: la veta se dibuja y respira muy despacio.
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(".grain path", {
          strokeDashoffset: 1,
          duration: 1.6,
          ease: "power2.out",
          stagger: { each: 0.04, from: "center" },
        });
        gsap.to(".grain path", {
          x: (i) => (i % 2 ? 14 : -14),
          duration: 6,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
          stagger: 0.15,
        });
      });
      return () => mm.revert();
    },
    { scope: root }
  );

  // 2) Cada paso: el contenido entra escalonado y la veta se desplaza.
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          ".step-in",
          { y: 16, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 0.5, stagger: 0.06, ease: "power3.out" }
        );
        gsap.to(".grain", {
          xPercent: step === "email" ? 0 : step === "password" ? -8 : -14,
          duration: 1.1,
          ease: "power3.inOut",
        });
        if (step === "done") {
          gsap.fromTo(
            ".check circle, .check path",
            { strokeDashoffset: 1 },
            { strokeDashoffset: 0, duration: 0.6, stagger: 0.25, delay: 0.2, ease: "power2.out" }
          );
          gsap.to(".grain path", {
            scaleY: 0,
            transformOrigin: "50% 50%",
            duration: 0.8,
            delay: 0.5,
            stagger: { each: 0.03, from: "edges" },
            ease: "power3.inOut",
          });
          gsap.delayedCall(1.7, onDone);
        }
      });
      mm.add("(prefers-reduced-motion: reduce)", () => {
        if (step === "done") gsap.delayedCall(0.8, onDone);
      });
      return () => mm.revert();
    },
    { scope: root, dependencies: [step] }
  );

  const goTo = (next: Step) => {
    if (reduced() || !root.current) return setStep(next);
    gsap.to(root.current.querySelectorAll(".form .step-in"), {
      y: -10,
      autoAlpha: 0,
      duration: 0.18,
      stagger: 0.02,
      ease: "power2.in",
      onComplete: () => setStep(next),
    });
  };

  const fail = (msg: string) => {
    setError(msg);
    const form = root.current?.querySelector(".form");
    if (form && !reduced()) {
      gsap.fromTo(form, { x: -10 }, { x: 0, duration: 0.6, ease: "elastic.out(1, 0.3)" });
    }
  };

  const onEmail = (e: FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return fail("Revisa el correo: falta el @ o el dominio.");
    }
    setError(null);
    setNotice(null);
    goTo("password");
  };

  const onPassword = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    if (mode === "login") {
      const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (err || !data.user) {
        return fail("Correo o contraseña incorrectos. Prueba de nuevo o pide un enlace por correo.");
      }
      setName(data.user.user_metadata?.full_name?.split(" ")[0] ?? email.split("@")[0]);
      return goTo("done");
    }

    const { data, error: err } = await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (err) return fail("No pudimos crear la cuenta. Usa una contraseña de al menos 6 caracteres.");
    if (!data.session) {
      return setNotice("Te enviamos un correo para confirmar tu cuenta. Ábrelo y vuelve aquí.");
    }
    setName(email.split("@")[0]);
    goTo("done");
  };

  const magicLink = async () => {
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.href },
    });
    if (err) return fail("No pudimos enviar el enlace. Intenta otra vez en un momento.");
    setNotice("Listo: revisa tu correo y toca el enlace para entrar.");
  };

  const google = () =>
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.href },
    });

  return (
    <div
      ref={root}
      className="grid overflow-hidden bg-[#F5F3EE] text-[#1B1A18] md:grid-cols-[1.05fr_1fr]"
    >
      {/* Lado taller */}
      <aside className="relative hidden min-h-[540px] overflow-hidden bg-[#2A1D15] p-10 text-[#F5F3EE] md:flex md:flex-col md:justify-end">
        <svg
          className="grain pointer-events-none absolute inset-y-0 -left-[15%] h-full w-[130%]"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid slice"
          fill="none"
          aria-hidden="true"
        >
          {lines.map((d, i) => (
            <path
              key={i}
              d={d}
              pathLength={1}
              strokeDasharray={1}
              stroke="#A87B4F"
              strokeOpacity={0.25 + (i % 5) * 0.12}
              strokeWidth={i % 7 === 0 ? 2 : 1}
            />
          ))}
        </svg>
        <div className="relative">
          <h2 className="step-in font-display text-4xl leading-[1.05]">{copy.title}</h2>
          <p className="step-in mt-3 max-w-xs text-sm leading-relaxed text-[#F5F3EE]/70">
            {copy.text}
          </p>
        </div>
      </aside>

      {/* Lado formulario */}
      <section className="relative flex min-h-[540px] flex-col justify-center p-8 sm:p-10">
        <div className="form">
          {step === "email" && (
            <form onSubmit={onEmail} noValidate>
              <h3 className="step-in font-display text-2xl">Ingresa o crea tu cuenta</h3>
              <Button
                type="button"
                variant="outline"
                className="step-in mt-6 w-full"
                onClick={google}
              >
                Continuar con Google
              </Button>
              <p className="step-in my-5 text-center text-xs text-[#1B1A18]/55">
                o con tu correo
              </p>
              <div className="step-in space-y-2">
                <Label htmlFor="portal-email">Correo</Label>
                <Input
                  id="portal-email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="focus-visible:ring-[#A87B4F]"
                />
              </div>
              <Button
                type="submit"
                className="step-in mt-4 w-full bg-[#2A1D15] text-[#F5F3EE] hover:bg-[#3b2a1e]"
              >
                Continuar
              </Button>
            </form>
          )}

          {step === "password" && (
            <form onSubmit={onPassword}>
              <button
                type="button"
                onClick={() => goTo("email")}
                className="step-in text-sm text-[#1B1A18]/60 underline underline-offset-4"
              >
                {email} — cambiar correo
              </button>
              <div className="step-in mt-6 space-y-2">
                <Label htmlFor="portal-password">Contraseña</Label>
                <Input
                  id="portal-password"
                  type="password"
                  autoFocus
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="focus-visible:ring-[#A87B4F]"
                />
              </div>
              <Button
                type="submit"
                disabled={busy || password.length < 6}
                className="step-in mt-4 w-full bg-[#2A1D15] text-[#F5F3EE] hover:bg-[#3b2a1e]"
              >
                {busy ? "Verificando…" : mode === "login" ? "Entrar" : "Crear cuenta"}
              </Button>
              <div className="step-in mt-5 flex flex-col items-start gap-2 text-sm">
                <button type="button" onClick={magicLink} className="underline underline-offset-4">
                  Enviarme un enlace al correo
                </button>
                <button
                  type="button"
                  onClick={() => setMode(mode === "login" ? "signup" : "login")}
                  className="underline underline-offset-4"
                >
                  {mode === "login" ? "Primera vez aquí: crear cuenta" : "Ya tengo cuenta"}
                </button>
              </div>
            </form>
          )}

          {step === "done" && (
            <div className="grid place-items-center text-center">
              <svg className="check" width="72" height="72" viewBox="0 0 72 72" fill="none" aria-hidden="true">
                <circle cx="36" cy="36" r="32" stroke="#A87B4F" strokeWidth="3" pathLength={1} strokeDasharray={1} />
                <path
                  d="M22 37l10 10 18-22"
                  stroke="#2A1D15"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pathLength={1}
                  strokeDasharray={1}
                />
              </svg>
              <p className="step-in mt-6 font-display text-2xl">Hola, {name}</p>
            </div>
          )}

          <p role="alert" className="mt-4 min-h-5 text-sm text-red-700">
            {error}
          </p>
          <p role="status" className="text-sm text-[#55624A]">
            {notice}
          </p>
        </div>
      </section>
    </div>
  );
}