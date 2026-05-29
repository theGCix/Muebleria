import { createFileRoute } from "@tanstack/react-router";
import { useProducts } from "@/hooks/useProducts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/productos")({
  head: () => ({ meta: [{ title: "Productos — G&M POS" }] }),
  component: ProductosPage,
});

const fmt = (n: number) => new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n);

function ProductosPage() {
  const { data, isLoading } = useProducts(50);
  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-semibold">Productos</h1>
          <p className="text-muted-foreground">Catálogo sincronizado con Shopify</p>
        </div>
        <Button asChild variant="outline">
          <a href="https://admin.shopify.com/store/g-m-home-designs-vt3tv/products" target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4" />Gestionar en Shopify
          </a>
        </Button>
      </div>
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr><th className="px-4 py-3">Producto</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3 text-right">Precio</th></tr>
            </thead>
            <tbody>
              {(data ?? []).map((p) => (
                <tr key={p.node.id} className="border-t">
                  <td className="px-4 py-3 flex items-center gap-3">
                    {p.node.images.edges[0] && (
                      <img src={p.node.images.edges[0].node.url} alt="" className="w-10 h-10 object-cover rounded" />
                    )}
                    <span className="font-medium">{p.node.title}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.node.productType ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold">{fmt(Number(p.node.priceRange.minVariantPrice.amount))}</td>
                </tr>
              ))}
              {(data ?? []).length === 0 && (
                <tr><td colSpan={3} className="text-center py-10 text-muted-foreground">Sin productos en Shopify.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}