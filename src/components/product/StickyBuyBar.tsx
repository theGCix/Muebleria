// src/components/product/StickyBuyBar.tsx
// Barra de compra fija. En móvil (≤ 640 px) está SIEMPRE visible; en pantallas grandes aparece cuando el
// botón principal sale de pantalla. Tras agregar al carrito cambia a «Seguir comprando» / «Ir a pagar».
import { Link } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";
import { fmtPEN } from "@/lib/pricing";
import { getCategoria } from "@/lib/categories";
import "./product-experience.css";

/** «Seguir comprando»: vuelve a la categoría del producto (o al catálogo si no se reconoce). */
export function SeguirComprandoLink({
  categoria,
  className,
  children,
}: {
  categoria?: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  const cat = categoria ? getCategoria(categoria) : undefined;
  return cat ? (
    <Link to="/categoria/$slug" params={{ slug: cat.slug }} className={className}>
      {children}
    </Link>
  ) : (
    <Link to="/catalogo" className={className}>
      {children}
    </Link>
  );
}

interface Props {
  visible: boolean;
  image: string | null;
  nombre: string;
  resumen: string;
  precio: number;
  disabled: boolean;
  adding: boolean;
  qtyEnCarrito?: number;
  /** true tras agregar: la barra ofrece «Ir a pagar» (principal) y «Seguir comprando» (secundario). */
  postAdd?: boolean;
  categoria?: string | null;
  onAdd: () => void;
}

export function StickyBuyBar({ visible, image, nombre, resumen, precio, disabled, adding, qtyEnCarrito = 0, postAdd = false, categoria, onAdd }: Props) {
  return (
    <div className={`gmx-sticky${visible ? " show" : ""}`}>
      <div className="gmx-sticky-in">
        {image && <img src={image} alt="" />}
        <div className="gmx-sticky-txt">
          <div className="gmx-sticky-name">{nombre}</div>
          {resumen && <div className="gmx-sticky-meta">{resumen}</div>}
        </div>
        {postAdd ? (
          <>
            <SeguirComprandoLink categoria={categoria} className="gmx-sticky-more">
              Seguir comprando
            </SeguirComprandoLink>
            <Link to="/checkout" className="gm-btn-primary gmx-sticky-pay">
              Ir a pagar
            </Link>
          </>
        ) : (
          <>
            <div className="gmx-sticky-price">{fmtPEN(precio)}</div>
            <button
              type="button"
              className={`gm-btn-primary${adding ? " adding" : ""}${!adding && qtyEnCarrito > 0 ? " in-cart" : ""}`}
              onClick={onAdd}
              disabled={disabled}
            >
              <ShoppingBag size={16} />
              {adding ? "¡Agregado!" : disabled ? "Agotado" : qtyEnCarrito > 0 ? `En carrito (${qtyEnCarrito}) · +1` : "Agregar al carrito"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}