// src/components/home/OfertaFoto.tsx
// Reemplazo TEMPORAL de «Ofertas vigentes» (pedido del dueño, 2026-11-16): una sola foto-banner con enlace a la ficha del
// «Juego de sala Lineal 3-2-1». Conserva id="ofertas" (la portada, el header y el ticker apuntan a ese ancla).
// Para volver a las ofertas dinámicas: en routes/index.tsx cambiar <OfertaFoto /> por <OfertasVigentes />.
// OJO: el precio, el % y los sellos están dentro de la imagen (public/oferta-lineal.webp); si el precio del producto cambia, hay que reemplazarla.
import { Link } from "@tanstack/react-router";

// Producto de la oferta (misma ficha que https://muebleria-q74c.onrender.com/product/<id>)
const PRODUCTO_OFERTA_ID = "0fad1859-f6e3-4e7f-a598-f14bb7143dcd";

export function OfertaFoto() {
  return (
    <section id="ofertas" aria-label="Oferta destacada" className="scroll-mt-28 py-9 md:py-12">
      <div className="container mx-auto max-w-6xl px-4">
        <Link
          to="/product/$handle"
          params={{ handle: PRODUCTO_OFERTA_ID }}
          className="group block overflow-hidden rounded-[22px] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <img
            src="/oferta-lineal.webp"
            alt="Juego de sala Lineal 3-2-1 a S/ 2,049 con 35 % de descuento (precio regular S/ 3,170), delivery gratis a toda Lima Metropolitana y juego de cojines gratis"
            width={1696}
            height={814}
            loading="lazy"
            className="h-auto w-full transition-transform duration-500 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        </Link>
      </div>
    </section>
  );
}
