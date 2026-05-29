import { Sofa, UtensilsCrossed, BedDouble, Briefcase } from "lucide-react";

const categories = [
  {
    icon: Sofa,
    title: "Sala",
    description: "Sofás, mesas de centro y butacas para acoger a los tuyos.",
  },
  {
    icon: UtensilsCrossed,
    title: "Comedor",
    description: "Mesas y sillas para reunir a la familia alrededor de cada plato.",
  },
  {
    icon: BedDouble,
    title: "Recámara",
    description: "Camas, cabeceras y cómodas para un descanso reparador.",
  },
  {
    icon: Briefcase,
    title: "Oficina",
    description: "Escritorios y libreros que inspiran a trabajar con estilo.",
  },
];

export function Categories() {
  return (
    <section id="categorias" className="container mx-auto px-6 py-24">
      <div className="text-center max-w-2xl mx-auto mb-16">
        <p className="text-xs uppercase tracking-[0.25em] text-accent font-medium mb-4">
          Nuestras colecciones
        </p>
        <h2 className="font-display text-4xl md:text-5xl font-semibold text-foreground">
          Piezas para cada rincón de tu hogar
        </h2>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {categories.map((cat) => (
          <div
            key={cat.title}
            className="group p-8 rounded-xl bg-card border border-border/60 hover:shadow-[var(--shadow-soft)] hover:-translate-y-1 transition-all duration-300"
          >
            <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center mb-6 group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
              <cat.icon className="h-6 w-6" />
            </div>
            <h3 className="font-display text-2xl font-semibold mb-2 text-foreground">{cat.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{cat.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}