// src/components/home/LiquidacionesHome.tsx
// Banners de liquidación del home, por categoría y SIN títulos (decisión del dueño, 2026-11-16): de frente las imágenes.
// Por cada categoría con liquidaciones: sus 5 más recientes; en PC 3 arriba y 2 abajo (cuadrícula de 6 columnas), en móvil
// una debajo de otra. Con menos de 5 se reparten sin huecos (lib/liquidacion.ts → spansBanners). Sin liquidaciones, nada.
import { useMemo } from "react";
import { CATEGORIAS } from "@/lib/categories";
import { agruparPorCategoria, spansBanners } from "@/lib/liquidacion";
import { useLiquidacionesHome } from "@/hooks/useLiquidacionesHome";
import { TarjetaLiquidacion } from "./BannerLiquidacion";

// Clases literales (Tailwind no ve nombres armados con variables)
const SPAN: Record<number, string> = { 2: "lg:col-span-2", 3: "lg:col-span-3", 6: "lg:col-span-6" };
// Proporción del banner en PC (tarjeta angosta 4:3, ancha 2:1, única 3:1); en móvil siempre 4:3
const ASPECTO: Record<number, string> = { 2: "lg:aspect-[4/3]", 3: "lg:aspect-[2/1]", 6: "lg:aspect-[3/1]" };

export function LiquidacionesHome() {
  const { data = [] } = useLiquidacionesHome();
  const grupos = useMemo(() => {
    const porCat = agruparPorCategoria(data);
    return CATEGORIAS.map((c) => ({ slug: c.slug, items: porCat[c.slug] ?? [] })).filter((g) => g.items.length > 0);
  }, [data]);

  if (grupos.length === 0) return null;

  return (
    <section id="liquidacion" aria-label="Liquidación" className="container mx-auto max-w-6xl space-y-4 px-4 py-6 md:space-y-6 md:py-8">
      {grupos.map((g) => {
        const spans = spansBanners(g.items.length);
        return (
          <ul key={g.slug} className="grid grid-cols-1 gap-4 lg:grid-cols-6">
            {g.items.map((l, i) => (
              <li key={l.id} className={`${SPAN[spans[i]]} min-w-0`}>
                <TarjetaLiquidacion
                  productId={l.product_id}
                  ancho={spans[i] >= 3}
                  className={`aspect-[4/3] w-full ${ASPECTO[spans[i]]}`}
                  d={{
                    imagen: l.imagen, kicker: l.kicker, nombre: l.nombre, detalle: l.detalle,
                    precioRegular: l.precioRegular, precioFinal: l.precioFinal, descuento: l.descuento,
                    envioTipo: l.envioTipo, envioDescuento: l.envioDescuento, regaloCojines: l.regaloCojines,
                  }}
                />
              </li>
            ))}
          </ul>
        );
      })}
    </section>
  );
}
