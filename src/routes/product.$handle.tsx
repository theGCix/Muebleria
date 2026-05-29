import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useProduct } from "@/hooks/useProducts";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShoppingBag, ArrowLeft, Quote } from "lucide-react";
import { useState } from "react";
import { useCartStore } from "@/stores/cartStore";
import { toast } from "sonner";

export const Route = createFileRoute("/product/$handle")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.handle.replace(/-/g, " ")} — G&M Mueblería` },
      { name: "description", content: `Detalles del producto ${params.handle.replace(/-/g, " ")}.` },
    ],
  }),
  component: ProductPage,
  errorComponent: ({ error, reset }) => <ProductError error={error} reset={reset} />,
  notFoundComponent: () => <ProductNotFound />,
});

function ProductError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="font-display text-3xl mb-2">Error al cargar</h1>
        <p className="text-sm text-muted-foreground mb-6">{error.message}</p>
        <Button onClick={() => { router.invalidate(); reset(); }}>Reintentar</Button>
      </div>
    </div>
  );
}

function ProductNotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="font-display text-3xl mb-2">Producto no encontrado</h1>
        <Button asChild className="mt-4"><Link to="/">Volver al inicio</Link></Button>
      </div>
    </div>
  );
}

function ProductPage() {
  const { handle } = Route.useParams();
  const { data: product, isLoading } = useProduct(handle);
  const addItem = useCartStore((s) => s.addItem);
  const [adding, setAdding] = useState(false);
  const [activeImage, setActiveImage] = useState(0);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      </div>
    );
  }

  if (!product) return <ProductNotFound />;

  const variant = product.variants.edges[0]?.node;
  const images = product.images.edges.map((e: { node: { url: string; altText: string | null } }) => e.node);
  const price = product.priceRange.minVariantPrice;
  const compareAt = variant?.compareAtPrice;
  const onSale = compareAt && parseFloat(compareAt.amount) > parseFloat(price.amount);

  const handleAdd = async () => {
    if (!variant) return;
    setAdding(true);
    try {
      await addItem({
        product: { node: product },
        variantId: variant.id,
        variantTitle: variant.title,
        price: variant.price,
        quantity: 1,
        selectedOptions: variant.selectedOptions || [],
      });
      toast.success("Agregado al carrito", { description: product.title, position: "top-center" });
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-6 py-12">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="h-4 w-4" /> Volver al catálogo
        </Link>
        <div className="grid lg:grid-cols-2 gap-12">
          <div className="space-y-4">
            <div className="aspect-square rounded-xl overflow-hidden bg-secondary/30 border border-border/60">
              {images[activeImage] ? (
                <img
                  src={images[activeImage].url}
                  alt={images[activeImage].altText || product.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                  Sin imagen
                </div>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {images.map((img: { url: string; altText: string | null }, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImage(idx)}
                    className={`h-20 w-20 flex-shrink-0 rounded-md overflow-hidden border-2 transition-colors ${
                      activeImage === idx ? "border-accent" : "border-transparent"
                    }`}
                  >
                    <img src={img.url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6">
            {product.productType && (
              <p className="text-xs uppercase tracking-[0.25em] text-accent font-medium">
                {product.productType}
              </p>
            )}
            <h1 className="font-display text-4xl md:text-5xl font-semibold text-foreground">{product.title}</h1>
            <div className="flex items-baseline gap-3">
              <span className="font-display text-3xl font-semibold">
                {price.currencyCode} {parseFloat(price.amount).toFixed(2)}
              </span>
              {onSale && compareAt && (
                <>
                  <span className="text-lg text-muted-foreground line-through">
                    {parseFloat(compareAt.amount).toFixed(2)}
                  </span>
                  <Badge className="bg-accent text-accent-foreground">Oferta</Badge>
                </>
              )}
            </div>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{product.description}</p>

            <Button
              onClick={handleAdd}
              disabled={adding || !variant?.availableForSale}
              size="lg"
              className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90 rounded-full h-12 px-8"
            >
              {adding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <ShoppingBag className="h-4 w-4 mr-2" />
                  Agregar al carrito
                </>
              )}
            </Button>

            <div className="pt-6 border-t border-border space-y-2 text-sm text-muted-foreground">
              <div>✓ Hecho a mano en madera natural</div>
              <div>✓ Garantía de 2 años</div>
              <div>✓ Entrega a domicilio</div>
            </div>

            <div className="pt-6 border-t border-border">
              <h3 className="font-display text-xl font-semibold mb-3">Reseñas</h3>
              <div className="p-6 rounded-lg bg-card border border-border/60 text-center">
                <Quote className="h-6 w-6 text-accent/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Aún no hay reseñas para este producto.</p>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}