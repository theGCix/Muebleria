// src/routes/perfil.tsx
// G&M Mueblería — Layout de "Mi cuenta" con menú lateral
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  ShoppingBag, MapPin, FileText, Heart, ShieldCheck, User, LogOut,
} from "lucide-react";

export const Route = createFileRoute("/perfil")({
  head: () => ({ meta: [{ title: "Mi cuenta — G&M Mueblería" }] }),
  component: PerfilLayout,
});

const NAV_ITEMS = [
  { to: "/perfil/pedidos" as const, label: "Mis pedidos", icon: ShoppingBag },
  { to: "/perfil/datos" as const, label: "Mis datos", icon: User },
  { to: "/perfil/direcciones" as const, label: "Mis direcciones", icon: MapPin },
  { to: "/perfil/facturacion" as const, label: "Datos de facturación", icon: FileText },
  { to: "/perfil/favoritos" as const, label: "Mis favoritos", icon: Heart },
  { to: "/perfil/seguridad" as const, label: "Seguridad", icon: ShieldCheck },
];

function PerfilLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex justify-center py-32">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
        <Footer />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <User className="h-16 w-16 text-muted-foreground" />
          <h2 className="font-display text-2xl">Inicia sesión para ver tu perfil</h2>
          <Button asChild><Link to="/login">Iniciar sesión</Link></Button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-10 max-w-5xl">

        {/* Header perfil */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-semibold">Mi cuenta</h1>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout} className="hidden sm:inline-flex">
            <LogOut className="h-4 w-4 mr-2" /> Cerrar sesión
          </Button>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Menú lateral */}
          <nav className="md:w-56 flex-shrink-0">
            <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-2 md:pb-0 -mx-1 px-1 md:mx-0 md:px-0">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.to || (pathname === "/perfil" && item.to === "/perfil/pedidos");
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
              <button
                onClick={handleLogout}
                className="flex sm:hidden items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground whitespace-nowrap"
              >
                <LogOut className="h-4 w-4 flex-shrink-0" /> Cerrar sesión
              </button>
            </div>
          </nav>

          {/* Contenido de la sección activa */}
          <div className="flex-1 min-w-0">
            <Outlet />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
