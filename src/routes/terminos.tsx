// src/routes/terminos.tsx
// BORRADOR: revísalo con un abogado antes de darlo por definitivo.
import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage, DatosEmpresa } from "@/components/LegalPage";
import { LIBRO_RECLAMACIONES_URL } from "@/config";

export const Route = createFileRoute("/terminos")({
  head: () => ({
    meta: [
      { title: "Términos y condiciones — G&M Mueblería" },
      { name: "description", content: "Condiciones de compra, fabricación a pedido, pagos, garantía y cambios de G&M Mueblería." },
      { property: "og:title", content: "Términos y condiciones — G&M Mueblería" },
      { property: "og:description", content: "Las reglas claras de tu compra en G&M." },
    ],
  }),
  component: TerminosPage,
});

function TerminosPage() {
  return (
    <LegalPage
      path="/terminos"
      eyebrow="Legal"
      titulo="Términos y condiciones"
      intro="Estas condiciones rigen las compras y el uso de la tienda en línea de G&M Mueblería. Al comprar, aceptas lo que aquí se explica."
      actualizado="Octubre de 2026"
      secciones={[
        { titulo: "Quiénes somos", contenido: <DatosEmpresa /> },
        {
          titulo: "Muebles fabricados a pedido",
          contenido: (
            <>
              <p>
                Nuestros muebles se fabrican a pedido en Lima, en madera tornillo seca y tratada. Por ser madera natural y de
                acabado artesanal, el tono y la veta pueden variar un poco entre piezas y respecto a las fotos.
              </p>
              <p>
                Si pides una pieza a medida, las medidas y los acabados se acuerdan antes de pagar y quedan registrados en la
                cotización.
              </p>
            </>
          ),
        },
        {
          titulo: "Precios y pagos",
          contenido: (
            <>
              <p>
                Los precios publicados son los vigentes al momento de tu compra. Un cambio de precio posterior no afecta a los
                pedidos ya confirmados.
              </p>
              <p>Los pagos con tarjeta se procesan a través de la pasarela de pago Niubiz.</p>
            </>
          ),
        },
        {
          titulo: "Confirmación y entrega",
          contenido: (
            <p>
              Tu pedido queda confirmado cuando recibimos el pago. Los plazos y las formas de entrega están en la página de{" "}
              <Link to="/envios">Envíos</Link>.
            </p>
          ),
        },
        {
          titulo: "Cambios y devoluciones",
          contenido: (
            <p>
              Al ser piezas fabricadas a medida, no se aceptan cambios una vez confirmado el pedido. Si hay un defecto de
              fabricación, reparamos o reponemos la pieza sin costo dentro del período de garantía.
            </p>
          ),
        },
        {
          titulo: "Garantía",
          contenido: (
            <>
              <p>La estructura de tus muebles tiene 2 años de garantía contra defectos de fabricación.</p>
              <p>La garantía no cubre daños por mal uso, golpes, humedad excesiva, modificaciones hechas por terceros ni el desgaste normal.</p>
              <p>Para usarla, escríbenos con fotos del problema y tu número de pedido.</p>
            </>
          ),
        },
        {
          titulo: "Reseñas y fotos de clientes",
          contenido: (
            <p>
              Si dejas una reseña con fotos de tu mueble, nos autorizas a mostrarla en la tienda (por ejemplo, en la galería de{" "}
              <Link to="/proyectos">Proyectos realizados</Link>) junto con tu nombre. Revisamos las reseñas antes de publicarlas
              y puedes pedirnos que retiremos la tuya cuando quieras.
            </p>
          ),
        },
        {
          titulo: "Libro de Reclamaciones",
          contenido: LIBRO_RECLAMACIONES_URL ? (
            <p>
              Tienes a tu disposición nuestro{" "}
              <a href={LIBRO_RECLAMACIONES_URL} target="_blank" rel="noopener noreferrer">
                Libro de Reclamaciones virtual
              </a>{" "}
              para registrar quejas o reclamos sobre nuestros productos y servicios.
            </p>
          ) : (
            <p>Tienes a tu disposición un Libro de Reclamaciones virtual para registrar quejas o reclamos sobre nuestros productos y servicios.</p>
          ),
        },
        {
          titulo: "Cambios en estos términos y ley aplicable",
          contenido: (
            <>
              <p>
                Podemos actualizar estos términos; la versión vigente es la publicada en esta página y aplica a las compras hechas
                desde su fecha de actualización.
              </p>
              <p>Estas condiciones se rigen por las leyes de la República del Perú.</p>
            </>
          ),
        },
      ]}
    />
  );
}