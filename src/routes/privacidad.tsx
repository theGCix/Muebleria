// src/routes/privacidad.tsx
// BORRADOR: revísalo con un abogado antes de darlo por definitivo (Ley N.° 29733, Protección de Datos Personales).
import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, DatosEmpresa } from "@/components/LegalPage";
import { EMPRESA } from "@/config";

export const Route = createFileRoute("/privacidad")({
  head: () => ({
    meta: [
      { title: "Política de privacidad — G&M Mueblería" },
      { name: "description", content: "Qué datos recopilamos, para qué los usamos y cómo ejercer tus derechos sobre ellos." },
      { property: "og:title", content: "Política de privacidad — G&M Mueblería" },
      { property: "og:description", content: "Cómo cuidamos tus datos en G&M." },
    ],
  }),
  component: PrivacidadPage,
});

function PrivacidadPage() {
  const contacto = EMPRESA.email ? (
    <a href={`mailto:${EMPRESA.email}`}>{EMPRESA.email}</a>
  ) : (
    "nuestros canales de contacto"
  );

  return (
    <LegalPage
      path="/privacidad"
      eyebrow="Legal"
      titulo="Política de privacidad"
      intro="Explicamos qué datos tuyos usamos, para qué y cómo puedes controlarlos."
      actualizado="Octubre de 2026"
      secciones={[
        { titulo: "Quién es el responsable", contenido: <DatosEmpresa /> },
        {
          titulo: "Qué datos recopilamos",
          contenido: (
            <ul>
              <li>
                <strong>Tu cuenta:</strong> nombre y correo. Si ingresas con Google o Facebook, recibimos los datos básicos de
                tu perfil que ese servicio nos comparte.
              </li>
              <li>
                <strong>Tus pedidos:</strong> teléfono, distrito y dirección de entrega, y el detalle de lo que compras.
              </li>
              <li>
                <strong>Cotizaciones y cupones:</strong> los datos de contacto que nos dejas en los formularios.
              </li>
              <li>
                <strong>Reseñas y fotos de entrega:</strong> tu comentario, tu calificación y las fotos que subas al recibir tu pedido.
              </li>
              <li>
                <strong>Asistente virtual:</strong> los mensajes que escribes en el chat de la tienda, que guardamos para mejorar
                las respuestas.
              </li>
              <li>
                <strong>Uso del sitio:</strong> páginas y productos vistos, y el origen de la visita (por ejemplo, una campaña).
              </li>
            </ul>
          ),
        },
        {
          titulo: "Para qué los usamos",
          contenido: (
            <ul>
              <li>Procesar, fabricar y entregar tus pedidos, y atender tu garantía.</li>
              <li>Responder cotizaciones y consultas.</li>
              <li>Mostrar reseñas verificadas de clientes en la tienda.</li>
              <li>Entender qué buscan los clientes y mejorar el sitio y el asistente virtual.</li>
            </ul>
          ),
        },
        {
          titulo: "Con quién los compartimos",
          contenido: (
            <>
              <p>No vendemos tus datos. Los compartimos solo con los servicios que hacen funcionar la tienda:</p>
              <ul>
                <li>Niubiz, para procesar los pagos con tarjeta.</li>
                <li>Servicios de alojamiento, base de datos y almacenamiento de imágenes que usamos para operar el sitio.</li>
                <li>Google o Facebook, si eliges ingresar con tu cuenta de alguno de ellos.</li>
              </ul>
              <p>También podemos compartirlos con una autoridad cuando la ley lo exija.</p>
            </>
          ),
        },
        {
          titulo: "Cuánto tiempo los conservamos",
          contenido: (
            <p>
              Mientras tu cuenta esté activa y el tiempo necesario para atender pedidos, garantías y obligaciones legales o
              tributarias.
            </p>
          ),
        },
        {
          titulo: "Tus derechos",
          contenido: (
            <>
              <p>
                De acuerdo con la Ley N.° 29733, puedes pedir acceso a tus datos, que los rectifiquemos, que los cancelemos o que
                dejemos de usarlos para un fin (oposición).
              </p>
              <p>Escríbenos a {contacto} indicando qué quieres hacer y con qué correo compraste o te registraste.</p>
            </>
          ),
        },
        {
          titulo: "Datos guardados en tu navegador",
          contenido: (
            <p>
              Guardamos en tu navegador algunas preferencias para que la tienda funcione mejor, como el distrito de entrega que
              elegiste o tu sesión. Puedes borrarlas desde la configuración de tu navegador.
            </p>
          ),
        },
        {
          titulo: "Cambios en esta política",
          contenido: <p>Si la actualizamos, publicaremos la nueva versión en esta página con su fecha.</p>,
        },
      ]}
    />
  );
}