// src/routes/perfil/seguridad.tsx
// G&M Mueblería — Seguridad (cambio de contraseña)
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/perfil/seguridad")({
  head: () => ({ meta: [{ title: "Seguridad — G&M Mueblería" }] }),
  component: SeguridadPage,
});

function SeguridadPage() {
  const { user } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (next.length < 6) {
      toast.error("La nueva contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (next !== confirm) {
      toast.error("Las contraseñas nuevas no coinciden");
      return;
    }

    setLoading(true);
    try {
      // Reautenticación con la contraseña actual antes de cambiarla,
      // para evitar que alguien con la sesión abierta la cambie sin saberla.
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user!.email!,
        password: current,
      });
      if (authError) throw new Error("La contraseña actual es incorrecta");

      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw error;

      toast.success("Contraseña actualizada correctamente");
      setCurrent(""); setNext(""); setConfirm("");
    } catch (err: any) {
      toast.error(err.message ?? "No se pudo actualizar la contraseña");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <h2 className="font-display text-xl font-semibold mb-1">Seguridad</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Cambia tu contraseña de acceso.
      </p>

      <Card className="p-6 max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="current">Contraseña actual</Label>
            <Input
              id="current" type="password" required autoComplete="current-password"
              value={current} onChange={(e) => setCurrent(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="next">Nueva contraseña</Label>
            <Input
              id="next" type="password" required minLength={6} autoComplete="new-password"
              value={next} onChange={(e) => setNext(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirmar nueva contraseña</Label>
            <Input
              id="confirm" type="password" required minLength={6} autoComplete="new-password"
              value={confirm} onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading
              ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              : <ShieldCheck className="h-4 w-4 mr-2" />}
            Actualizar contraseña
          </Button>
        </form>
      </Card>
    </section>
  );
}