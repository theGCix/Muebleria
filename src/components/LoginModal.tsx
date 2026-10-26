// src/components/LoginModal.tsx
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Mail, MailCheck, Sparkles } from "lucide-react";

gsap.registerPlugin(useGSAP);

export type Role = "admin" | "vendedor" | "carpintero" | "cliente";

export async function fetchRoles(userId: string): Promise<Role[]> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r: { role: string }) => r.role as Role);
}

interface LoginModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Callback opcional ejecutado tras un login exitoso.
   * Recibe los roles del usuario para que el llamador decida qué hacer.
   * Si no se provee, el comportamiento por defecto es redirigir según rol:
   *   admin/vendedor → /dashboard
   *   carpintero     → /mi-produccion
   *   cliente        → permanece en la misma página
   */
  onSuccess?: (roles: Role[]) => void;
}

/* ───────────────────────── Configuración ───────────────────────── */

type Mode = "login" | "signup" | "magic";
type Stage = "form" | "sent" | "success";
type Provider = "google" | "facebook";
type LastMethod = Provider | "password" | "magic";

const LAST_METHOD_KEY = "gm:last-auth-method";
const LAST_EMAIL_KEY = "gm:last-auth-email";
const MODE_ORDER: Mode[] = ["login", "signup", "magic"];

// Ajusta estos textos a lo que la tienda realmente ofrece.
const TIPS = [
  { title: "Sigue tu pedido de punta a punta", body: "Del taller a tu puerta, con avisos en cada etapa." },
  { title: "Entérate primero de las ofertas", body: "Las fechas especiales llegan antes a tu cuenta." },
  { title: "Hecho a mano por carpinteros peruanos", body: "Cada pieza tiene un responsable y una historia." },
];

const CHIP_COLORS = ["#C9A24B", "#B5793F", "#2A1B12", "#7A8F6B"];
const STRENGTH = ["Débil", "Débil", "Aceptable", "Buena", "Fuerte"];
const STRENGTH_COLOR = ["", "bg-red-500", "bg-amber-500", "bg-lime-600", "bg-emerald-600"];

const AUTH_ERRORS: Record<string, string> = {
  "Invalid login credentials": "Correo o contraseña incorrectos",
  "Email not confirmed": "Confirma tu correo antes de ingresar",
  "User already registered": "Ese correo ya tiene cuenta. Prueba iniciar sesión",
};

/* ───────────────────────── Utilidades ───────────────────────── */

const motionOK = () =>
  typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const store = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* almacenamiento no disponible */
    }
  },
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function passwordScore(p: string) {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return s;
}

function displayName(u: User) {
  const full = u.user_metadata?.full_name as string | undefined;
  return full?.split(" ")[0] || u.email?.split("@")[0] || "";
}

/* ───────────────────────── Arte decorativo ───────────────────────── */

function GrainArt() {
  const lines = Array.from({ length: 10 }, (_, i) => {
    const y = 40 + i * 60;
    const k = i % 2 === 0 ? 40 : 28;
    return `M-20 ${y} C 90 ${y - k}, 170 ${y + k}, 270 ${y} S 380 ${y - 30}, 430 ${y + 10}`;
  });
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 400 600"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      stroke="#E9D8BC"
      strokeOpacity=".16"
      strokeWidth="1.2"
    >
      {lines.map((d, i) => (
        <path key={i} className="grain" d={d} />
      ))}
      {[16, 30, 46, 64].map((r) => (
        <ellipse key={r} className="grain" cx="270" cy="360" rx={r} ry={r * 1.6} />
      ))}
    </svg>
  );
}

/* ───────────────────────── Experiencia ───────────────────────── */

function AuthExperience({
  onSuccess,
  close,
}: {
  onSuccess?: (roles: Role[]) => void;
  close: () => void;
}) {
  // Este componente solo existe mientras el modal está abierto:
  // al cerrarse se desmonta y todo el estado se reinicia solo.
  const [mode, setMode] = useState<Mode>("login");
  const [stage, setStage] = useState<Stage>("form");
  const [sentKind, setSentKind] = useState<"signup" | "magic">("magic");
  const [email, setEmail] = useState(() => store.get(LAST_EMAIL_KEY) ?? "");
  const [returning] = useState(() => !!store.get(LAST_EMAIL_KEY));
  const [lastMethod] = useState(() => store.get(LAST_METHOD_KEY) as LastMethod | null);
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<Provider | null>(null);
  const [welcome, setWelcome] = useState("");
  const [tip, setTip] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dirRef = useRef(1);
  const mountedRef = useRef(false);

  const emailOk = /^\S+@\S+\.\S+$/.test(email);
  const score = passwordScore(password);
  const busy = loading || !!oauthLoading;

  const checks =
    mode === "signup"
      ? [fullName.trim().length > 1, emailOk, password.length >= 6]
      : mode === "magic"
        ? [emailOk]
        : [emailOk, password.length >= 6];
  const done = checks.filter(Boolean).length;

  /* ── Animaciones ── */

  // 1) Veta de madera: se dibuja una sola vez al abrir (momento principal).
  useGSAP(
    () => {
      if (!motionOK() || !rootRef.current) return;
      const paths = gsap.utils.toArray<SVGGeometryElement>(".grain", rootRef.current);
      paths.forEach((p) => {
        const len = p.getTotalLength();
        gsap.set(p, { strokeDasharray: len, strokeDashoffset: len });
      });
      gsap.to(paths, { strokeDashoffset: 0, duration: 1.8, ease: "power2.out", stagger: 0.12 });
    },
    { scope: rootRef },
  );

  // 2) Mensajes rotativos del panel lateral.
  useEffect(() => {
    if (!motionOK()) return;
    const id = setInterval(() => setTip((t) => (t + 1) % TIPS.length), 4800);
    return () => clearInterval(id);
  }, []);

  useGSAP(
    () => {
      if (!motionOK()) return;
      gsap.fromTo(".tip", { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" });
    },
    { scope: rootRef, dependencies: [tip] },
  );

  // 3) Entrada del panel al cambiar de modo / etapa.
  useGSAP(
    () => {
      const panel = panelRef.current;
      if (!panel || !motionOK()) return;
      const first = !mountedRef.current;
      mountedRef.current = true;
      gsap.fromTo(
        panel,
        { opacity: 0, x: first ? 0 : dirRef.current * 18 },
        { opacity: 1, x: 0, duration: 0.28, ease: "power2.out", clearProps: "transform,opacity" },
      );
      gsap.from(panel.querySelectorAll(".fx"), {
        y: 10,
        opacity: 0,
        duration: 0.4,
        stagger: 0.05,
        ease: "power3.out",
        delay: first ? 0.15 : 0.05,
        clearProps: "transform,opacity",
      });
      gsap.from(panel.querySelectorAll(".pop"), {
        scale: 0.5,
        opacity: 0,
        duration: 0.6,
        ease: "back.out(2)",
        delay: 0.1,
      });
    },
    { scope: rootRef, dependencies: [mode, stage] },
  );

  // 4) Barra de avance: se llena a medida que los campos son válidos.
  useGSAP(
    () => {
      gsap.to(".piece-fill", {
        scaleX: (i: number) => (stage !== "form" || checks[i] ? 1 : 0),
        duration: motionOK() ? 0.5 : 0,
        ease: "power3.out",
        stagger: 0.06,
        overwrite: "auto",
      });
    },
    { scope: rootRef, dependencies: [checks.join(), stage, mode] },
  );

  // 5) Celebración al entrar.
  useGSAP(
    () => {
      if (stage !== "success" || !motionOK()) return;
      const tl = gsap.timeline();
      tl.fromTo(".ok-circle", { strokeDashoffset: 176 }, { strokeDashoffset: 0, duration: 0.5, ease: "power2.out" }).fromTo(
        ".ok-tick",
        { strokeDashoffset: 40 },
        { strokeDashoffset: 0, duration: 0.35, ease: "power2.out" },
        "-=0.05",
      );
      const chips = gsap.utils.toArray<HTMLElement>(".chip");
      chips.forEach((c, i) => {
        const a = (i / chips.length) * Math.PI * 2 + Math.random() * 0.4;
        const d = 60 + Math.random() * 40;
        tl.fromTo(
          c,
          { x: 0, y: 0, scale: 0, opacity: 1, rotate: 0 },
          {
            x: Math.cos(a) * d,
            y: Math.sin(a) * d,
            scale: 1,
            opacity: 0,
            rotate: Math.random() * 360,
            duration: 0.9,
            ease: "power2.out",
          },
          0.55,
        );
      });
    },
    { scope: rootRef, dependencies: [stage] },
  );

  const shake = () => {
    if (!motionOK() || !panelRef.current) return;
    gsap.to(panelRef.current, {
      keyframes: { x: [-10, 9, -6, 4, 0], easeEach: "power1.inOut" },
      duration: 0.4,
    });
  };

  /* ── Acciones ── */

  const switchMode = (next: Mode) => {
    if (next === mode || busy) return;
    dirRef.current = MODE_ORDER.indexOf(next) > MODE_ORDER.indexOf(mode) ? 1 : -1;
    const el = panelRef.current;
    if (!el || !motionOK()) {
      setMode(next);
      return;
    }
    gsap.to(el, {
      opacity: 0,
      x: -dirRef.current * 18,
      duration: 0.18,
      ease: "power1.in",
      onComplete: () => setMode(next),
    });
  };

  const finishLogin = async (user: User) => {
    setWelcome(displayName(user));
    setStage("success");
    const [roles] = await Promise.all([fetchRoles(user.id), wait(motionOK() ? 1400 : 300)]);

    if (onSuccess) {
      // El llamador controla qué pasa (ej. CartDrawer → ir a checkout)
      onSuccess(roles);
    } else if (roles.includes("admin") || roles.includes("vendedor")) {
      window.location.href = "/dashboard";
    } else if (roles.includes("carpintero")) {
      window.location.href = "/mi-produccion";
    }
    // cliente → no redirige, queda en la tienda
    close();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setLoading(true);
    try {
      store.set(LAST_EMAIL_KEY, email);

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        store.set(LAST_METHOD_KEY, "password");
        if (data.session?.user) {
          await finishLogin(data.session.user);
        } else {
          setSentKind("signup");
          setStage("sent");
        }
      } else if (mode === "magic") {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;
        store.set(LAST_METHOD_KEY, "magic");
        setSentKind("magic");
        setStage("sent");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        store.set(LAST_METHOD_KEY, "password");
        if (data.session?.user) {
          await finishLogin(data.session.user);
        } else {
          close();
        }
      }
    } catch (err) {
      const raw = (err as Error).message || "";
      toast.error(AUTH_ERRORS[raw] ?? (raw || "Error de autenticación"));
      shake();
    } finally {
      setLoading(false);
    }
  };

  const loginWithOAuth = async (provider: Provider) => {
    setOauthLoading(provider);
    try {
      store.set(LAST_METHOD_KEY, provider);
      // OAuth siempre redirige a /auth/callback — el rol se maneja allí
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
    } catch (err) {
      toast.error((err as Error).message || `Error al conectar con ${provider}`);
      setOauthLoading(null);
      shake();
    }
  };

  /* ── Textos por modo ── */

  const copy = {
    login: {
      title: returning ? "Qué bueno verte de nuevo" : "Iniciar sesión",
      desc: "Accede a tu cuenta de G&M Mueblería",
      cta: "Ingresar",
    },
    signup: {
      title: "Crear cuenta",
      desc: "Regístrate para comenzar a comprar",
      cta: "Crear cuenta",
    },
    magic: {
      title: "Entra sin contraseña",
      desc: "Te enviamos un enlace a tu correo y entras con un clic",
      cta: "Enviarme el enlace",
    },
  }[mode];

  const progressLabel =
    stage !== "form"
      ? ""
      : done === checks.length
        ? "Todo listo para continuar"
        : `${done} de ${checks.length} campos completos`;

  const lastBadge = (m: LastMethod) =>
    lastMethod === m ? (
      <span className="absolute right-3 rounded-full bg-[#C9A24B]/20 px-2 py-0.5 text-[10px] font-medium text-[#8A6A1F] dark:text-[#E3C170]">
        Último usado
      </span>
    ) : null;

  /* ── Render ── */

  return (
    <div ref={rootRef} className="contents">
      {/* Panel de marca (solo escritorio) */}
      <aside
        aria-hidden="true"
        className="relative hidden min-h-[560px] flex-col justify-between overflow-hidden bg-[#2A1B12] p-8 text-[#F3E8D4] md:flex"
      >
        <GrainArt />
        <p className="relative font-display text-xl font-semibold tracking-tight">G&amp;M Mueblería</p>
        <div className="relative">
          <div className="tip">
            <h3 className="font-display text-2xl leading-snug">{TIPS[tip].title}</h3>
            <p className="mt-2 max-w-[28ch] text-sm text-[#F3E8D4]/70">{TIPS[tip].body}</p>
          </div>
          <div className="mt-6 flex gap-1.5">
            {TIPS.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1 rounded-full bg-[#C9A24B] transition-all duration-500",
                  i === tip ? "w-8" : "w-2 opacity-40",
                )}
              />
            ))}
          </div>
        </div>
      </aside>

      {/* Formulario */}
      <div className="max-h-[92vh] overflow-y-auto p-6 sm:p-8">
        {/* Barra de avance (persistente entre modos) */}
        <div className="mb-5">
          <div className="flex gap-1.5" aria-hidden="true">
            {checks.map((_, i) => (
              <span key={`${mode}-${i}`} className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
                <span
                  className="piece-fill block h-full origin-left rounded-full bg-[#B5793F]"
                  style={{ transform: "scaleX(0)" }}
                />
              </span>
            ))}
          </div>
          <p className="mt-2 min-h-4 text-xs text-muted-foreground" aria-live="polite">
            {progressLabel}
          </p>
        </div>

        <div ref={panelRef}>
          {stage === "form" && (
            <>
              <DialogHeader className="fx mb-4 text-center md:text-left">
                <DialogTitle className="font-display text-2xl font-semibold">{copy.title}</DialogTitle>
                <DialogDescription className="text-sm">{copy.desc}</DialogDescription>
              </DialogHeader>

              {mode !== "magic" && (
                <>
                  <div className="fx mb-4 space-y-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="relative w-full gap-2"
                      onClick={() => loginWithOAuth("google")}
                      disabled={busy}
                    >
                      {oauthLoading === "google" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <svg className="h-4 w-4" viewBox="0 0 24 24">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                      )}
                      Continuar con Google
                      {lastBadge("google")}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      className="relative w-full gap-2"
                      onClick={() => loginWithOAuth("facebook")}
                      disabled={busy}
                    >
                      {oauthLoading === "facebook" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="#1877F2">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                        </svg>
                      )}
                      Continuar con Facebook
                      {lastBadge("facebook")}
                    </Button>
                  </div>

                  <div className="fx relative mb-4">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-background px-2 text-muted-foreground">o con correo</span>
                    </div>
                  </div>
                </>
              )}

              <form onSubmit={submit} className="space-y-3">
                {mode === "signup" && (
                  <div className="fx">
                    <Label htmlFor="modal_full_name" className="text-sm">Nombre completo</Label>
                    <Input
                      id="modal_full_name"
                      required
                      maxLength={100}
                      autoComplete="name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      disabled={loading}
                      className="mt-1"
                    />
                  </div>
                )}

                <div className="fx">
                  <Label htmlFor="modal_email" className="text-sm">Correo electrónico</Label>
                  <Input
                    id="modal_email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className="mt-1"
                  />
                </div>

                {mode !== "magic" && (
                  <div className="fx">
                    <Label htmlFor="modal_password" className="text-sm">Contraseña</Label>
                    <div className="relative mt-1">
                      <Input
                        id="modal_password"
                        type={showPass ? "text" : "password"}
                        required
                        minLength={6}
                        autoComplete={mode === "signup" ? "new-password" : "current-password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass((v) => !v)}
                        aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
                        className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>

                    {mode === "signup" && password && (
                      <div className="mt-2 flex items-center gap-1.5" aria-live="polite">
                        {[0, 1, 2, 3].map((i) => (
                          <span
                            key={i}
                            className={cn(
                              "h-1 flex-1 rounded-full transition-colors duration-300",
                              i < score ? STRENGTH_COLOR[score] : "bg-border",
                            )}
                          />
                        ))}
                        <span className="ml-1 w-16 text-right text-xs text-muted-foreground">
                          {STRENGTH[score]}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <Button type="submit" className="fx w-full gap-2" disabled={busy}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : mode === "magic" ? (
                    <Sparkles className="h-4 w-4" />
                  ) : (
                    <Mail className="h-4 w-4" />
                  )}
                  {copy.cta}
                </Button>
              </form>

              <div className="fx mt-4 flex flex-col items-center gap-1.5 text-sm text-muted-foreground">
                {mode === "login" && (
                  <button
                    type="button"
                    onClick={() => switchMode("magic")}
                    className="transition-colors hover:text-foreground"
                  >
                    Prefiero entrar sin contraseña
                    {lastMethod === "magic" && " (último usado)"}
                  </button>
                )}
                {mode === "magic" && (
                  <button
                    type="button"
                    onClick={() => switchMode("login")}
                    className="transition-colors hover:text-foreground"
                  >
                    Usar mi contraseña
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => switchMode(mode === "signup" ? "login" : "signup")}
                  className="transition-colors hover:text-foreground"
                >
                  {mode === "signup" ? "¿Ya tienes cuenta? Inicia sesión" : "¿No tienes cuenta? Regístrate"}
                </button>
              </div>
            </>
          )}

          {stage === "sent" && (
            <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
              <div className="pop mb-4 grid h-14 w-14 place-items-center rounded-full bg-[#C9A24B]/20 text-[#8A6A1F] dark:text-[#E3C170]">
                <MailCheck className="h-7 w-7" />
              </div>
              <DialogHeader className="fx items-center text-center">
                <DialogTitle className="font-display text-2xl font-semibold">Revisa tu correo</DialogTitle>
                <DialogDescription className="max-w-[32ch] text-sm">
                  Enviamos un enlace a <span className="font-medium text-foreground">{email}</span>.{" "}
                  {sentKind === "signup"
                    ? "Confirma tu cuenta y vuelve a la tienda."
                    : "Ábrelo desde este dispositivo para entrar."}
                </DialogDescription>
              </DialogHeader>
              <Button variant="outline" className="fx mt-6 w-full max-w-xs" onClick={() => setStage("form")}>
                Usar otro correo
              </Button>
            </div>
          )}

          {stage === "success" && (
            <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
              <div className="relative">
                {Array.from({ length: 14 }, (_, i) => (
                  <span
                    key={i}
                    className="chip absolute left-1/2 top-1/2 h-2 w-2 rounded-sm opacity-0"
                    style={{ backgroundColor: CHIP_COLORS[i % CHIP_COLORS.length] }}
                  />
                ))}
                <svg
                  viewBox="0 0 64 64"
                  className="h-20 w-20"
                  fill="none"
                  stroke="#B5793F"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle className="ok-circle" cx="32" cy="32" r="28" strokeDasharray="176" />
                  <path className="ok-tick" d="M19 33 L28 42 L45 23" strokeDasharray="40" />
                </svg>
              </div>
              <DialogHeader className="fx mt-5 items-center text-center">
                <DialogTitle className="font-display text-2xl font-semibold">
                  {welcome ? `¡Hola, ${welcome}!` : "¡Bienvenido!"}
                </DialogTitle>
                <DialogDescription className="text-sm">Te llevamos a tu espacio…</DialogDescription>
              </DialogHeader>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Modal ───────────────────────── */

export function LoginModal({ open, onOpenChange, onSuccess }: LoginModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-[880px] gap-0 overflow-hidden border-0 p-0 sm:max-w-[880px] md:grid md:grid-cols-[0.85fr_1.15fr]">
        <AuthExperience onSuccess={onSuccess} close={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}