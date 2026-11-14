import { Link } from "@tanstack/react-router";
import { Instagram, Facebook, Twitter, BookOpen, MapPin, Clock, MessageCircle } from "lucide-react";
import { LIBRO_RECLAMACIONES_URL, REDES, EMPRESA, HORARIO, MEDIOS_PAGO, WHATSAPP_NUMBER } from "@/config";
import { useHayTestimonios } from "@/hooks/useResenasDestacadas";
import { useHayGaleria } from "@/hooks/useGaleriaClientes";
import { useHayProyectos } from "@/hooks/useProyectos";

export function Footer() {
  const hayTestimonios = useHayTestimonios();
  const hayGaleria = useHayGaleria();
  const hayProyectos = useHayProyectos();
  return (
    <footer className="mt-20 bg-primary text-primary-foreground">
      <div className="container mx-auto px-6 py-16">
        <div className="grid md:grid-cols-4 gap-10">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-9 w-9 rounded-md bg-primary-foreground flex items-center justify-center text-primary font-display font-bold">
                G
              </div>
              <span className="font-display text-xl font-semibold">G&amp;M Mueblería</span>
            </div>
            <p className="text-sm text-primary-foreground/75 max-w-sm leading-relaxed">
              Muebles artesanales de madera natural, hechos para durar generaciones.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-primary-foreground/75">
              {EMPRESA.direccion && (
                <li className="flex items-start gap-2"><MapPin className="h-4 w-4 mt-0.5 shrink-0" />{EMPRESA.direccion}</li>
              )}
              {HORARIO && (
                <li className="flex items-start gap-2"><Clock className="h-4 w-4 mt-0.5 shrink-0" />{HORARIO}</li>
              )}
              {WHATSAPP_NUMBER && (
                <li>
                  <a
                    href={`https://wa.me/${WHATSAPP_NUMBER}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 hover:text-primary-foreground"
                  >
                    <MessageCircle className="h-4 w-4 shrink-0" />
                    WhatsApp {WHATSAPP_NUMBER.replace(/^51(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3")}
                  </a>
                </li>
              )}
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-primary-foreground mb-4">Empresa</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/75">
              <li><Link to="/nosotros" className="hover:text-primary-foreground">Nuestro taller</Link></li>
              {hayProyectos && (
                <li><Link to="/proyectos" className="hover:text-primary-foreground">Proyectos</Link></li>
              )}
              {hayGaleria && (
                <li><Link to="/testimonios" className="hover:text-primary-foreground">Galería de clientes</Link></li>
              )}
              <li><a href="#categorias" className="hover:text-primary-foreground">Categorías</a></li>
              <li><a href="#catalogo" className="hover:text-primary-foreground">Catálogo</a></li>
              {hayTestimonios && (
                <li><a href="#testimonios" className="hover:text-primary-foreground">Testimonios</a></li>
              )}
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-primary-foreground mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/75">
              <li><Link to="/terminos" className="hover:text-primary-foreground">Términos</Link></li>
              <li><Link to="/privacidad" className="hover:text-primary-foreground">Privacidad</Link></li>
              <li><Link to="/envios" className="hover:text-primary-foreground">Envíos</Link></li>
              {LIBRO_RECLAMACIONES_URL && (
                <li>
                  <a
                    href={LIBRO_RECLAMACIONES_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-medium text-primary-foreground/90 hover:text-primary-foreground"
                  >
                    <BookOpen className="h-4 w-4" />
                    Libro de Reclamaciones
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>
        {MEDIOS_PAGO.length > 0 && (
          <div className="mt-10 flex flex-wrap items-center gap-2 text-xs text-primary-foreground/75">
            <span className="mr-1 font-medium text-primary-foreground/90">Medios de pago:</span>
            {MEDIOS_PAGO.map((m) => (
              <span key={m} className="rounded-full border border-primary-foreground/25 px-3 py-1">{m}</span>
            ))}
          </div>
        )}
        <div className="mt-8 pt-8 border-t border-primary-foreground/15 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-primary-foreground/75">© {new Date().getFullYear()} G&amp;M Mueblería. Todos los derechos reservados.</p>
          {(REDES.instagram || REDES.facebook || REDES.twitter) && (
            <div className="flex items-center gap-4 text-primary-foreground/75">
              {REDES.instagram && (
                <a href={REDES.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="hover:text-primary-foreground transition-colors"><Instagram className="h-4 w-4" /></a>
              )}
              {REDES.facebook && (
                <a href={REDES.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="hover:text-primary-foreground transition-colors"><Facebook className="h-4 w-4" /></a>
              )}
              {REDES.twitter && (
                <a href={REDES.twitter} target="_blank" rel="noopener noreferrer" aria-label="Twitter" className="hover:text-primary-foreground transition-colors"><Twitter className="h-4 w-4" /></a>
              )}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}