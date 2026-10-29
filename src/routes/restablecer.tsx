// src/routes/restablecer.tsx
// Destino del enlace "¿Olvidaste tu contraseña?" que Supabase envía por correo.
// Al abrir el enlace, Supabase crea una sesión de recuperación (evento PASSWORD_RECOVERY);
// aquí el cliente define su nueva contraseña con updateUser.
// Requiere agregar  {SITE_URL}/restablecer  en Supabase → Authentication → URL Configuration → Redirect URLs.
import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthModalStore } from "@/stores/authModalStore";

export const Route = createFileRoute("/restablecer")({
  head: () => ({ meta: [{ title: "Restablecer contraseña — G&M Mueblería" }] }),
  component: RestablecerPage,
});

function RestablecerPage() {
  const navigate = useNavigate();
  const [listo, setListo] = useState<boolean | null>(null); // null = verificando
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((evento, sesion) => {
      if (evento === "PASSWORD_RECOVERY" || (evento === "SIGNED_IN" && sesion)) setListo(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setListo(true);
    });
    // Si en 6 s no hay sesión de recuperación, el enlace venció o ya se usó.
    const t = setTimeout(() => setListo((v) => (v === null ? false : v)), 6000);
    return () => {
      subscription.unsubscribe();
      clearTimeout(t);
    };
  }, []);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nueva.length < 6) return toast.error("La contraseña debe tener al menos 6 caracteres");
    if (nueva !== confirmar) return toast.error("Las contraseñas no coinciden");
    setGuardando(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: nueva });
      if (error) throw error;
      toast.success("Contraseña actualizada. Ya puedes seguir comprando.");
      navigate({ to: "/", replace: true });
    } catch (err) {
      toast.error((err as Error).message || "No se pudo actualizar la contraseña");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="px-4 py-16">
        <div className="mx-auto w-full max-w-sm rounded-2xl border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h1 className="font-display text-xl font-semibold">Nueva contraseña</h1>
          </div>

          {listo === null && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Verificando tu enlace…
            </p>
          )}

          {listo === false && (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Este enlace venció o ya fue usado. Pide uno nuevo desde "¿Olvidaste tu contraseña?" al iniciar sesión.
              </p>
              <Button onClick={() => useAuthModalStore.getState().openLogin()}>Iniciar sesión</Button>
              <p>
                <Link to="/" className="text-muted-foreground underline">Volver al inicio</Link>
              </p>
            </div>
          )}

          {listo && (
            <form onSubmit={guardar} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="nueva">Nueva contraseña</Label>
                <Input id="nueva" type="password" autoComplete="new-password" required value={nueva} onChange={(e) => setNueva(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmar">Confirmar contraseña</Label>
                <Input id="confirmar" type="password" autoComplete="new-password" required value={confirmar} onChange={(e) => setConfirmar(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={guardando}>
                {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar contraseña"}
              </Button>
            </form>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
