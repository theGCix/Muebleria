import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Package, ShoppingBag, Users } from "lucide-react";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { groups, POS_ITEM, canSee } from "@/components/nav-config";
import type { AppRole } from "@/hooks/useAuth";

const money = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n);

type OrderHit = { id: string; order_number: string; nombre: string | null; total: number | null };
type CustomerHit = { id: string; nombre: string; doc_numero: string | null };
type ProductHit = { id: string; nombre: string; sku: string | null };
type Hits = { orders: OrderHit[]; customers: CustomerHit[]; products: ProductHit[] };

async function runSearch(rawTerm: string, roles: AppRole[]): Promise<Hits> {
  // Se quitan caracteres que rompen el filtro .or() de PostgREST.
  const t = rawTerm.replace(/[,()%*\\]/g, " ").trim();
  const isAdmin = roles.includes("admin");

  const [orders, customers, products] = await Promise.allSettled([
    supabase.from("orders").select("id, order_number, nombre, total")
      .or(`order_number.ilike.%${t}%,nombre.ilike.%${t}%,email.ilike.%${t}%`)
      .order("created_at", { ascending: false }).limit(5),
    supabase.from("customers").select("id, nombre, doc_numero")
      .or(`nombre.ilike.%${t}%,doc_numero.ilike.%${t}%,email.ilike.%${t}%,telefono.ilike.%${t}%`)
      .limit(5),
    isAdmin
      ? supabase.from("products").select("id, nombre, sku")
          .or(`nombre.ilike.%${t}%,sku.ilike.%${t}%`).limit(5)
      : Promise.resolve({ data: [] }),
  ]);

  const rows = <T,>(r: PromiseSettledResult<{ data: unknown }>): T[] =>
    r.status === "fulfilled" ? ((r.value.data ?? []) as T[]) : [];

  return {
    orders: rows<OrderHit>(orders as PromiseSettledResult<{ data: unknown }>),
    customers: rows<CustomerHit>(customers as PromiseSettledResult<{ data: unknown }>),
    products: rows<ProductHit>(products as PromiseSettledResult<{ data: unknown }>),
  };
}

export function GlobalSearch({
  open, onOpenChange, roles,
}: { open: boolean; onOpenChange: (o: boolean) => void; roles: AppRole[] }) {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [term, setTerm] = useState("");

  // Espera 250 ms después de dejar de escribir para no consultar en cada tecla.
  useEffect(() => {
    const id = setTimeout(() => setTerm(input.trim()), 250);
    return () => clearTimeout(id);
  }, [input]);

  useEffect(() => {
    if (!open) { setInput(""); setTerm(""); }
  }, [open]);

  const { data, isFetching } = useQuery({
    queryKey: ["global-search", term],
    queryFn: () => runSearch(term, roles),
    enabled: open && term.length >= 2,
    staleTime: 30_000,
  });

  const go = (to: string, search?: { q: string }) => {
    onOpenChange(false);
    navigate(search ? ({ to, search } as never) : ({ to } as never));
  };

  const pages = [POS_ITEM, ...groups.flatMap((g) => g.items)]
    .filter((i) => canSee(i, roles))
    .filter((i) => !input.trim() || i.title.toLowerCase().includes(input.trim().toLowerCase()));

  const hasHits = !!data && (data.orders.length + data.customers.length + data.products.length > 0);
  const searching = term.length >= 2;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} commandProps={{ shouldFilter: false }}>
      <CommandInput
        value={input}
        onValueChange={setInput}
        placeholder="Buscar pedidos, clientes, productos o páginas…"
      />
      <CommandList>
        {searching && !isFetching && !hasHits && pages.length === 0 && (
          <CommandEmpty>Sin resultados para “{term}”.</CommandEmpty>
        )}
        {searching && isFetching && !hasHits && (
          <div className="py-6 text-center text-sm text-muted-foreground">Buscando…</div>
        )}

        {data && data.orders.length > 0 && (
          <CommandGroup heading="Pedidos">
            {data.orders.map((o) => (
              <CommandItem key={o.id} value={`pedido-${o.id}`} onSelect={() => go("/pedidos", { q: o.order_number })}>
                <ShoppingBag className="mr-2 h-4 w-4" />
                <span className="font-mono text-xs">{o.order_number}</span>
                <span className="ml-2 truncate">{o.nombre}</span>
                {o.total != null && (
                  <span className="ml-auto pl-2 text-xs text-muted-foreground tabular-nums">{money(Number(o.total))}</span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {data && data.customers.length > 0 && (
          <CommandGroup heading="Clientes">
            {data.customers.map((c) => (
              <CommandItem key={c.id} value={`cliente-${c.id}`} onSelect={() => go("/clientes", { q: c.nombre })}>
                <Users className="mr-2 h-4 w-4" />
                <span className="truncate">{c.nombre}</span>
                {c.doc_numero && <span className="ml-auto pl-2 text-xs text-muted-foreground">{c.doc_numero}</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {data && data.products.length > 0 && (
          <CommandGroup heading="Productos">
            {data.products.map((p) => (
              <CommandItem key={p.id} value={`producto-${p.id}`} onSelect={() => go("/productos", { q: p.nombre })}>
                <Package className="mr-2 h-4 w-4" />
                <span className="truncate">{p.nombre}</span>
                {p.sku && <span className="ml-auto pl-2 font-mono text-xs text-muted-foreground">{p.sku}</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {pages.length > 0 && (
          <CommandGroup heading="Ir a…">
            {pages.map((i) => (
              <CommandItem key={i.url} value={`pagina-${i.url}`} onSelect={() => go(i.url)}>
                <i.icon className="mr-2 h-4 w-4" />
                {i.title}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
