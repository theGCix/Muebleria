import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import heroImg from "@/assets/hero-furniture.jpg";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="container mx-auto px-6 pt-16 pb-24 md:pt-24 md:pb-32">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              Hecho a mano · Madera noble
            </div>
            <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-semibold leading-[1.05] text-foreground">
              Muebles que <em className="text-accent not-italic">cuentan</em> historias en tu hogar
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl leading-relaxed">
              En G&amp;M Mueblería diseñamos piezas atemporales en madera natural,
              pensadas para acompañarte por generaciones. Calidad artesanal con entrega a domicilio.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full h-12 px-7"
              >
                <a href="#catalogo">
                  Comprar ahora <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="rounded-full h-12 px-7 border-foreground/20 hover:bg-secondary"
              >
                <a href="#categorias">Explorar categorías</a>
              </Button>
            </div>
            <div className="flex items-center gap-8 pt-4">
              <div>
                <div className="font-display text-3xl font-semibold">15+</div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Años de oficio</div>
              </div>
              <div className="h-10 w-px bg-border" />
              <div>
                <div className="font-display text-3xl font-semibold">100%</div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Madera natural</div>
              </div>
              <div className="h-10 w-px bg-border hidden sm:block" />
              <div className="hidden sm:block">
                <div className="font-display text-3xl font-semibold">2 años</div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">de garantía</div>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 bg-[image:var(--gradient-warm)] opacity-20 blur-3xl rounded-full" />
            <div className="relative rounded-2xl overflow-hidden shadow-[var(--shadow-elegant)] border border-border/40">
              <img
                src={heroImg}
                alt="Mueble artesanal de madera natural en sala iluminada"
                width={1600}
                height={1200}
                className="w-full h-auto object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}