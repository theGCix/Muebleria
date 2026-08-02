import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Tag, X } from "lucide-react";

interface CartItemInput {
  product_id: string | null;
  categoria: string | null;
  combo_id?: string | null;
  qty: number;
  unit_price: number;
}

interface CuponAplicado {
  id: string;
  codigo: string;
  descuento: number;
}

interface CuponInputProps {
  customerId: string | null;
  items: CartItemInput[];
  onAplicado: (cupon: CuponAplicado | null) => void;
}

export function CuponInput({ customerId, items, onAplicado }: CuponInputProps) {
  const [codigo, setCodigo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aplicado, setAplicado] = useState<CuponAplicado | null>(null);

  async function handleAplicar() {
    if (!codigo.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/cupones/validar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo, customerId, items }),
      });
      const data = await res.json();

      if (!data.valid) {
        setError(data.error ?? "Cupón inválido");
        setAplicado(null);
        onAplicado(null);
      } else {
        const nuevo = {
          id: data.cupon.id,
          codigo: data.cupon.codigo,
          descuento: data.descuento,
        };
        setAplicado(nuevo);
        onAplicado(nuevo);
      }
    } catch {
      setError("No se pudo validar el cupón, intenta de nuevo");
    } finally {
      setLoading(false);
    }
  }

  function quitarCupon() {
    setAplicado(null);
    setCodigo("");
    setError(null);
    onAplicado(null);
  }

  if (aplicado) {
    return (
      <div className="flex items-center justify-between rounded-md border border-green-200 bg-green-50 px-3 py-2">
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-green-600" />
          <span className="font-mono text-sm font-medium">{aplicado.codigo}</span>
          <Badge variant="secondary" className="text-green-700">
            -S/ {aplicado.descuento.toFixed(2)}
          </Badge>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={quitarCupon}>
          <X className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <Input
          placeholder="Código de cupón"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAplicar()}
          className="font-mono uppercase"
        />
        <Button onClick={handleAplicar} disabled={loading || !codigo.trim()} variant="outline">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aplicar"}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}