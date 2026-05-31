import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { CartDrawer } from "./CartDrawer";
import { useState } from "react";
import { Menu, X, LogIn, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const navLinks = [
  { label: "Inicio", href: "/" },
  { label: "Categorías", href: "#categorias" },
  { label: "Catálogo", href: "#catalogo" },
  { label: "Testimonios", href: "#testimonios" },
];

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, roles } = useAuth();
  const navigate = useNavigate();
  const isStaff = roles.includes("admin") || roles.includes("vendedor");

  const displayName = user?.user_metadata?.full_name
    ?? user?.email?.split("@")[0]
    ?? "Mi cuenta";

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-20 items-center justify-between px-4 md:px-6">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-md bg-[var(--gradient-warm)] flex items-center justify-center text-primary-foreground font-display font-bold">
            G
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-display text-lg font-semibold tracking-tight">G&amp;M</span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Mueblería</span>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((l) => (
            <a key={l.label} href={l.href} className="text-sm text-foreground/70 hover:text-foreground transition-colors">
              {l.label}
            </a>
          ))}
        </nav>

        {/* Desktop actions */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              {isStaff && (
                <Link to="/dashboard" className="text-sm text-foreground/60 hover:text-foreground transition-colors">
                  Panel admin
                </Link>
              )}
              
              <span className="flex items-center gap-1.5 text-sm text-foreground/80">
                <User className="h-3.5 w-3.5" />
                {displayName}
              </span>

              <Link to="/perfil" className="text-sm text-foreground/60 hover:text-foreground transition-colors">
                Mi cuenta
              </Link>
              <button onClick={handleLogout} className="text-sm text-foreground/60 hover:text-foreground transition-colors">
                Salir
              </button>
            </>
          ) : (
            <Link to="/login" className="text-sm text-foreground/60 hover:text-foreground transition-colors flex items-center gap-1">
              <LogIn className="h-3.5 w-3.5" />
              Iniciar sesión
            </Link>
          )}
          <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full">
            <a href="#catalogo">Ver catálogo</a>
          </Button>
          <CartDrawer />
        </div>

        {/* Mobile: cart + hamburger */}
        <div className="flex items-center gap-2 md:hidden">
          <CartDrawer />
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="p-2 rounded-md text-foreground/70 hover:text-foreground hover:bg-accent"
            aria-label="Menú"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border/40 bg-background/95 backdrop-blur-xl px-4 py-4 space-y-3">
          {navLinks.map((l) => (
            <a
              key={l.label}
              href={l.href}
              onClick={() => setMobileOpen(false)}
              className="block text-sm text-foreground/70 hover:text-foreground py-2 border-b border-border/30 last:border-0"
            >
              {l.label}
            </a>
          ))}
          <div className="pt-2 space-y-2">
            {user ? (
              <>
                <div className="flex items-center gap-2 text-sm text-foreground/80 py-2">
                  <User className="h-4 w-4" />
                  {displayName}
                </div>
                {isStaff && (
                  <Link
                    to="/dashboard"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 text-sm text-foreground/70 hover:text-foreground py-2"
                  >
                    Panel admin
                  </Link>
                )}

                <Link
                  to="/perfil"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 text-sm text-foreground/70 hover:text-foreground py-2"
                >
                  Mi cuenta
                </Link>
                <button
                  onClick={() => { handleLogout(); setMobileOpen(false); }}
                  className="flex items-center gap-2 text-sm text-foreground/70 hover:text-foreground py-2"
                >
                  Salir
                </button>
              </>
            ) : (
              <Link
                to="/login"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 text-sm text-foreground/70 hover:text-foreground py-2"
              >
                <LogIn className="h-4 w-4" />
                Iniciar sesión
              </Link>
            )}
            <Button asChild className="w-full rounded-full">
              <a href="#catalogo" onClick={() => setMobileOpen(false)}>Ver catálogo</a>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}