// src/components/RelatedProducts.tsx
// G&M Mueblería — Sección "Te podría interesar"
import { Link } from "@tanstack/react-router";
import { useCartStore } from "@/stores/cartStore";
import { toast } from "sonner";
import { ShoppingCart } from "lucide-react";
import type { Product } from "@/routes/product.$handle";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n);

export function RelatedProducts({
  products,
  currentHandle,
}: {
  products: Product[];
  currentHandle: string;
}) {
  const { addItem } = useCartStore();

  const filtered = products.filter((p) => p.handle !== currentHandle).slice(0, 4);
  if (filtered.length === 0) return null;

  return (
    <section className="bg-[var(--color-cream)] py-20 px-4 md:px-12">
      <div className="container mx-auto">
        {/* Header */}
        <div className="mb-10">
          <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--color-gold)] mb-2">
            Colección seleccionada
          </p>
          <h2 className="font-display text-3xl font-normal text-[var(--color-walnut)] mb-2">
            Te podría interesar
          </h2>
          <p className="text-sm text-muted-foreground">
            Piezas que combinan perfectamente con este producto
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {filtered.map((product) => (
            <RelatedCard
              key={product.id}
              product={product}
              onAddToCart={() => {
                addItem({
                  id: product.id,
                  title: product.title,
                  price: product.price,
                  image: product.images[0]?.url ?? "",
                  quantity: 1,
                });
                toast.success("Agregado al carrito", { description: product.title });
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function RelatedCard({
  product,
  onAddToCart,
}: {
  product: Product;
  onAddToCart: () => void;
}) {
  return (
    <div className="group bg-white rounded-xl overflow-hidden border border-transparent hover:border-[var(--color-gold-light)] hover:-translate-y-1 hover:shadow-lg transition-all duration-300 cursor-pointer">
      <Link to="/product/$handle" params={{ handle: product.handle }}>
        {/* Imagen */}
        <div className="relative aspect-[4/3] bg-[var(--color-cream)] overflow-hidden">
          <img
            src={product.images[0]?.url}
            alt={product.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
          />
          <span className="absolute bottom-2.5 left-2.5 text-[10px] tracking-[0.12em] uppercase bg-white/85 backdrop-blur-sm text-[var(--color-walnut-mid)] px-2.5 py-1 rounded-full">
            {product.category}
          </span>
        </div>

        {/* Body */}
        <div className="p-4">
          <h3 className="font-display text-base font-normal text-foreground mb-1 leading-snug">
            {product.title}
          </h3>
          {product.subtitle && (
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed line-clamp-2">
              {product.subtitle}
            </p>
          )}
          <div className="flex items-center justify-between">
            <span className="text-base font-semibold text-[var(--color-walnut)]">
              {fmt(product.price)}
            </span>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onAddToCart();
              }}
              className="w-8 h-8 rounded-full bg-[var(--color-walnut)] text-white flex items-center justify-center hover:bg-[var(--color-walnut-mid)] hover:scale-110 transition-all"
              title="Agregar al carrito"
            >
              <ShoppingCart className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </Link>
    </div>
  );
}