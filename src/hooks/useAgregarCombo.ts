// src/hooks/useAgregarCombo.ts
// Lógica compartida para agregar un combo al carrito (tarjeta y banner usan exactamente la misma).
import { useState } from "react";
import { toast } from "sonner";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { useCartStore } from "@/stores/cartStore";
import { precioNormalCombo, type Combo } from "@/hooks/useCombos";

export function useAgregarCombo(combo: Combo) {
  const addItems = useCartStore((s) => s.addItems);
  const items = useCartStore((s) => s.items);
  const [adding, setAdding] = useState(false);

  const precioNormal = precioNormalCombo(combo);
  const ahorro = precioNormal - combo.precio_combo;
  const factor = precioNormal > 0 ? combo.precio_combo / precioNormal : 1;

  const yaEnCarrito = combo.combo_items.every((it) =>
    items.some((c) => c.id === it.product_id && c.comboId === combo.id),
  );
  const agotado = combo.combo_items.some((it) => (it.products.stock ?? 1) <= 0);

  function agregar() {
    setAdding(true);
    // Reparte el precio del combo entre los productos, proporcional al precio individual
    // de cada uno, para que cada línea del carrito siga apuntando a un product_id real
    // (necesario para el checkout).
    const nuevos = combo.combo_items.map((it) => ({
      id: it.product_id,
      title: it.products.nombre,
      price: Math.round(it.products.precio * factor * 100) / 100,
      image: it.products.imagen_public_id
        ? cloudinaryUrl(it.products.imagen_public_id, { w: 400, h: 300 })
        : (it.products.imagen_url ?? ""),
      sku: it.products.sku ?? undefined,
      qty: it.cantidad,
      comboId: combo.id,
      comboLabel: combo.nombre,
    }));
    addItems(nuevos);
    toast.success(`Combo "${combo.nombre}" agregado al carrito`);
    setTimeout(() => setAdding(false), 1200);
  }

  return { agregar, adding, yaEnCarrito, agotado, precioNormal, ahorro };
}
