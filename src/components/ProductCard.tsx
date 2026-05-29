import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { useCartStore } from "@/stores/cartStore";
import type { ShopifyProduct } from "@/lib/shopify";
import { toast } from "sonner";

export function ProductCard({ product }: { product: ShopifyProduct }) {
  const addItem = useCartStore((s) => s.addItem);
  const [adding, setAdding] = useState(false);
  const variant = product.node.variants.edges[0]?.node;
  const image = product.node.images.edges[0]?.node;
  const price = product.node.priceRange.minVariantPrice;
  const compareAt = variant?.compareAtPrice;
  const onSale = compareAt && parseFloat(compareAt.amount) > parseFloat(price.amount);

  const handleAdd = async () => {
    if (!variant) return;
    setAdding(true);
    try {
      await addItem({
        product,
        variantId: variant.id,
        variantTitle: variant.title,
        price: variant.price,
        quantity: 1,
        selectedOptions: variant.selectedOptions || [],
      });
      toast.success("Agregado al carrito", {
        description: product.node.title,
        position: "top-center",
      });
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="group rounded-xl overflow-hidden bg-card border border-border/60 hover:shadow-[var(--shadow-elegant)] transition-all duration-500">
      <Link
        to="/product/$handle"
        params={{ handle: product.node.handle }}
        className="block relative aspect-[4/5] overflow-hidden bg-secondary/30"
      >
        {onSale && (
          <Badge className="absolute top-3 left-3 z-10 bg-accent text-accent-foreground">Oferta</Badge>
        )}
        {image ? (
          <img
            src={image.url}
            alt={image.altText || product.node.title}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-700"
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-muted-foreground text-xs">
            Sin imagen
          </div>
        )}
      </Link>
      <div className="p-5 space-y-3">
        <Link to="/product/$handle" params={{ handle: product.node.handle }}>
          <h3 className="font-display text-lg font-semibold text-foreground line-clamp-1 hover:text-accent transition-colors">
            {product.node.title}
          </h3>
        </Link>
        <div className="flex items-baseline gap-2">
          <span className="font-display text-xl font-semibold text-foreground">
            {price.currencyCode} {parseFloat(price.amount).toFixed(2)}
          </span>
          {onSale && compareAt && (
            <span className="text-sm text-muted-foreground line-through">
              {parseFloat(compareAt.amount).toFixed(2)}
            </span>
          )}
        </div>
        <Button
          onClick={handleAdd}
          disabled={adding || !variant?.availableForSale}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-full"
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
      </div>
    </div>
  );
}