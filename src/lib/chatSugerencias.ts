// src/lib/chatSugerencias.ts
// Preguntas sugeridas del asistente, agrupadas por tema. Cubren lo que un cliente
// suele preguntar en una mueblería: catálogo, precios y pago, envíos, a medida,
// garantía, pedidos, cuenta y contacto.
//
//  · `respuesta` con texto  → respuesta instantánea, sin gastar IA (solo datos fijos de la tienda).
//  · `respuesta: null`      → se envía la pregunta al asistente (necesita datos en vivo: precios, stock, pedido, envío).
//  · `links`                → botones a las páginas relacionadas. `to: "#login"` abre el modal de inicio de sesión.
//  · `equipo(...)`          → datos que NO están en el sitio (cuotas, armado, horarios…): el bot deriva al equipo
//                             en vez de inventar. Reemplaza su texto por la respuesta real cuando la tengas.
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
  login: { label: "Iniciar sesión", to: "#login" },
} satisfies Record<string, ChatLink>;

const cat = (slug: string, label: string, sub?: string): ChatLink => ({
  label,
  to: "/categoria/$slug",
  params: { slug },
  ...(sub ? { search: { sub } } : {}),
});

const ia = (label: string, pregunta: string): PreguntaChat => ({ label, pregunta, respuesta: null });
const fija = (label: string, respuesta: string, links?: ChatLink[], pregunta = label): PreguntaChat => ({
  label, pregunta, respuesta, links,
});
// POR CONFIRMAR: el sitio no publica este dato. Se deriva al equipo para no prometer algo falso.
const equipo = (label: string, pregunta = label): PreguntaChat =>
  fija(
    label,
    "Ese dato lo confirma nuestro equipo según tu caso. Escríbenos por WhatsApp (botón en la página del taller) o déjanos tu consulta en el formulario a medida y te responden.",
    [L.nosotros, L.medida],
    pregunta,
  );

export const TEMAS_CHAT: TemaChat[] = [
  {
    id: "sala",
    label: "🛋️ Sala",
    preguntas: [
      fija("¿Qué muebles de sala tienen?", "Tenemos muebles de sala, para departamento y para mini departamento. Entra a la categoría para ver modelos, medidas y precios.", [cat("muebles", "Muebles de sala", "sala"), cat("muebles", "Para departamento", "departamento"), cat("muebles", "Mini departamento", "mini-departamento")]),
      ia("Busco un sofá", "¿Qué sofás tienen disponibles?"),
      ia("Juegos de sala", "¿Qué juegos de sala tienen?"),
      ia("Sillones individuales", "¿Tienen sillones individuales?"),
      ia("Sofás para espacios pequeños", "Busco un sofá para un espacio pequeño o mini departamento, ¿qué tienen?"),
      ia("Mueble para departamento", "¿Qué muebles tienen para departamento?"),
      ia("Sofá más económico", "¿Cuál es el sofá más económico que tienen?"),
      ia("Sofá hasta S/ 1000", "Busco un sofá hasta S/ 1000"),
      ia("Sofá hasta S/ 2000", "Busco un sofá hasta S/ 2000"),
      ia("¿Hay sofás en stock?", "¿Qué sofás tienen en stock para despacho inmediato?"),
      ia("Mesas de TV o racks", "¿Tienen muebles para TV o racks?"),
    ],
  },
  {
    id: "comedores",
    label: "🍽️ Comedores",
    preguntas: [
      fija("¿Qué comedores tienen?", "Tenemos comedores de 4, 6 y 8 sillas, en madera y en vidrio. Puedes filtrarlos por tamaño y material.", [cat("comedores", "Ver comedores"), cat("comedores", "4 sillas", "4-sillas"), cat("comedores", "6 sillas", "6-sillas")]),
      ia("Comedor de 4 sillas", "¿Qué comedores de 4 sillas tienen?"),
      ia("Comedor de 6 sillas", "¿Qué comedores de 6 sillas tienen?"),
      ia("Comedor de 8 sillas", "¿Qué comedores de 8 sillas tienen?"),
      ia("Comedor de madera", "¿Qué comedores de madera tienen?"),
      ia("Comedor con mesa de vidrio", "¿Qué comedores con mesa de vidrio tienen?"),
      ia("Comedor hasta S/ 1500", "Busco un comedor hasta S/ 1500"),
      ia("Sillas sueltas", "¿Venden sillas de comedor por separado?"),
      ia("Comedor más económico", "¿Cuál es el comedor más económico?"),
      fija("¿Qué medidas necesito para un comedor?", "Como guía: deja al menos 80 cm libres alrededor de la mesa para mover las sillas con comodidad. En la ficha de cada comedor ves sus medidas exactas para compararlas con tu espacio.", [cat("comedores", "Ver comedores")]),
    ],
  },
  {
    id: "recamaras",
    label: "🛏️ Recámaras",
    preguntas: [
      fija("¿Qué tienen para dormitorio?", "En Recámaras tenemos camas, cabeceras y cómodas para un descanso reparador.", [cat("recamaras", "Ver recámaras")]),
      ia("Busco una cama", "¿Qué camas tienen disponibles?"),
      ia("Cabeceras", "¿Tienen cabeceras?"),
      ia("Cómodas", "¿Qué cómodas tienen?"),
      ia("Cama de 2 plazas", "¿Tienen camas de 2 plazas?"),
      ia("Cama queen o king", "¿Tienen camas queen o king?"),
      ia("Cama hasta S/ 1500", "Busco una cama hasta S/ 1500"),
      ia("Juego de dormitorio completo", "¿Tienen juegos de dormitorio completos?"),
      fija("¿Incluyen el colchón?", "Eso depende del modelo: la ficha de cada cama indica qué incluye. Si no lo ves claro, pregúntame por la cama que te interesa y reviso su descripción.", [cat("recamaras", "Ver recámaras")]),
    ],
  },
  {
    id: "accesorios",
    label: "🪴 Accesorios",
    preguntas: [
      fija("¿Qué accesorios tienen?", "Mesas de centro, mesas laterales, puffs y bancos, y decoración para completar tu ambiente. También tenemos separadores de ambiente.", [cat("accesorios", "Ver accesorios"), cat("separadores", "Separadores")]),
      ia("Mesas de centro", "¿Qué mesas de centro tienen?"),
      ia("Mesas laterales", "¿Qué mesas laterales tienen?"),
      ia("Puffs y bancos", "¿Qué puffs y bancos tienen?"),
      ia("Decoración", "¿Qué artículos de decoración tienen?"),
      ia("Separadores de ambiente", "¿Qué separadores de ambiente tienen?"),
      ia("Biombos", "¿Tienen biombos?"),
      ia("Accesorios económicos", "¿Qué accesorios tienen por menos de S/ 300?"),
      ia("Ideas para completar mi sala", "Ya tengo un sofá, ¿qué accesorios me recomiendas para completar mi sala?"),
    ],
  },
  {
    id: "elegir",
    label: "🧭 Ayuda para elegir",
    preguntas: [
      fija("¿Cómo mido mi espacio?", "Mide el largo y ancho de la zona y también la altura. Anota los accesos (puerta, pasillo, escalera) para asegurarte de que el mueble entra. Compara esas medidas con las de la ficha del producto y deja espacio para circular.", [L.catalogo]),
      fija("Quiero amoblar mi departamento", "Te ayudo a armar el plan: dime tu presupuesto y qué ambientes necesitas (sala, comedor, dormitorio) y te propongo opciones del catálogo. También puedes mirar los muebles pensados para departamento y mini departamento.", [cat("muebles", "Para departamento", "departamento"), cat("muebles", "Mini departamento", "mini-departamento")]),
      ia("Tengo un presupuesto límite", "Tengo un presupuesto limitado, ¿qué me recomiendas?"),
      ia("Amoblar mi sala completa", "Quiero amoblar mi sala completa, ¿qué me recomiendas y cuánto costaría?"),
      ia("Muebles para espacios pequeños", "¿Qué muebles me recomiendas para un espacio pequeño?"),
      ia("Lo más vendido", "¿Cuáles son los productos más vendidos?"),
      ia("Ideas de regalo", "Busco un regalo para el hogar, ¿qué me recomiendas?"),
      ia("Me mudo, ¿qué necesito?", "Me voy a mudar, ¿qué muebles básicos me recomiendas?"),
      fija("¿Madera o vidrio para el comedor?", "La madera es más cálida y resistente a los roces del día a día; el vidrio da amplitud y luz, pero requiere más cuidado contra golpes y huellas. Puedes filtrar comedores por material.", [cat("comedores", "Comedores de madera"), cat("comedores", "Ver comedores")]),
      fija("¿Cómo elijo el tamaño del sofá?", "Deja unos 40 cm entre el sofá y la mesa de centro, y que la puerta y los pasillos permitan pasarlo. Mira las medidas de cada modelo en su ficha; si tu espacio es especial, podemos fabricarlo a medida.", [cat("muebles", "Muebles de sala", "sala"), L.medida]),
    ],
  },
  {
    id: "precios",
    label: "💳 Precios y pago",
    preguntas: [
      fija("¿Cómo puedo pagar?", "Aceptamos tarjetas de crédito y débito (Visa, Mastercard, Amex) mediante Niubiz, con pago 100% seguro y encriptado. Aún no manejamos pago contraentrega ni transferencia directa.", [L.checkout]),
      ia("¿Cuánto cuesta un sofá?", "¿Cuánto cuesta un sofá?"),
      ia("Productos en oferta", "¿Qué productos tienen en oferta?"),
      fija("¿Tienen cupones o descuentos?", "A veces lanzamos cupones y ofertas. Si tienes un código, ingrésalo al pagar en el checkout. Las ofertas y combos vigentes aparecen en el inicio de la tienda.", [{ label: "Ver ofertas", to: "/" }]),
      fija("¿Dan boleta o factura?", "Sí, emitimos comprobantes electrónicos. Si necesitas factura, deja tus datos de facturación (RUC y razón social) en tu perfil.", [L.facturacion]),
      fija("¿El precio incluye IGV?", "Los precios publicados son los vigentes al momento de tu compra y es lo que pagas en el checkout, junto con el costo de envío si es a domicilio.", [L.terminos]),
      fija("¿Es seguro pagar en la tienda?", "Sí. Los pagos con tarjeta se procesan a través de Niubiz (VisaNet Perú), una pasarela de pago segura.", [L.terminos]),
      fija("¿Puedo pagar contraentrega?", "Por ahora no: el pago se hace con tarjeta de crédito o débito al confirmar tu compra.", [L.checkout]),
      equipo("¿Puedo pagar en cuotas?"),
      equipo("¿Aceptan Yape, Plin o transferencia?"),
      fija("¿El precio puede cambiar después de comprar?", "No. Un cambio de precio posterior no afecta a los pedidos ya confirmados.", [L.terminos]),
      fija("Mi pago falló, ¿qué hago?", "Revisa que la tarjeta esté habilitada para compras por internet y que los datos sean correctos; también puedes probar con otra tarjeta. Si el cobro aparece en tu banco pero tu pedido no se confirma, escríbenos con tu número de pedido para revisarlo.", [L.pedidos, L.nosotros]),
    ],
  },
  {
    id: "comprar",
    label: "🛒 Cómo comprar",
    preguntas: [
      fija("Compra paso a paso", "1) Elige tu mueble en el catálogo. 2) Agrégalo al carrito. 3) Ve a pagar e inicia sesión. 4) Elige entrega a domicilio o recojo en tienda. 5) Paga con tarjeta. Después sigues el estado de tu pedido desde tu perfil.", [L.catalogo, L.checkout]),
      fija("¿Necesito cuenta para comprar?", "Puedes recorrer el catálogo y armar tu carrito libremente, pero para pagar necesitas iniciar sesión o crear tu cuenta. Así guardamos tu pedido y puedes seguirlo desde tu perfil.", [L.login]),
      fija("¿Cómo uso un cupón?", "En el checkout hay un campo para tu código de cupón: escríbelo y aplícalo antes de pagar.", [L.checkout]),
      ia("¿Puedes agregar un producto a mi carrito?", "Quiero que me ayudes a agregar un producto a mi carrito"),
      fija("¿Dónde veo mi carrito?", "Con el ícono del carrito arriba a la derecha de la tienda. Ahí puedes cambiar cantidades, quitar productos y pasar a pagar.", [L.checkout]),
      fija("¿Qué es 'a pedido' o 'en stock'?", "Los productos de fabricación se elaboran bajo pedido en nuestro taller; los de reventa se despachan de stock. Siempre te avisamos la fecha estimada antes de pagar.", [L.envios]),
      ia("¿Hay stock de este producto?", "¿Cómo sé si un producto tiene stock?"),
      fija("¿Puedo reservar sin pagar?", "Un pedido queda confirmado cuando recibimos el pago. Para consultas sobre reservas o separar una pieza, escríbenos y el equipo te orienta.", [L.nosotros]),
      fija("¿Puedo comprar varias unidades?", "Sí, puedes cambiar la cantidad en el carrito. Si es una compra grande o para un proyecto (hotel, oficina), pide una cotización.", [L.medida]),
      fija("¿Puedo ver el mueble antes de comprar?", "En cada ficha ves fotos, medidas y reseñas de clientes. Para ver nuestro trabajo, revisa Proyectos y Testimonios, o escríbenos si quieres más detalles.", [L.proyectos, L.testimonios]),
    ],
  },
  {
    id: "envios",
    label: "🚚 Envíos",
    preguntas: [
      fija("¿Cómo es el envío?", `Hacemos envío a domicilio en Lima y Callao: el costo depende de tu distrito y lo ves en el checkout antes de pagar (o pregúntame por tu distrito y te lo cotizo aquí). También puedes elegir "Recojo en tienda" sin costo, en ${ORIGEN_ENVIO}.`, [L.envios]),
      ia("¿Cuánto cuesta enviar a mi distrito?", "¿Cuánto cuesta el envío a mi distrito?"),
      fija("¿Cuánto demora la entrega?", `Cada pieza se fabrica a pedido. En Lima Metropolitana entregamos en ${ENTREGA_MIN_DIAS}–${ENTREGA_MAX_DIAS} días hábiles y en provincias en 10–15 días hábiles. La fecha exacta la coordinamos contigo al confirmar tu compra.`, [L.envios]),
      fija("¿Envían a provincias?", "Sí. En provincias el costo depende de la zona y del volumen del mueble; te damos un estimado y nuestro equipo lo confirma antes de despachar. Si me dices tu departamento, provincia y el mueble, te hago una estimación.", [L.envios]),
      ia("Envío a provincia: estimar costo", "Quiero estimar el envío de un mueble a provincia"),
      fija("¿Puedo recoger en tienda?", `Sí, sin costo de envío: elige "Recojo en tienda" al pagar (${ORIGEN_ENVIO}). Te avisamos cuando tu pedido esté listo para recoger.`, [L.envios]),
      fija("¿Cómo coordinan la entrega?", "Coordinamos contigo el día y el horario de entrega. Al recibir, revisa que la pieza esté completa y en buen estado, y avísanos de inmediato si notas algo.", [L.envios]),
      fija("¿Entregan en Callao?", "Sí, hacemos envío a domicilio en Lima y Callao; la tarifa depende del distrito. Dime tu distrito y te cotizo.", [L.envios]),
      fija("¿Qué pasa si no estoy en casa?", "Coordinamos el día y el horario contigo antes de la entrega. Si no puedes recibir, avísanos con anticipación para reprogramar.", [L.envios]),
      fija("¿Cómo funciona el envío a provincias?", "En provincias el pedido sale hacia la agencia de transporte y, cuando llega, lo ves como 'En agencia' en tu pedido. El plazo es de 10–15 días hábiles y el costo se estima según zona y volumen.", [L.envios, L.pedidos]),
      equipo("¿Entregan los fines de semana?"),
      equipo("¿Incluye armado e instalación?"),
      equipo("¿Se llevan mi mueble antiguo?"),
    ],
  },
  {
    id: "medida",
    label: "📐 A medida",
    preguntas: [
      fija("¿Hacen muebles a medida?", "Sí. Cuéntanos qué tipo de mueble necesitas, las medidas aproximadas y el espacio donde irá, y te preparamos una cotización.", [L.medida, L.proyectos]),
      fija("¿Cómo pido una cotización?", "Completa el formulario de muebles a medida en el inicio: tipo de mueble, medidas aproximadas y el espacio donde irá. El equipo te contacta con la cotización.", [L.medida]),
      fija("¿Cuánto demora uno a medida?", "El plazo se acuerda en la cotización y puede ser distinto al de los modelos del catálogo, según el diseño y el tamaño de la pieza.", [L.medida]),
      fija("¿Cuánto cuesta un mueble a medida?", "Depende del diseño, las medidas y los materiales; por eso se cotiza caso por caso. Cuéntanos tu idea y te damos un precio.", [L.medida]),
      fija("¿Puedo modificar un modelo del catálogo?", "Pide una cotización a medida indicando el modelo que te gusta y qué quieres cambiar (medidas, acabado, etc.); el equipo te dice qué es posible.", [L.medida]),
      fija("¿Qué información necesito dar?", "Tipo de mueble, medidas aproximadas (largo, ancho y alto), el espacio donde irá y, si tienes, fotos o referencias de lo que te gusta.", [L.medida]),
      fija("¿Cómo fabrican los muebles?", "Cada pieza se fabrica a pedido en nuestro taller de Lima: madera tornillo seca y tratada, acabado a mano y control de calidad antes del despacho. En la página del taller ves el proceso paso a paso.", [L.nosotros]),
      fija("¿Puedo ver trabajos anteriores?", "Claro: en Proyectos mostramos piezas especiales que fabricamos, y en Testimonios las opiniones y fotos de clientes.", [L.proyectos, L.testimonios]),
      equipo("¿Hacen muebles para negocios u oficinas?"),
      equipo("¿Puedo elegir color o tela?"),
      equipo("¿Piden adelanto para fabricar?"),
    ],
  },
  {
    id: "garantia",
    label: "🛡️ Garantía y cambios",
    preguntas: [
      fija("¿Qué garantía tienen?", "La estructura de tus muebles tiene 2 años de garantía contra defectos de fabricación. Si notas un defecto en ese periodo, lo reparamos o reponemos sin costo.", [L.terminos]),
      fija("¿Qué no cubre la garantía?", "No cubre daños por mal uso, golpes, humedad excesiva, modificaciones hechas por terceros ni el desgaste normal.", [L.terminos]),
      fija("¿Cómo uso la garantía?", "Escríbenos con fotos del problema y tu número de pedido, y lo revisamos.", [L.pedidos, L.nosotros]),
      fija("¿Puedo cambiar o devolver?", "Como son piezas fabricadas a pedido, no se aceptan cambios una vez confirmado el pedido. Si hay un defecto de fabricación, lo reparamos o reponemos sin costo dentro de la garantía.", [L.terminos]),
      fija("Mi mueble llegó dañado", "Lo sentimos. Revisa la pieza al recibirla y avísanos de inmediato con fotos y tu número de pedido; si es un defecto de fabricación o un daño en el transporte, lo revisamos para repararlo o reponerlo.", [L.nosotros, L.terminos]),
      fija("Llegó incompleto o con una pieza faltante", "Avísanos de inmediato con fotos y tu número de pedido para ubicar la pieza faltante.", [L.nosotros]),
      fija("Quiero hacer un reclamo", "Escríbenos con fotos del problema y tu número de pedido y lo revisamos. También tienes a tu disposición nuestro Libro de Reclamaciones virtual, que encuentras en los términos de la tienda.", [L.terminos]),
      fija("¿La garantía cubre la tela o el acabado?", "La garantía publicada cubre la estructura contra defectos de fabricación. Para casos de tela o acabado, escríbenos con fotos y lo evaluamos.", [L.terminos, L.nosotros]),
      fija("¿Cuánto dura la garantía?", "2 años en la estructura, contados desde tu compra.", [L.terminos]),
      fija("¿Dónde veo los términos y condiciones?", "En la página de Términos de la tienda: precios, pagos, entrega, cambios, garantía y Libro de Reclamaciones.", [L.terminos, L.privacidad]),
    ],
  },
  {
    id: "pedidos",
    label: "📦 Mi pedido",
    preguntas: [
      ia("Consultar mi pedido", "Quiero consultar el estado de mi pedido"),
      ia("¿Dónde está mi pedido?", "¿Dónde está mi pedido?"),
      ia("¿Cuándo llega mi pedido?", "¿Cuándo llega mi pedido?"),
      ia("Ver todos mis pedidos", "Muéstrame mis últimos pedidos"),
      ia("¿Qué compré?", "¿Qué productos tiene mi último pedido?"),
      ia("¿Cuánto pagué?", "¿Cuánto pagué en mi último pedido?"),
      ia("¿Ya se confirmó mi pago?", "¿Ya se confirmó el pago de mi último pedido?"),
      fija("¿Qué significan los estados?", "Tu pedido pasa por: pago recibido, en producción, control de calidad, listo para despacho, en camino y entregado (en provincias, además, 'en agencia'). Los ves en tu perfil después de pagar.", [L.pedidos]),
      fija("¿Puedo modificar o cancelar?", "Al ser piezas fabricadas a pedido, no se aceptan cambios una vez confirmado el pedido (queda confirmado cuando recibimos el pago). Si tienes una urgencia, escríbenos cuanto antes y vemos qué se puede hacer.", [L.pedidos, L.nosotros]),
      fija("¿Dónde descargo mi comprobante?", "Desde tu perfil, en Mis pedidos, cuando tu pedido ya fue pagado.", [L.pedidos]),
      fija("Dejar una reseña de mi compra", "Cuando tu pedido esté entregado, en Mis pedidos puedes dejar tu reseña (también con fotos de tu mueble).", [L.pedidos]),
      fija("Cambiar la dirección de entrega", "Escríbenos lo antes posible con tu número de pedido para ver si aún podemos cambiarla antes del despacho.", [L.pedidos, L.nosotros]),
    ],
  },
  {
    id: "cuidado",
    label: "🧼 Cuidado y uso",
    preguntas: [
      fija("¿Cómo limpio mis muebles de madera?", "Usa un paño suave y seco, o apenas húmedo, y sécalo enseguida. Evita químicos abrasivos, que pueden dañar el acabado. (Recomendación general de cuidado.)"),
      fija("¿Cómo evito que se dañe la madera?", "Evita la humedad excesiva y el sol directo prolongado, usa posavasos y no arrastres el mueble. Recuerda que la garantía no cubre daños por humedad excesiva o golpes."),
      fija("¿Cómo cuido el vidrio de la mesa?", "Límpialo con un paño suave y limpiavidrios, evita golpes en los bordes y no coloques objetos muy calientes directamente sobre él. (Recomendación general.)"),
      fija("¿Cómo limpio el sofá o tapiz?", "Aspira el polvo con regularidad y limpia las manchas de inmediato con un paño apenas húmedo, sin frotar fuerte. Para telas especiales, sigue las indicaciones de la ficha o consúltanos. (Recomendación general.)", [L.nosotros]),
      fija("¿Se pueden reparar los muebles?", "Si tu mueble tiene un daño o desgaste, escríbenos con fotos y te orientamos sobre la reparación.", [L.nosotros]),
      fija("¿Qué madera usan?", "Madera tornillo seca y tratada, trabajada con acabado a mano.", [L.nosotros]),
    ],
  },
  {
    id: "cuenta",
    label: "👤 Mi cuenta",
    preguntas: [
      fija("Iniciar sesión o crear cuenta", "Puedes iniciar sesión o crear tu cuenta desde el botón de la tienda. Con tu cuenta guardas direcciones, favoritos y ves tus pedidos.", [L.login]),
      fija("Guardar mis direcciones", "En tu perfil, sección Direcciones, puedes guardar y editar tus direcciones de entrega.", [L.direcciones]),
      fija("Mis favoritos", "Los productos que marcas con el corazón quedan guardados en tu perfil, en Favoritos.", [L.favoritos]),
      fija("Cambiar mi contraseña", "Puedes cambiarla desde tu perfil, en la sección Seguridad.", [L.seguridad]),
      fija("Cambiar mis datos personales", "En tu perfil, sección Datos, puedes actualizar tu nombre y datos de contacto.", [{ label: "Mis datos", to: "/perfil/datos" }]),
      fija("Datos de facturación", "Guarda tu RUC y razón social en Facturación, dentro de tu perfil, para pedir factura.", [L.facturacion]),
      equipo("Olvidé mi contraseña"),
      fija("¿Qué hacen con mis datos?", "Usamos tus datos solo para gestionar tu compra y tu entrega. El detalle completo está en nuestra política de privacidad.", [L.privacidad]),
    ],
  },
  {
    id: "contacto",
    label: "💬 Contacto",
    preguntas: [
      fija("¿Cómo los contacto?", "Puedes escribirme aquí, escribirnos por WhatsApp (botón en la página del taller y en la ficha de cada producto) o dejar tu consulta en el formulario de muebles a medida.", [L.nosotros, L.medida]),
      fija("¿Dónde está su taller?", `Nuestro taller está en Lima y el recojo en tienda es en ${ORIGEN_ENVIO}. En la página del taller encuentras más datos y el botón de WhatsApp.`, [L.nosotros]),
      fija("Hablar con una persona", "Claro. Escríbenos por WhatsApp desde la página del taller y el equipo te responde. Si es por un mueble a medida, también puedes dejar tu cotización y te contactamos.", [L.nosotros, L.medida]),
      fija("¿Quiénes son G&M Mueblería?", "Somos una mueblería de Lima que fabrica cada pieza a pedido en su propio taller, con madera tornillo seca y tratada.", [L.nosotros, L.testimonios]),
      fija("¿Tienen opiniones de clientes?", "Sí, en Testimonios ves opiniones y fotos de clientes, y en cada producto las reseñas de quienes ya compraron.", [L.testimonios]),
      fija("Libro de Reclamaciones", "Tenemos Libro de Reclamaciones virtual, disponible en los términos de la tienda.", [L.terminos]),
      equipo("¿Cuál es su horario de atención?"),
      equipo("¿Puedo visitar la tienda o el taller?"),
    ],
  },
];
