import { Link } from "@tanstack/react-router";
import { Instagram, Facebook, Twitter, BookOpen } from "lucide-react";
import { LIBRO_RECLAMACIONES_URL, REDES } from "@/config";
import { useHayTestimonios } from "@/hooks/useResenasDestacadas";
import { useHayGaleria } from "@/hooks/useGaleriaClientes";
import { useHayProyectos } from "@/hooks/useProyectos";

export function Footer() {
  const hayTestimonios = useHayTestimonios();
  const hayGaleria = useHayGaleria();
  const hayProyectos = useHayProyectos();
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
              <li><Link to="/nosotros" className="hover:text-foreground">Nuestro taller</Link></li>
              {hayProyectos && (
                <li><Link to="/proyectos" className="hover:text-foreground">Proyectos</Link></li>
              )}
              {hayGaleria && (
                <li><Link to="/testimonios" className="hover:text-foreground">Galería de clientes</Link></li>
              )}
              <li><a href="#categorias" className="hover:text-foreground">Categorías</a></li>
              <li><a href="#catalogo" className="hover:text-foreground">Catálogo</a></li>
              {hayTestimonios && (
                <li><a href="#testimonios" className="hover:text-foreground">Testimonios</a></li>
              )}
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/terminos" className="hover:text-foreground">Términos</Link></li>
              <li><Link to="/privacidad" className="hover:text-foreground">Privacidad</Link></li>
              <li><Link to="/envios" className="hover:text-foreground">Envíos</Link></li>
              {LIBRO_RECLAMACIONES_URL && (
                <li>
                  <a
                    href={LIBRO_RECLAMACIONES_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-medium text-foreground/80 hover:text-foreground"
                  >
                    <BookOpen className="h-4 w-4" />
                    Libro de Reclamaciones
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} G&amp;M Mueblería. Todos los derechos reservados.</p>
          {(REDES.instagram || REDES.facebook || REDES.twitter) && (
            <div className="flex items-center gap-4 text-muted-foreground">
              {REDES.instagram && (
                <a href={REDES.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="hover:text-accent transition-colors"><Instagram className="h-4 w-4" /></a>
              )}
              {REDES.facebook && (
                <a href={REDES.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="hover:text-accent transition-colors"><Facebook className="h-4 w-4" /></a>
              )}
              {REDES.twitter && (
                <a href={REDES.twitter} target="_blank" rel="noopener noreferrer" aria-label="Twitter" className="hover:text-accent transition-colors"><Twitter className="h-4 w-4" /></a>
              )}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}