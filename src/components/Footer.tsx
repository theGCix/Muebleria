import { Instagram, Facebook, Twitter } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border bg-secondary/40 mt-20">
      <div className="container mx-auto px-6 py-16">
        <div className="grid md:grid-cols-4 gap-10">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-9 w-9 rounded-md bg-[image:var(--gradient-warm)] flex items-center justify-center text-primary-foreground font-display font-bold">
                G
              </div>
              <span className="font-display text-xl font-semibold">G&amp;M Mueblería</span>
            </div>
            <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
              Muebles artesanales de madera natural, hechos para durar generaciones.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-4">Empresa</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#categorias" className="hover:text-foreground">Categorías</a></li>
              <li><a href="#catalogo" className="hover:text-foreground">Catálogo</a></li>
              <li><a href="#testimonios" className="hover:text-foreground">Testimonios</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground">Términos</a></li>
              <li><a href="#" className="hover:text-foreground">Privacidad</a></li>
              <li><a href="#" className="hover:text-foreground">Envíos</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} G&amp;M Mueblería. Todos los derechos reservados.</p>
          <div className="flex items-center gap-4 text-muted-foreground">
            <a href="#" aria-label="Instagram" className="hover:text-accent transition-colors"><Instagram className="h-4 w-4" /></a>
            <a href="#" aria-label="Facebook" className="hover:text-accent transition-colors"><Facebook className="h-4 w-4" /></a>
            <a href="#" aria-label="Twitter" className="hover:text-accent transition-colors"><Twitter className="h-4 w-4" /></a>
          </div>
        </div>
      </div>
    </footer>
  );
}