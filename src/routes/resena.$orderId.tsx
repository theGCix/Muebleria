// src/routes/resena.$orderId.tsx
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Star, Loader2, CheckCircle2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/resena/$orderId")({
  component: ResenaPage,
});

type ItemPendiente = {
  order_item_id: string;
  product_id: string;
  title: string;
  image_url: string | null;
};

function StarRating({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className="p-0.5"
          aria-label={`${n} estrellas`}
        >
          <Star
            className={`h-6 w-6 transition-colors ${
              n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

function TarjetaItem({
  orderId, email, item, onEnviado,
}: { orderId: string; email: string; item: ItemPendiente; onEnviado: (id: string) => void }) {
  const [calificacion, setCalificacion] = useState(0);
  const [titulo, setTitulo] = useState("");
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    if (calificacion === 0) { toast.error("Selecciona una calificación de 1 a 5 estrellas"); return; }
    setEnviando(true);
    const { error } = await supabase.rpc("enviar_resena", {
      _order_id: orderId,
      _email: email,
      _order_item_id: item.order_item_id,
      _calificacion: calificacion,
      _titulo: titulo || null,
      _comentario: comentario || null,
    });
    setEnviando(false);
    if (error) { toast.error(error.message); return; }
    toast.success("¡Gracias por tu reseña!");
    onEnviado(item.order_item_id);
  };

  return (
    <div className="bg-card border border-border/50 rounded-xl p-5 space-y-3">
      <div className="flex items-center gap-3">
        {item.image_url ? (
          <img src={item.image_url} alt={item.title} className="w-14 h-14 rounded-md object-cover flex-shrink-0" />
        ) : (
          <div className="w-14 h-14 rounded-md bg-muted flex-shrink-0" />
        )}
        <p className="font-medium">{item.title}</p>
      </div>

      <div>
        <Label className="text-xs">Tu calificación</Label>
        <div className="mt-1"><StarRating value={calificacion} onChange={setCalificacion} /></div>
      </div>

      <div>
        <Label htmlFor={`titulo-${item.order_item_id}`} className="text-xs">Título (opcional)</Label>
        <Input
          id={`titulo-${item.order_item_id}`} className="mt-1"
          placeholder="Ej. Superó mis expectativas"
          value={titulo} onChange={(e) => setTitulo(e.target.value)}
        />
      </div>

      <div>
        <Label htmlFor={`comentario-${item.order_item_id}`} className="text-xs">Comentario (opcional)</Label>
        <textarea
          id={`comentario-${item.order_item_id}`}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
          placeholder="Cuéntanos sobre la calidad, el acabado, si cumplió lo que esperabas..."
          value={comentario} onChange={(e) => setComentario(e.target.value)}
        />
      </div>

      <Button onClick={enviar} disabled={enviando} className="rounded-full">
        {enviando && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Enviar reseña
      </Button>
    </div>
  );
}

function ResenaPage() {
  const { orderId } = Route.useParams();
  const [email, setEmail] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [items, setItems] = useState<ItemPendiente[] | null>(null);
  const [enviados, setEnviados] = useState<Set<string>>(new Set());

  const buscar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBuscando(true);
    const { data, error } = await supabase.rpc("get_items_pendientes_resena", {
      _order_id: orderId,
      _email: email.trim(),
    });
    setBuscando(false);
    if (error) { toast.error(error.message); return; }
    setItems((data ?? []) as ItemPendiente[]);
  };

  const pendientes = (items ?? []).filter((i) => !enviados.has(i.order_item_id));

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-10 max-w-2xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="h-4 w-4" /> Volver a la tienda
        </Link>

        <h1 className="font-display text-3xl font-semibold mb-2">Cuéntanos qué te pareció</h1>
        <p className="text-muted-foreground mb-8">Tu opinión ayuda a que otros clientes elijan con más confianza.</p>

        {items === null && (
          <form onSubmit={buscar} className="bg-card border border-border/50 rounded-xl p-6 space-y-4">
            <div>
              <Label htmlFor="email">Correo con el que hiciste la compra</Label>
              <Input
                id="email" type="email" required className="mt-1"
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="tucorreo@ejemplo.com"
              />
            </div>
            <Button type="submit" disabled={buscando} className="rounded-full w-full">
              {buscando && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Continuar
            </Button>
          </form>
        )}

        {items !== null && items.length === 0 && (
          <div className="bg-card border border-border/50 rounded-xl p-8 text-center">
            <p className="text-muted-foreground">
              No encontramos productos pendientes de reseñar con ese correo para este pedido — puede que ya los hayas reseñado todos, o que el correo no coincida.
            </p>
          </div>
        )}

        {pendientes.length > 0 && (
          <div className="space-y-4">
            {pendientes.map((item) => (
              <TarjetaItem
                key={item.order_item_id}
                orderId={orderId} email={email} item={item}
                onEnviado={(id) => setEnviados((s) => new Set(s).add(id))}
              />
            ))}
          </div>
        )}

        {items !== null && items.length > 0 && pendientes.length === 0 && (
          <div className="bg-card border border-border/50 rounded-xl p-8 text-center flex flex-col items-center gap-3">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            <p className="font-medium">¡Gracias! Ya reseñaste todos los productos de este pedido.</p>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}