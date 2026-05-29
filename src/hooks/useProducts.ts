import { useQuery } from "@tanstack/react-query";
import { STOREFRONT_QUERY, PRODUCT_BY_HANDLE_QUERY, storefrontApiRequest, type ShopifyProduct } from "@/lib/shopify";

export function useProducts(first = 12, query?: string) {
  return useQuery({
    queryKey: ["shopify-products", first, query ?? null],
    queryFn: async () => {
      const data = await storefrontApiRequest(STOREFRONT_QUERY, { first, query: query ?? null });
      const edges: ShopifyProduct[] = data?.data?.products?.edges ?? [];
      return edges;
    },
  });
}

export function useProduct(handle: string) {
  return useQuery({
    queryKey: ["shopify-product", handle],
    queryFn: async () => {
      const data = await storefrontApiRequest(PRODUCT_BY_HANDLE_QUERY, { handle });
      return data?.data?.product ?? null;
    },
    enabled: !!handle,
  });
}