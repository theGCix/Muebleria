// src/components/Header.tsx
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CartDrawer } from "./CartDrawer";
import { WishlistDrawer } from "./WishlistDrawer";
import { LoginModal } from "./LoginModal";
import { CategoryMegaMenu } from "./CategoryMegaMenu";
import { CategoryMobileAccordion } from "./CategoryMobileAccordion";
import { useState } from "react";
import { Menu, X, LogIn, User, Search, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSearchStore } from "@/stores/searchStore";

const navLinks = [
  { label: "Inicio", href: "/" },
  { label: "Catálogo", href: "#catalogo" },
  { label: "Testimonios", href: "#testimonios" },
];

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [mobileSearch, setMobileSearch] = useState("");
  const { user, roles } = useAuth();
  const navigate = useNavigate();
  const setQuery = useSearchStore((s) => s.setQuery);

  const isStaff = roles.includes("admin") || roles.includes("vendedor");
  const isCarpintero = roles.includes("carpintero") && !isStaff;

  const displayName = user?.user_metadata?.full_name
    ?? user?.email?.split("@")[0]
    ?? "Mi cuenta";

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  const goToCatalogo = (term: string) => {
    setQuery(term);
    navigate({ to: "/", hash: "catalogo" });
  };

  const handleDesktopSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = (new FormData(e.currentTarget).get("q") as string) ?? "";
    goToCatalogo(value);
  };

  const handleMobileSearch = (e: React.FormEvent) => {
    e.preventDefault();
    goToCatalogo(mobileSearch);
    setMobileOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full">
        {/* Barra superior de servicio */}
        <div className="w-full bg-primary text-primary-foreground">
          <div className="container mx-auto flex h-8 items-center justify-center px-4 md:px-6">
            <p className="flex items-center gap-1.5 text-[11px] sm:text-xs font-medium tracking-wide text-center">
              <Truck className="h-3.5 w-3.5 flex-shrink-0" />
              Recojo en tienda o delivery a todo Lima
            </p>
          </div>
        </div>

        {/* Navbar principal */}
        <div className="w-full border-b border-border/40 bg-background/80 backdrop-blur-xl">
          <div className="container mx-auto flex h-20 items-center gap-4 px-4 md:px-6">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 flex-shrink-0">
              <div className="h-9 w-9 rounded-md bg-[var(--gradient-warm)] flex items-center justify-center text-primary-foreground font-display font-bold">
                G
              </div>
              <div className="hidden sm:flex flex-col leading-none">
                <span className="font-display text-lg font-semibold tracking-tight">G&amp;M</span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Mueblería</span>
              </div>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-6 flex-shrink-0">
              <CategoryMegaMenu />
              {navLinks.map((l) => (
                <a key={l.label} href={l.href} className="text-sm text-foreground/70 hover:text-foreground transition-colors">
                  {l.label}
                </a>
              ))}
            </nav>

            {/* Buscador (desktop, siempre visible) */}
            <form
              onSubmit={handleDesktopSearch}
              className="hidden md:flex flex-1 max-w-md ml-2"
            >
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  name="q"
                  placeholder="Buscar sofás, comedores, camas…"
                  className="pl-9 rounded-full bg-secondary/40 border-border/50 focus-visible:ring-accent"
                />
              </div>
            </form>

            {/* Desktop actions */}
            <div className="hidden md:flex items-center gap-3 ml-auto flex-shrink-0">
              {user ? (
                <>
                  {/* Panel admin para staff */}
                  {isStaff && (
                    <Link to="/dashboard" className="text-sm text-foreground/60 hover:text-foreground transition-colors">
                      Panel admin
                    </Link>
                  )}
                  {/* Mis órdenes para carpintero */}
                  {isCarpintero && (
                    <Link to="/mi-produccion" className="text-sm text-foreground/60 hover:text-foreground transition-colors">
                      Mis órdenes
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
                <button
                  onClick={() => setLoginOpen(true)}
                  className="text-sm text-foreground/60 hover:text-foreground transition-colors flex items-center gap-1"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  Iniciar sesión
                </button>
              )}
              <WishlistDrawer />
              <CartDrawer />
            </div>

            {/* Mobile: wishlist + cart + hamburger */}
            <div className="flex items-center gap-2 md:hidden ml-auto">
              <WishlistDrawer />
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
            <div className="md:hidden border-t border-border/40 bg-background/95 backdrop-blur-xl px-4 py-4 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Buscador mobile */}
              <form onSubmit={handleMobileSearch} className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={mobileSearch}
                  onChange={(e) => setMobileSearch(e.target.value)}
                  placeholder="Buscar productos…"
                  className="pl-9 rounded-full bg-secondary/40 border-border/50"
                />
              </form>

              {/* Categorías (acordeón) */}
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1 px-1">
                  Categorías
                </p>
                <CategoryMobileAccordion onNavigate={() => setMobileOpen(false)} />
              </div>

              {/* Links generales */}
              <div className="pt-1">
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
              </div>

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
                    {isCarpintero && (
                      <Link
                        to="/mi-produccion"
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center gap-2 text-sm text-foreground/70 hover:text-foreground py-2"
                      >
                        Mis órdenes
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
                  <button
                    onClick={() => { setLoginOpen(true); setMobileOpen(false); }}
                    className="flex items-center gap-2 text-sm text-foreground/70 hover:text-foreground py-2"
                  >
                    <LogIn className="h-4 w-4" />
                    Iniciar sesión
                  </button>
                )}
                <Button asChild className="w-full rounded-full">
                  <a href="#catalogo" onClick={() => setMobileOpen(false)}>Ver catálogo</a>
                </Button>
              </div>
            </div>
          )}
        </div>
      </header>

      <LoginModal open={loginOpen} onOpenChange={setLoginOpen} />
    </>
  );
}