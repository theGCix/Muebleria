// src/routes/envios.tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { ENTREGA_MAX_DIAS, ENTREGA_MIN_DIAS } from "@/lib/entrega";

export const Route = createFileRoute("/envios")({
  head: () => ({
    meta: [
      { title: "Envíos y entregas — G&M Mueblería" },
      {
        name: "description",
        content: "Plazos de entrega en Lima y provincias, recojo en tienda y cómo coordinamos la entrega de tu mueble.",
      },
      { property: "og:title", content: "Envíos y entregas — G&M Mueblería" },
      { property: "og:description", content: "Cuándo y cómo recibes tu mueble G&M." },
    ],
  }),
  component: EnviosPage,
});

function EnviosPage() {
  return (
    <LegalPage
      path="/envios"
      eyebrow="Envíos"
      titulo="Cómo y cuándo recibes tu mueble"
      intro="Cada pieza se fabrica a pedido en nuestro taller de Lima, por eso coordinamos la entrega contigo."
      actualizado="Octubre de 2026"
      secciones={[
        {
          titulo: "Plazos de entrega",
          contenido: (
            <>
              <ul>
                <li>
                  <strong>Lima Metropolitana:</strong> {ENTREGA_MIN_DIAS}–{ENTREGA_MAX_DIAS} días hábiles.
                </li>
                <li>
                  <strong>Provincias:</strong> 10–15 días hábiles.
                </li>
              </ul>
              <p>
                Como el mueble se fabrica a pedido, confirmamos la fecha exacta contigo al confirmar tu compra. Los días hábiles
                se cuentan de lunes a viernes.
              </p>
            </>
          ),
        },
        {
          titulo: "Entrega a domicilio",
          contenido: (
            <>
              <p>
                El costo de envío depende de tu distrito y lo ves en el checkout antes de pagar. Coordinamos contigo el día y el
                horario de entrega.
              </p>
              <p>Al recibir, revisa que la pieza esté completa y en buen estado, y avísanos de inmediato si notas algo.</p>
            </>
          ),
        },
        {
          titulo: "Recojo en tienda",
          contenido: (
            <p>
              Puedes elegir recojo en tienda al pagar, sin costo de envío. Te avisamos cuando tu pedido esté listo para recoger.
            </p>
          ),
        },
        {
          titulo: "Seguimiento de tu pedido",
          contenido: (
            <p>
              Después de pagar ves el estado de tu pedido: pago recibido, en producción, control de calidad, listo para despacho, en
              camino y entregado. Si tienes dudas, escríbenos por el asistente virtual de la tienda.
            </p>
          ),
        },
        {
          titulo: "Muebles a medida",
          contenido: (
            <p>
              Si pediste una cotización a medida, el plazo se acuerda en la cotización y puede ser distinto al de los modelos del
              catálogo. <Link to="/" hash="a-medida">Pedir cotización</Link>.
            </p>
          ),
        },
      ]}
    />
  );
}