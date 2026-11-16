// src/components/Header.tsx
import { CampanaTicker } from "@/components/CampanaTicker";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CartDrawer } from "./CartDrawer";
import { WishlistDrawer } from "./WishlistDrawer";
import { LoginModal } from "./LoginModal";
import { AuthButton } from "./AuthButton";
import { CategoryMobileAccordion } from "./CategoryMobileAccordion";
import { useEffect, useState } from "react";
import { Menu, X, User, Search, Truck, PackageCheck, Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSearchStore } from "@/stores/searchStore";
import { useCombos } from "@/hooks/useCombos";
import { useOfertas } from "@/hooks/useProducts";

// Enlaces del navbar: el activo se distingue con color pleno y una línea de acento debajo
const navLinkCls = (activo: boolean, tono: "base" | "accent" = "base", tactil = false) =>
  [
    `relative flex items-center gap-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${tactil ? "min-h-11 py-2" : "py-2"}`,
    "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:origin-left after:rounded-full after:bg-accent after:transition-transform after:duration-300",
    activo ? "after:scale-x-100" : "after:scale-x-0",
    activo
      ? tono === "accent" ? "text-accent-strong" : "text-foreground"
      : tono === "accent" ? "text-accent-strong hover:text-accent-strong/80" : "text-foreground/70 hover:text-foreground",
  ].join(" ");

// Menú de secciones del boceto v3: categorías con el nombre del boceto («Muebles» = Salas). En móvil se ven las 3 primeras; el resto, en el menú ☰.
const NAV_CATEGORIAS = [
  { slug: "muebles", label: "Salas" },
  { slug: "comedores", label: "Comedores" },
  { slug: "recamaras", label: "Recámaras" },
  { slug: "separadores", label: "Separadores" },
] as const;

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [mobileSearch, setMobileSearch] = useState("");
  // H8: la barra de promoción se oculta al hacer scroll (histéresis 24/80 px para evitar parpadeos)
  const [barraOculta, setBarraOculta] = useState(false);
  const { user, roles } = useAuth();
  const navigate = useNavigate();
  const setQuery = useSearchStore((s) => s.setQuery);
  // Mismos datos (y misma caché) que las secciones de la portada: el enlace solo aparece si la sección existe
  const hayCombos = (useCombos(6).data?.length ?? 0) > 0;
  const hayOfertas = (useOfertas(24).data?.length ?? 0) > 0;

  // ¿Dónde estoy? Por ruta (/combo/…, /categoria/…) y, en la portada, por la sección que se está viendo
  const location = useRouterState({ select: (s) => s.location });
  const enInicio = location.pathname === "/";
  const [seccionActiva, setSeccionActiva] = useState<"combos" | "ofertas" | null>(null);

  useEffect(() => {
    if (!enInicio || typeof IntersectionObserver === "undefined") {
      setSeccionActiva(null);
      return;
    }
    const orden = ["combos", "ofertas"] as const;
    const visibles = new Set<string>();
    // Franja estrecha a ~40% de la altura: la sección que la cruza es la "actual"
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visibles.add(e.target.id);
          else visibles.delete(e.target.id);
        }
        setSeccionActiva(orden.find((id) => visibles.has(id)) ?? null);
      },
      { rootMargin: "-35% 0px -55% 0px" },
    );
    // Las secciones se montan cuando llegan sus datos; observamos tras el render
    const t = setTimeout(() => {
      orden.forEach((id) => {
        const el = document.getElementById(id);
        if (el) io.observe(el);
      });
    }, 0);
    return () => {
      clearTimeout(t);
      io.disconnect();
    };
  }, [enInicio, hayCombos, hayOfertas]);

  const combosActivo = location.pathname.startsWith("/combo/") || seccionActiva === "combos";
  const ofertasActivo = seccionActiva === "ofertas";
  const categoriaActual = location.pathname.startsWith("/categoria/") ? decodeURIComponent(location.pathname.split("/")[2] ?? "") : null;
  const nosotrosActivo = location.pathname.startsWith("/nosotros");

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
    navigate({ to: "/catalogo", search: term ? { q: term } : {} });
  };

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = window.scrollY;
        setBarraOculta((prev) => (prev ? y > 24 : y > 80));
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const handleDesktopSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = (new FormData(e.currentTarget).get("q") as string) ?? "";
    goToCatalogo(value);
  };

  const handleMobileSearch = (e: React.FormEvent) => {
    e.preventDefault();
    goToCatalogo(mobileSearch);
    setMobileSearchOpen(false);
    setMobileOpen(false);
  };

  return (
    <>
      <header
        className={`sticky z-40 w-full transition-[top] duration-300 motion-reduce:transition-none ${barraOculta ? "-top-8" : "top-0"}`}
      >
        {/* Barra superior de servicio */}
        <div
          className="w-full bg-gm-bosque text-white"
          aria-hidden={barraOculta || undefined}
          {...(barraOculta ? ({ inert: "" } as Record<string, string>) : {})}
        >
          <div className="container mx-auto flex h-8 items-center justify-center px-4 md:px-6">
            <p className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-center">
              <CampanaTicker
                fallback={
                  <>
                    <Truck className="h-3.5 w-3.5 flex-shrink-0" />
                    Recojo en tienda o delivery a todo Lima
                  </>
                }
              />
            </p>
          </div>
        </div>

        {/* Navbar principal: logo, buscador y accesos */}
        <div className="w-full bg-background/95 backdrop-blur-xl">
          <div className="container mx-auto flex h-16 items-center gap-2 px-4 md:h-20 md:gap-4 md:px-6">
            {/* Móvil: ☰ abre el menú completo (#menu-movil). Reemplaza al antiguo «Más» (decisión del dueño, 2026-11-16) */}
            <button
              type="button"
              onClick={() => { setMobileOpen((v) => !v); setMobileSearchOpen(false); }}
              className="-ml-2 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
              aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={mobileOpen}
              aria-controls="menu-movil"
            >
              {mobileOpen ? <X aria-hidden className="h-5 w-5" /> : <Menu aria-hidden className="h-5 w-5" />}
            </button>

            {/* Logo */}
            <Link to="/" className="flex flex-col leading-none flex-shrink-0">
              <span className="font-display text-xl sm:text-2xl font-bold tracking-tight text-foreground">G&amp;M</span>
              <span className="text-xs tracking-wide text-muted-foreground">Mueblería</span>
            </Link>

            {/* Buscador (desktop, siempre visible) */}
            <form onSubmit={handleDesktopSearch} role="search" className="hidden md:flex flex-1 max-w-xl mx-auto">
              <div className="relative w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
                <Input
                  name="q"
                  aria-label="Buscar muebles"
                  placeholder="¿Qué mueble estás buscando?"
                  className="h-11 pl-10 rounded-full bg-card border-border/60 focus-visible:ring-accent"
                />
              </div>
            </form>

            {/* Desktop actions */}
            <div className="hidden md:flex items-center gap-3 ml-auto flex-shrink-0">
              <AuthButton
                user={user}
                roles={roles}
                onLogin={() => setLoginOpen(true)}
                onLogout={handleLogout}
              />
              <WishlistDrawer />
              <CartDrawer />
            </div>

            {/* Mobile: buscar + cuenta + favoritos + carrito (el menú vive en ☰, a la izquierda del logo) */}
            <div className="flex items-center gap-1 sm:gap-2 md:hidden ml-auto">
              <button
                onClick={() => { setMobileSearchOpen((v) => !v); setMobileOpen(false); }}
                className={`flex h-11 w-11 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${mobileSearchOpen ? "text-accent-strong bg-accent/10" : "text-foreground/70 hover:text-foreground hover:bg-accent/10"}`}
                aria-label="Buscar"
                aria-expanded={mobileSearchOpen}
              >
                <Search className="h-5 w-5" />
              </button>
              {/* Acceso siempre a la vista: foto de la cuenta o botón «Iniciar sesión» */}
              <AuthButton compact />
              <WishlistDrawer />
              <CartDrawer />
            </div>
          </div>

          {/* Barra de búsqueda mobile (toggle independiente del menú) */}
          {mobileSearchOpen && (
            <div className="md:hidden border-t border-border/40 bg-background px-4 py-3">
              <form onSubmit={handleMobileSearch} role="search" className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
                <Input
                  autoFocus
                  aria-label="Buscar muebles"
                  value={mobileSearch}
                  onChange={(e) => setMobileSearch(e.target.value)}
                  placeholder="¿Qué mueble estás buscando?"
                  className="h-11 pl-9 rounded-full bg-card border-border/60"
                />
              </form>
            </div>
          )}
        </div>

        {/* Menú de secciones (boceto v3): PC con todas las secciones; móvil con 3 categorías (el resto, en ☰) */}
        <div className="w-full border-y border-border/50 bg-card">
          <nav aria-label="Secciones de la tienda" className="container mx-auto px-4 md:px-6">
            <ul className="hidden md:grid grid-cols-[1fr_auto_1fr] items-center">
              <li aria-hidden className="block" />
              <li>
                <ul className="flex items-center gap-8 lg:gap-10">
                  {NAV_CATEGORIAS.map((c) => (
                    <li key={c.slug}>
                      <Link
                        to="/categoria/$slug"
                        params={{ slug: c.slug }}
                        aria-current={categoriaActual === c.slug ? "page" : undefined}
                        className={navLinkCls(categoriaActual === c.slug, "base", true)}
                      >
                        {c.label}
                      </Link>
                    </li>
                  ))}
                  {hayCombos && (
                    <li>
                      <Link to="/" hash="combos" aria-current={combosActivo ? "true" : undefined} className={navLinkCls(combosActivo, "base", true)}>
                        Combos
                      </Link>
                    </li>
                  )}
                  <li>
                    <Link to="/" hash="a-medida" className={navLinkCls(false, "base", true)}>
                      A medida
                    </Link>
                  </li>
                </ul>
              </li>
              <li>
                <ul className="flex items-center justify-end gap-8">
                  {hayOfertas && (
                    <li>
                      <Link to="/" hash="ofertas" aria-current={ofertasActivo ? "true" : undefined} className={`${navLinkCls(ofertasActivo, "accent", true)} font-bold`}>
                        Ofertas
                      </Link>
                    </li>
                  )}
                  <li>
                    <Link to="/nosotros" aria-current={nosotrosActivo ? "page" : undefined} className={navLinkCls(nosotrosActivo, "base", true)}>
                      Nosotros
                    </Link>
                  </li>
                </ul>
              </li>
            </ul>

            <ul className="flex items-center justify-between md:hidden">
              {NAV_CATEGORIAS.slice(0, 3).map((c) => (
                <li key={c.slug}>
                  <Link
                    to="/categoria/$slug"
                    params={{ slug: c.slug }}
                    aria-current={categoriaActual === c.slug ? "page" : undefined}
                    className={navLinkCls(categoriaActual === c.slug, "base", true)}
                  >
                    {c.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Mobile dropdown */}
          {mobileOpen && (
            <div id="menu-movil" className="md:hidden border-t border-border/40 bg-background/95 backdrop-blur-xl px-4 py-4 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Catálogo completo */}
              <Link
                to="/catalogo"
                onClick={() => setMobileOpen(false)}
                className="block text-sm font-medium text-foreground py-2 border-b border-border/30"
              >
                Ver catálogo completo
              </Link>

              {/* Categorías (acordeón) */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1 px-1">
                  Categorías
                </p>
                <CategoryMobileAccordion onNavigate={() => setMobileOpen(false)} />
              </div>

              {/* A medida, Nosotros, combos y ofertas */}
              <div className="pt-1">
                <Link to="/" hash="a-medida" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 text-sm font-medium py-2 border-b border-border/30 text-foreground/80 hover:text-foreground">
                  A medida
                </Link>
                <Link to="/nosotros" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 text-sm font-medium py-2 border-b border-border/30 text-foreground/80 hover:text-foreground">
                  Nosotros
                </Link>
              </div>
              {(hayCombos || hayOfertas) && (
                <div className="pt-1">
                  {hayCombos && (
                    <Link
                      to="/"
                      hash="combos"
                      onClick={() => setMobileOpen(false)}
                      aria-current={combosActivo ? "true" : undefined}
                      className={`flex items-center gap-2 text-sm font-medium py-2 border-b border-border/30 last:border-0 ${
                        combosActivo ? "text-accent-strong" : "text-foreground/80 hover:text-foreground"
                      }`}
                    >
                      <PackageCheck className="h-4 w-4" />
                      Combos
                    </Link>
                  )}
                  {hayOfertas && (
                    <Link
                      to="/"
                      hash="ofertas"
                      onClick={() => setMobileOpen(false)}
                      aria-current={ofertasActivo ? "true" : undefined}
                      className={`flex items-center gap-2 text-sm font-medium py-2 border-b border-border/30 last:border-0 ${
                        ofertasActivo ? "text-accent-strong underline underline-offset-4" : "text-accent-strong"
                      }`}
                    >
                      <Flame className="h-4 w-4" />
                      Ofertas
                    </Link>
                  )}
                </div>
              )}

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
                    <Link
                      to="/perfil/pedidos"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-2 text-sm text-foreground/70 hover:text-foreground py-2"
                    >
                      Mis pedidos
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
                    className="auth-shine flex w-full items-center justify-center gap-1.5 rounded-full bg-[image:var(--gradient-warm)] py-2.5 text-sm font-medium text-accent-foreground shadow-sm transition-transform active:scale-[0.98]"
                  >
                    <User className="h-4 w-4" />
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