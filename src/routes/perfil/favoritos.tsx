// src/routes/perfil/favoritos.tsx
// G&M Mueblería — Mis favoritos (wishlist)
import { createFileRoute, Link } from "@tanstack/react-router";
import { useWishlist } from "@/context/WishlistContext";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { Heart, Loader2 } from "lucide-react";

export const Route = createFileRoute("/perfil/favoritos")({
  head: () => ({ meta: [{ title: "Mis favoritos — G&M Mueblería" }] }),
  component: FavoritosPage,
});

function FavoritosPage() {
  const { items, loading } = useWishlist();

  return (
    <section>
      <h2 className="font-display text-xl font-semibold mb-1">Mis favoritos</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Los productos que guardaste para más adelante.
      </p>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground bg-muted/20 rounded-xl">
          <Heart className="h-10 w-10" />
          <p className="text-sm">Aún no tienes favoritos</p>
          <Button asChild size="sm" variant="outline">
            <Link to="/">Ver productos</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {items.map((item) => (
            <ProductCard key={item.id} product={item.product} />
          ))}
        </div>
      )}
    </section>
  );
}