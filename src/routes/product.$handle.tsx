import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useProduct } from "@/hooks/useProducts";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShoppingBag, ArrowLeft, Image } from "lucide-react";
import { useCartStore } from "@/stores/cartStore";
import { toast } from "sonner";
import { cloudinaryUrl } from "@/lib/cloudinary";

export const Route = createFileRoute("/product/$handle")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.handle} — G&M Mueblería` },
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

const fmt = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n);

function ProductPage() {
  const { handle } = Route.useParams();
  const { data: product, isLoading } = useProduct(handle);
  const addItem = useCartStore((s) => s.addItem);

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

  const imgSrc = product.imagen_public_id
    ? cloudinaryUrl(product.imagen_public_id, { w: 800, h: 600 })
    : product.imagen_url;

  const handleAdd = () => {
    addItem({
      id: product.id,
      title: product.nombre,
      price: product.precio,
      image: imgSrc ?? "",
      sku: product.sku ?? undefined,
    });
    toast.success("Agregado al carrito", { description: product.nombre, position: "top-center" });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-6 py-12">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="h-4 w-4" /> Volver al catálogo
        </Link>
        <div className="grid lg:grid-cols-2 gap-12">
          {/* Imagen */}
          <div className="aspect-square rounded-xl overflow-hidden bg-secondary/30 border border-border/60">
            {imgSrc ? (
              <img
                src={imgSrc}
                alt={product.nombre}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                <Image className="h-16 w-16" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="space-y-6">
            {product.categoria && (
              <p className="text-xs uppercase tracking-[0.25em] text-accent font-medium">
                {product.categoria}
              </p>
            )}
            <h1 className="font-display text-4xl md:text-5xl font-semibold text-foreground">
              {product.nombre}
            </h1>
            <div className="flex items-baseline gap-3">
              <span className="font-display text-3xl font-semibold">{fmt(product.precio)}</span>
              {(product.stock ?? 1) <= 0 && (
                <Badge variant="secondary">Agotado</Badge>
              )}
              {product.sku && (
                <span className="text-sm text-muted-foreground">SKU: {product.sku}</span>
              )}
            </div>
            {product.descripcion && (
              <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                {product.descripcion}
              </p>
            )}

            <Button
              onClick={handleAdd}
              disabled={(product.stock ?? 1) <= 0}
              size="lg"
              className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90 rounded-full h-12 px-8"
            >
              <ShoppingBag className="h-4 w-4 mr-2" />
              Agregar al carrito
            </Button>

            <div className="pt-6 border-t border-border space-y-2 text-sm text-muted-foreground">
              <div>✓ Hecho a mano en madera natural</div>
              <div>✓ Garantía de 2 años</div>
              <div>✓ Entrega a domicilio</div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}