// src/routes/auth.callback.tsx
// Destino de redirección tras iniciar sesión con Google/Facebook o con enlace mágico.
// Supabase procesa el token de la URL automáticamente (detectSessionInUrl);
// aquí solo esperamos la sesión, leemos el rol y redirigimos.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({ meta: [{ title: "Ingresando… — G&M Mueblería" }] }),
  component: AuthCallback,
});

type Role = "admin" | "vendedor" | "carpintero" | "cliente";

function AuthCallback() {
  const navigate = useNavigate();
  const handled = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // Si el proveedor devolvió un error (usuario canceló, redirect_uri_mismatch, etc.)
    const params = new URLSearchParams(window.location.search + "&" + window.location.hash.replace(/^#/, ""));
    const oauthError = params.get("error_description") || params.get("error");
    if (oauthError) {
      toast.error(decodeURIComponent(oauthError.replace(/\+/g, " ")));
      setFailed(true);
      navigate({ to: "/", replace: true });
      return;
    }

    const redirectByRole = async (userId: string) => {
      if (handled.current) return;
      handled.current = true;

      const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      const roles = (data ?? []).map((r) => r.role as Role);

      if (roles.includes("admin") || roles.includes("vendedor")) {
        navigate({ to: "/dashboard", replace: true });
      } else if (roles.includes("carpintero")) {
        navigate({ to: "/mi-produccion", replace: true });
      } else {
        // Cliente: volver a donde estaba (ej. checkout). Solo rutas internas.
        let back = "/";
        try {
          const saved = sessionStorage.getItem("gm:auth-return");
          if (saved && saved.startsWith("/") && !saved.startsWith("//") && !saved.startsWith("/auth/")) back = saved;
          sessionStorage.removeItem("gm:auth-return");
        } catch {
          /* almacenamiento no disponible */
        }
        window.location.replace(back);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session?.user) {
        redirectByRole(session.user.id);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) redirectByRole(data.session.user.id);
    });

    // Si en 8 s no hay sesión, algo falló: volvemos al inicio.
    const timeout = setTimeout(() => {
      if (!handled.current) {
        setFailed(true);
        toast.error("No se pudo completar el inicio de sesión. Intenta de nuevo.");
        navigate({ to: "/", replace: true });
      }
    }, 8000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        {failed ? "Redirigiendo…" : "Completando tu inicio de sesión…"}
      </p>
    </div>
  );
}