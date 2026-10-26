// src/components/product/StickyBuyBar.tsx
// Barra de compra que aparece cuando el botón principal sale de pantalla.
import { ShoppingBag } from "lucide-react";
import { fmtPEN } from "@/lib/pricing";
import "./product-experience.css";

interface Props {
  visible: boolean;
  image: string | null;
  nombre: string;
  resumen: string;
  precio: number;
  disabled: boolean;
  adding: boolean;
  qtyEnCarrito?: number;
  onAdd: () => void;
}

export function StickyBuyBar({ visible, image, nombre, resumen, precio, disabled, adding, qtyEnCarrito = 0, onAdd }: Props) {
  return (
    <div className={`gmx-sticky${visible ? " show" : ""}`} aria-hidden={!visible}>
      <div className="gmx-sticky-in">
        {image && <img src={image} alt="" />}
        <div className="gmx-sticky-txt">
          <div className="gmx-sticky-name">{nombre}</div>
          {resumen && <div className="gmx-sticky-meta">{resumen}</div>}
        </div>
        <div className="gmx-sticky-price">{fmtPEN(precio)}</div>
        <button className={`gm-btn-primary${adding ? " adding" : ""}${!adding && qtyEnCarrito > 0 ? " in-cart" : ""}`} onClick={onAdd} disabled={disabled} tabIndex={visible ? 0 : -1}>
          <ShoppingBag size={16} />
          {adding ? "¡Agregado!" : disabled ? "Agotado" : qtyEnCarrito > 0 ? `En carrito (${qtyEnCarrito}) · +1` : "Agregar"}
        </button>
      </div>
    </div>
  );
}
