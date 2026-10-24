// src/components/ComboBanner.tsx
// Banner grande del combo que más ahorro le da al cliente. Todo sale de datos reales:
// precios de los productos, precio del combo, vencimiento y stock.
import { Link } from "@tanstack/react-router";
import { Image as ImageIcon, PackageCheck, ShoppingBag, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { fmtPEN } from "@/lib/pricing";
import { combosDisponibles, type Combo } from "@/hooks/useCombos";
import { useAgregarCombo } from "@/hooks/useAgregarCombo";
import { useCountdown } from "@/hooks/useCountdown";

const dos = (n: number) => String(n).padStart(2, "0");
/** Un reloj de más de 30 días no genera urgencia real: no se muestra */
const MAX_DIAS_RELOJ = 30;
/** Por debajo de esta cantidad de combos armables avisamos que quedan pocos */
const POCO_STOCK = 5;

function imagenItem(it: Combo["combo_items"][number]) {
  return it.products.imagen_public_id
    ? cloudinaryUrl(it.products.imagen_public_id, { w: 700, h: 700 })
    : it.products.imagen_url;
}

export function ComboBanner({ combo, otros }: { combo: Combo; otros: number }) {
  const { agregar, adding, yaEnCarrito, agotado, precioNormal, ahorro } = useAgregarCombo(combo);

  const venceMs = combo.vence_el ? new Date(combo.vence_el).getTime() : null;
  const r = useCountdown(venceMs);
  const mostrarReloj = r && !r.terminada && r.d <= MAX_DIAS_RELOJ && r.ms > 0;
  const restante =
    r && (r.d > 0 ? `${r.d}d ${dos(r.h)}h ${dos(r.m)}m` : `${dos(r.h)}:${dos(r.m)}:${dos(r.s)}`);

  const pct = precioNormal > 0 ? Math.round((ahorro / precioNormal) * 100) : 0;
  const armables = combosDisponibles(combo);
  const pocoStock = armables != null && armables > 0 && armables <= POCO_STOCK;

  const fotos = combo.combo_items.slice(0, 4).map(imagenItem);
  const celda = (i: number) => {
    const n = fotos.length;
    if (n === 1) return "col-span-2 row-span-2";
    if (n === 2) return "row-span-2";
    if (n === 3 && i === 0) return "row-span-2";
    return "";
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-accent/30 bg-card shadow-[var(--shadow-elegant)]">
      <div className="grid md:grid-cols-2">
        <div className="flex flex-col justify-center gap-4 p-6 sm:p-8 lg:p-10">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-bold uppercase tracking-wide text-accent-foreground">
            <PackageCheck className="h-3.5 w-3.5" /> Combo destacado
          </span>

          <div>
            <h2 className="font-display text-4xl font-semibold leading-tight sm:text-5xl">
              {combo.nombre}
            </h2>
            {combo.descripcion && (
              <p className="mt-2 line-clamp-2 text-muted-foreground">{combo.descripcion}</p>
            )}
          </div>

          <ul className="space-y-1.5 text-sm">
            {combo.combo_items.map((it) => (
              <li
                key={it.id}
                className="flex items-baseline justify-between gap-3 border-b border-dashed border-border pb-1.5"
              >
                <span>
                  {it.cantidad > 1 && <b>{it.cantidad}× </b>}
                  {it.products.nombre}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {fmtPEN(it.products.precio * it.cantidad)}
                </span>
              </li>
            ))}
          </ul>

          <div>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-display text-5xl font-semibold text-accent">
                {fmtPEN(combo.precio_combo)}
              </span>
              <span className="text-lg text-muted-foreground line-through">
                {fmtPEN(precioNormal)}
              </span>
            </div>
            <p className="mt-1 text-sm font-semibold text-accent">
              Ahorras {fmtPEN(ahorro)}
              {pct > 0 && ` (${pct}%)`} llevándolos juntos
            </p>
          </div>

          {(mostrarReloj || pocoStock) && (
            <div className="flex flex-wrap gap-2 text-xs font-medium">
              {mostrarReloj && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1">
                  <Timer className="h-3.5 w-3.5" />
                  Termina en <span className="tabular-nums font-semibold">{restante}</span>
                </span>
              )}
              {pocoStock && (
                <span className="inline-flex items-center rounded-full bg-destructive/10 px-3 py-1 text-destructive">
                  {armables === 1 ? "Queda 1 combo" : `Quedan ${armables} combos`}
                </span>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button
              size="lg"
              className="rounded-full"
              onClick={agregar}
              disabled={adding || agotado || yaEnCarrito}
            >
              {yaEnCarrito ? (
                "Combo en el carrito"
              ) : (
                <>
                  <ShoppingBag className="mr-1.5 h-4 w-4" /> Agregar combo
                </>
              )}
            </Button>
            <Link
              to="/combo/$id"
              params={{ id: combo.id }}
              className="text-sm font-medium underline-offset-4 hover:underline"
            >
              Ver detalle
            </Link>
            {otros > 0 && (
              <a
                href="#combos-todos"
                className="text-sm text-muted-foreground underline-offset-4 hover:underline"
              >
                Ver {otros === 1 ? "otro combo" : `los otros ${otros} combos`}
              </a>
            )}
          </div>
        </div>

        <Link
          to="/combo/$id"
          params={{ id: combo.id }}
          aria-label={`Ver el combo ${combo.nombre}`}
          className="group grid min-h-[16rem] grid-cols-2 grid-rows-2 gap-1.5 bg-muted p-1.5 md:min-h-[26rem]"
        >
          {fotos.map((src, i) => (
            <div key={i} className={`overflow-hidden rounded-xl bg-background ${celda(i)}`}>
              {src ? (
                <img
                  src={src}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <ImageIcon className="h-10 w-10" />
                </div>
              )}
            </div>
          ))}
        </Link>
      </div>
    </div>
  );
}
