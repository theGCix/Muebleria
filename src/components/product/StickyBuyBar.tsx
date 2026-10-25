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
  onAdd: () => void;
}

export function StickyBuyBar({ visible, image, nombre, resumen, precio, disabled, adding, onAdd }: Props) {
  return (
    <div className={`gmx-sticky${visible ? " show" : ""}`} aria-hidden={!visible}>
      <div className="gmx-sticky-in">
        {image && <img src={image} alt="" />}
        <div className="gmx-sticky-txt">
          <div className="gmx-sticky-name">{nombre}</div>
          {resumen && <div className="gmx-sticky-meta">{resumen}</div>}
        </div>
        <div className="gmx-sticky-price">{fmtPEN(precio)}</div>
        <button className={`gm-btn-primary${adding ? " adding" : ""}`} onClick={onAdd} disabled={disabled} tabIndex={visible ? 0 : -1}>
          <ShoppingBag size={16} />
          {adding ? "¡Agregado!" : disabled ? "Agotado" : "Agregar"}
        </button>
      </div>
    </div>
  );
}
