import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { CartDrawer } from "./CartDrawer";

const navLinks = [
  { label: "Inicio", href: "/" },
  { label: "Categorías", href: "#categorias" },
  { label: "Catálogo", href: "#catalogo" },
  { label: "Testimonios", href: "#testimonios" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-20 items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-md bg-[var(--gradient-warm)] flex items-center justify-center text-primary-foreground font-display font-bold">
            G
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-display text-lg font-semibold tracking-tight">G&amp;M</span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Mueblería</span>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="text-sm text-foreground/70 hover:text-foreground transition-colors"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="hidden md:inline text-sm text-foreground/60 hover:text-foreground transition-colors"
          >
            Acceso staff
          </Link>
          <Button
            asChild
            className="hidden sm:inline-flex bg-primary text-primary-foreground hover:bg-primary/90 rounded-full"
          >
            <a href="#catalogo">Ver catálogo</a>
          </Button>
          <CartDrawer />
        </div>
      </div>
    </header>
  );
}