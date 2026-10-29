// src/lib/chatSugerencias.ts
// Preguntas sugeridas del asistente, agrupadas por tema. Cubren lo que un cliente
// suele preguntar en una mueblería: catálogo, precios y pago, envíos, a medida,
// garantía, pedidos, cuenta y contacto.
//
//  · `respuesta` con texto  → respuesta instantánea, sin gastar IA (solo datos fijos de la tienda).
//  · `respuesta: null`      → se envía la pregunta al asistente (necesita datos en vivo: precios, stock, pedido, envío).
//  · `links`                → botones a las páginas relacionadas.
//
// Si cambias plazos, garantía o políticas, actualiza también SYSTEM_PROMPT en server/chat.js
// y las páginas /envios y /terminos: son las mismas fuentes de verdad.
import { ORIGEN_ENVIO } from "@/lib/envios";
import { ENTREGA_MIN_DIAS, ENTREGA_MAX_DIAS } from "@/lib/entrega";

export type ChatLink = {
  label: string;
  to: string;
  params?: Record<string, string>;
  search?: Record<string, string>;
  hash?: string;
};

export type PreguntaChat = {
  label: string;
  pregunta: string;
  respuesta: string | null;
  links?: ChatLink[];
};

export type TemaChat = { id: string; label: string; preguntas: PreguntaChat[] };

const L = {
  catalogo: { label: "Ver el catálogo", to: "/catalogo" },
  envios: { label: "Plazos y envíos", to: "/envios" },
  terminos: { label: "Garantía y condiciones", to: "/terminos" },
  privacidad: { label: "Política de privacidad", to: "/privacidad" },
  medida: { label: "Pedir cotización a medida", to: "/", hash: "a-medida" },
  proyectos: { label: "Ver proyectos realizados", to: "/proyectos" },
  nosotros: { label: "Conocer el taller", to: "/nosotros" },
  testimonios: { label: "Ver testimonios", to: "/testimonios" },
  pedidos: { label: "Mis pedidos", to: "/perfil/pedidos" },
  direcciones: { label: "Mis direcciones", to: "/perfil/direcciones" },
  facturacion: { label: "Datos de facturación", to: "/perfil/facturacion" },
  favoritos: { label: "Mis favoritos", to: "/perfil/favoritos" },
  seguridad: { label: "Cambiar contraseña", to: "/perfil/seguridad" },
  checkout: { label: "Ir a pagar", to: "/checkout" },
} satisfies Record<string, ChatLink>;

const cat = (slug: string, label: string, sub?: string): ChatLink => ({
  label,
  to: "/categoria/$slug",
  params: { slug },
  ...(sub ? { search: { sub } } : {}),
});

export const TEMAS_CHAT: TemaChat[] = [
  {
    id: "productos",
    label: "🛋️ Productos",
    preguntas: [
      {
        label: "¿Qué productos venden?",
        pregunta: "¿Qué productos venden?",
        respuesta:
          "Fabricamos muebles de sala, comedores, recámaras, separadores de ambiente y accesorios (mesas de centro, mesas laterales, puffs y decoración). Puedes recorrerlos por categoría en el catálogo.",
        links: [L.catalogo, cat("muebles", "Muebles de sala"), cat("comedores", "Comedores")],
      },
      { label: "Busco un sofá", pregunta: "¿Qué sofás tienen disponibles?", respuesta: null },
      { label: "Busco un comedor", pregunta: "¿Qué comedores tienen disponibles?", respuesta: null },
      { label: "Busco una cama o recámara", pregunta: "¿Qué camas o recámaras tienen?", respuesta: null },
      { label: "Mesas de centro y accesorios", pregunta: "¿Qué mesas de centro tienen?", respuesta: null },
      {
        label: "¿Qué materiales usan?",
        pregunta: "¿Qué materiales usan?",
        respuesta:
          "Trabajamos con madera tornillo seca y tratada, con acabado a mano y control de calidad pieza por pieza. En la ficha de cada producto ves sus materiales y medidas.",
        links: [L.nosotros],
      },
    ],
  },
  {
    id: "precios",
    label: "💳 Precios y pago",
    preguntas: [
      {
        label: "¿Cómo puedo pagar?",
        pregunta: "¿Cómo puedo pagar?",
        respuesta:
          "Aceptamos tarjetas de crédito y débito (Visa, Mastercard, Amex) mediante Niubiz, con pago 100% seguro y encriptado. Aún no manejamos pago contraentrega ni transferencia directa.",
        links: [L.checkout],
      },
      { label: "¿Cuánto cuesta un sofá?", pregunta: "¿Cuánto cuesta un sofá?", respuesta: null },
      { label: "Tengo un presupuesto límite", pregunta: "Tengo un presupuesto limitado, ¿qué me recomiendas?", respuesta: null },
      {
        label: "¿Tienen cupones o descuentos?",
        pregunta: "¿Tienen cupones o descuentos?",
        respuesta:
          "Sí, a veces lanzamos cupones y ofertas. Si tienes un código, ingrésalo al pagar en el checkout. Las ofertas y combos vigentes aparecen en el inicio de la tienda.",
        links: [{ label: "Ver ofertas", to: "/" }],
      },
      {
        label: "¿Dan boleta o factura?",
        pregunta: "¿Dan boleta o factura?",
        respuesta:
          "Sí, emitimos comprobantes electrónicos. Si necesitas factura, deja tus datos de facturación (RUC y razón social) en tu perfil.",
        links: [L.facturacion],
      },
    ],
  },
  {
    id: "envios",
    label: "🚚 Envíos",
    preguntas: [
      {
        label: "¿Cómo es el envío?",
        pregunta: "¿Cómo es el envío?",
        respuesta: `Hacemos envío a domicilio en Lima y Callao: el costo depende de tu distrito y lo ves en el checkout antes de pagar (o pregúntame por tu distrito y te lo cotizo aquí). También puedes elegir "Recojo en tienda" sin costo, en ${ORIGEN_ENVIO}.`,
        links: [L.envios],
      },
      { label: "¿Cuánto cuesta enviar a mi distrito?", pregunta: "¿Cuánto cuesta el envío a mi distrito?", respuesta: null },
      {
        label: "¿Cuánto demora la entrega?",
        pregunta: "¿Cuánto demora la entrega?",
        respuesta: `Cada pieza se fabrica a pedido. En Lima Metropolitana entregamos en ${ENTREGA_MIN_DIAS}–${ENTREGA_MAX_DIAS} días hábiles y en provincias en 10–15 días hábiles. La fecha exacta la coordinamos contigo al confirmar tu compra.`,
        links: [L.envios],
      },
      {
        label: "¿Envían a provincias?",
        pregunta: "¿Envían a provincias?",
        respuesta:
          "Sí. En provincias el costo depende de la zona y del volumen del mueble; te damos un estimado y nuestro equipo lo confirma antes de despachar. Si me dices tu departamento, provincia y el mueble, te hago una estimación.",
        links: [L.envios],
      },
      {
        label: "¿Puedo recoger en tienda?",
        pregunta: "¿Puedo recoger en tienda?",
        respuesta: `Sí, sin costo de envío: elige "Recojo en tienda" al pagar (${ORIGEN_ENVIO}). Te avisamos cuando tu pedido esté listo para recoger.`,
        links: [L.envios],
      },
    ],
  },
  {
    id: "medida",
    label: "📐 A medida",
    preguntas: [
      {
        label: "¿Hacen muebles a medida?",
        pregunta: "¿Hacen muebles a medida?",
        respuesta:
          "Sí. Cuéntanos qué tipo de mueble necesitas, las medidas aproximadas y el espacio donde irá, y te preparamos una cotización.",
        links: [L.medida, L.proyectos],
      },
      {
        label: "¿Cuánto demora uno a medida?",
        pregunta: "¿Cuánto demora un mueble a medida?",
        respuesta:
          "El plazo se acuerda en la cotización y puede ser distinto al de los modelos del catálogo, según el diseño y el tamaño de la pieza.",
        links: [L.medida],
      },
      {
        label: "¿Cómo fabrican los muebles?",
        pregunta: "¿Cómo fabrican los muebles?",
        respuesta:
          "Cada pieza se fabrica a pedido en nuestro taller de Lima: madera tornillo seca y tratada, acabado a mano y control de calidad antes del despacho. En la página del taller ves el proceso paso a paso.",
        links: [L.nosotros],
      },
      {
        label: "¿Puedo ver trabajos anteriores?",
        pregunta: "¿Puedo ver trabajos anteriores?",
        respuesta: "Claro: en Proyectos mostramos piezas especiales que fabricamos, y en Testimonios las opiniones y fotos de clientes.",
        links: [L.proyectos, L.testimonios],
      },
    ],
  },
  {
    id: "garantia",
    label: "🛡️ Garantía y cambios",
    preguntas: [
      {
        label: "¿Qué garantía tienen?",
        pregunta: "¿Qué garantía tienen?",
        respuesta:
          "La estructura de tus muebles tiene 2 años de garantía contra defectos de fabricación. Si notas un defecto en ese periodo, lo reparamos o reponemos sin costo.",
        links: [L.terminos],
      },
      {
        label: "¿Qué no cubre la garantía?",
        pregunta: "¿Qué no cubre la garantía?",
        respuesta:
          "No cubre daños por mal uso, golpes, humedad excesiva, modificaciones hechas por terceros ni el desgaste normal.",
        links: [L.terminos],
      },
      {
        label: "¿Puedo cambiar o devolver?",
        pregunta: "¿Puedo cambiar o devolver un mueble?",
        respuesta:
          "Como son piezas fabricadas a pedido, no se aceptan cambios una vez confirmado el pedido. Si hay un defecto de fabricación, lo reparamos o reponemos sin costo dentro de la garantía.",
        links: [L.terminos],
      },
      {
        label: "Quiero hacer un reclamo",
        pregunta: "Quiero hacer un reclamo",
        respuesta:
          "Escríbenos con fotos del problema y tu número de pedido y lo revisamos. También tienes a tu disposición nuestro Libro de Reclamaciones virtual, que encuentras en los términos de la tienda.",
        links: [L.terminos],
      },
    ],
  },
  {
    id: "pedidos",
    label: "📦 Mi pedido",
    preguntas: [
      { label: "Consultar mi pedido", pregunta: "Quiero consultar el estado de mi pedido", respuesta: null },
      {
        label: "¿Qué significan los estados?",
        pregunta: "¿Qué significan los estados de mi pedido?",
        respuesta:
          "Tu pedido pasa por: pago recibido, en producción, control de calidad, listo para despacho, en camino y entregado. Los ves en tu perfil después de pagar.",
        links: [L.pedidos],
      },
      {
        label: "¿Puedo modificar mi pedido?",
        pregunta: "¿Puedo modificar o cancelar mi pedido?",
        respuesta:
          "Al ser piezas fabricadas a pedido, no se aceptan cambios una vez confirmado el pedido (queda confirmado cuando recibimos el pago). Si tienes una urgencia, escríbenos cuanto antes y vemos qué se puede hacer.",
        links: [L.pedidos],
      },
    ],
  },
  {
    id: "cuenta",
    label: "👤 Mi cuenta",
    preguntas: [
      {
        label: "¿Necesito cuenta para comprar?",
        pregunta: "¿Necesito cuenta para comprar?",
        respuesta:
          "Puedes recorrer el catálogo y armar tu carrito libremente, pero para pagar necesitas iniciar sesión o crear tu cuenta. Así guardamos tu pedido y puedes seguirlo desde tu perfil.",
      },
      {
        label: "Guardar mis direcciones",
        pregunta: "¿Cómo guardo mis direcciones de entrega?",
        respuesta: "En tu perfil, sección Direcciones, puedes guardar y editar tus direcciones de entrega.",
        links: [L.direcciones],
      },
      {
        label: "Mis favoritos",
        pregunta: "¿Dónde veo mis productos favoritos?",
        respuesta: "Los productos que marcas con el corazón quedan guardados en tu perfil, en Favoritos.",
        links: [L.favoritos],
      },
      {
        label: "Cambiar mi contraseña",
        pregunta: "¿Cómo cambio mi contraseña?",
        respuesta: "Puedes cambiarla desde tu perfil, en la sección Seguridad.",
        links: [L.seguridad],
      },
      {
        label: "¿Qué hacen con mis datos?",
        pregunta: "¿Qué hacen con mis datos personales?",
        respuesta: "Usamos tus datos solo para gestionar tu compra y tu entrega. El detalle completo está en nuestra política de privacidad.",
        links: [L.privacidad],
      },
    ],
  },
  {
    id: "contacto",
    label: "💬 Contacto",
    preguntas: [
      {
        label: "¿Cómo los contacto?",
        pregunta: "¿Cómo puedo contactarlos?",
        respuesta:
          "Puedes escribirme aquí, escribirnos por WhatsApp (botón en la página del taller y en la ficha de cada producto) o dejar tu consulta en el formulario de muebles a medida.",
        links: [L.nosotros, L.medida],
      },
      {
        label: "¿Dónde está su taller?",
        pregunta: "¿Dónde está su taller o tienda?",
        respuesta: `Nuestro taller está en Lima y el recojo en tienda es en ${ORIGEN_ENVIO}. En la página del taller encuentras más datos y el botón de WhatsApp.`,
        links: [L.nosotros],
      },
      {
        label: "Hablar con una persona",
        pregunta: "Quiero hablar con una persona",
        respuesta:
          "Claro. Escríbenos por WhatsApp desde la página del taller y el equipo te responde. Si es por un mueble a medida, también puedes dejar tu cotización y te contactamos.",
        links: [L.nosotros, L.medida],
      },
    ],
  },
];
