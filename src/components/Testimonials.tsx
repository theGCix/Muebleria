import { Quote } from "lucide-react";

export function Testimonials() {
  return (
    <section id="testimonios" className="container mx-auto px-6 py-24">
      <div className="text-center max-w-2xl mx-auto mb-16">
        <p className="text-xs uppercase tracking-[0.25em] text-accent font-medium mb-4">Testimonios</p>
        <h2 className="font-display text-4xl md:text-5xl font-semibold text-foreground">
          Lo que dicen nuestros clientes
        </h2>
      </div>
      <div className="grid md:grid-cols-3 gap-6">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="p-8 rounded-xl bg-card border border-border/60 flex flex-col items-center text-center"
          >
            <Quote className="h-8 w-8 text-accent/40 mb-4" />
            <p className="text-sm text-muted-foreground italic mb-6">
              Aún no hay reseñas. Los testimonios reales de tus clientes aparecerán aquí.
            </p>
            <div className="mt-auto">
              <div className="h-12 w-12 rounded-full bg-secondary mx-auto mb-3" />
              <div className="font-medium text-foreground">—</div>
              <div className="text-xs text-muted-foreground">Cliente verificado</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}