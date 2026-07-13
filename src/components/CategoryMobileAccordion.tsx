// src/components/CategoryMobileAccordion.tsx
// Versión mobile del árbol de categorías: acordeón vertical, cada
// categoría se expande para mostrar sus subcategorías. Misma fuente de
// datos que el mega-menú de escritorio (src/lib/categories.ts).
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CATEGORIAS } from "@/lib/categories";

interface CategoryMobileAccordionProps {
  onNavigate: () => void;
}

export function CategoryMobileAccordion({ onNavigate }: CategoryMobileAccordionProps) {
  return (
    <Accordion type="single" collapsible className="w-full">
      {CATEGORIAS.map((cat) => (
        <AccordionItem key={cat.slug} value={cat.slug} className="border-border/40">
          <AccordionTrigger className="hover:no-underline">
            <span className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary text-foreground/70">
                <cat.icon className="h-4 w-4" />
              </span>
              <span className="text-sm font-medium text-foreground">{cat.nombre}</span>
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="pl-11 flex flex-col gap-1 pb-1">
              <Link
                to="/categoria/$slug"
                params={{ slug: cat.slug }}
                onClick={onNavigate}
                className="flex items-center justify-between py-1.5 text-sm font-medium text-accent"
              >
                Ver todo
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              {cat.subcategorias.map((sub) => (
                <Link
                  key={sub.slug}
                  to="/categoria/$slug"
                  params={{ slug: cat.slug }}
                  search={{ sub: sub.slug }}
                  onClick={onNavigate}
                  className="py-1.5 text-sm text-foreground/70"
                >
                  {sub.label}
                </Link>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}