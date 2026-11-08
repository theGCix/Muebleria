# MODULES — Módulos relevantes (Parte 3/8)

> Rutas por verificar en el repo; lo siguiente es la lista de lo que se debe inspeccionar, no hallazgos.

## Footer / Legal (T1)
- Componente de footer y layout raíz.
- Páginas legales: términos, privacidad, libro de reclamaciones (existencia por confirmar).
- Config de contacto/redes (¿constantes o tabla en Supabase?).

## Catálogo y detalle de producto (D1, D2, H1, H2)
- Ruta de detalle de producto y selectores de opciones (color, firmeza, patas, tapizado).
- Tarjetas de producto / listados (badges de stock).
- Hooks de TanStack Query de productos.

## Carrito y checkout (D2)
- Store del carrito (Zustand) y sus ítems: ¿persiste opciones elegidas?
- Creación de pedido (`POST /api/orders` / RPC) y tabla de ítems del pedido.

## Post-venta (D2)
- "Mis pedidos" (cliente).
- "Mis órdenes" / `v_mi_produccion` (carpintero; muestra BOM).

## Stock (H1)
- Stock por almacén/ubicación; diferenciación retail vs manufactura (backorder).

## Imágenes (H2)
- Cloudinary: URLs por producto; tabla de imágenes de producto.

---
> Nota: los hallazgos de D2 de abajo describen el estado ANTERIOR a las fases 2–4; quedaron superados (ver TASK_LOG.md y la sección de la Parte 4).

## Hallazgos verificados en el repo (commit 7cd97c0, 2026-11-04)

**T1 Footer/legal**
- `src/components/Footer.tsx`: columnas Empresa y Legal (Términos, Privacidad, Envíos, Libro de Reclamaciones), redes e © año. NO tiene: dirección, horarios, WhatsApp/teléfono, logos de pago.
- `src/config.ts`: `LIBRO_RECLAMACIONES_URL`, `EMPRESA {razonSocial, ruc, direccion, email}`, `REDES`, `WHATSAPP_NUMBER`; todo vacío en el repo, se llena por variables VITE_* en Render (valores no visibles desde el repo). Lo vacío no se muestra.
- `src/routes/privacidad.tsx` (123 líneas): borrador con aviso "revísalo con un abogado"; sección de derechos (Ley 29733) usa `EMPRESA.email`. `src/components/LegalPage.tsx` → `DatosEmpresa`.
- `src/routes/terminos.tsx`, `src/routes/envios.tsx`, `src/components/checkout/TerminosCheckout.tsx`.

**D1 Materiales**
- Los materiales/tapizados NO están por producto: son texto fijo por categoría en `src/lib/productProfiles.ts` (`resolveProfile` por categoría/nombre). Ej.: perfil `sala` → "Velvet importado + antifluida" (aplica a todo lo de categoría `muebles`).
- `ProductDetail.tsx` repite textos de materiales y cuidado ("Para el velvet…") por su cuenta (posible duplicado/inconsistencia con productProfiles).
- `products` tiene `material_base`, `subcategoria`, `categoria` (solo para filtrar), sin columnas de tapizado/opciones.

**D2 Opciones y pedidos**
- Firmeza y patas: listas fijas en `SignatureModules.tsx`; se guardan con `setPref` en `product.$handle.tsx`.
- Las opciones viajan SOLO como texto dentro de `title` del ítem: `"Nombre (Color, Firmeza, Patas)"`.
- `cartStore.ts`: ítem identificado solo por `id` de producto; al agregar el mismo producto con otra opción se suma `qty` y se pierde la segunda opción.
- Servidor (`server/pagos.js` `calcularPedido`): precio siempre de la BD; las opciones no alteran precio. `title` viene del navegador (`...it`).
- `order_items` guarda `title` e `image_url`, sin columna de opciones.
- Mis pedidos (`perfil/pedidos.tsx`) y carpintero (`OrdenCard.tsx`) muestran `title`. `PasosFabricacion.tsx` detecta tapizado con `title.includes("sofá"/"silla"/"sillon")`.

**H1 Stock**
- `ProductCard.tsx`: `UMBRAL_STOCK = 5`, con oferta `UMBRAL_STOCK_OFERTA = 10`.
- `product/LivePrice.tsx`: urgencia con `stock <= 5` ("Quedan N unidades listas").
- No existe campo "bajo pedido" en el front: todo el copy dice "fabricado a pedido".
- No hay seed/migración en el repo que fije stock=5; el valor vive en Supabase.

---
## Estado verificado — Parte 4/8 (commit 733413e + E6, 2026-11-05)

**Distrito y envío**
- Tarifario en CÓDIGO (no en BD): `DISTRITOS_ENVIO` en `src/lib/envios.ts` (mínimo S/ 60 al 2026-11-05). Solo por distrito, no por producto.
- Fuente única del distrito: `localStorage` `gm_distrito_envio` (`DISTRITO_STORAGE_KEY`, `src/lib/entrega.ts`), con el evento `gm:distrito-envio`; se usa vía `useDistritoEnvio()` en ficha (`DeliveryPromise`), tarjeta (`ProductCard`), carrito (`CartDrawer`) y checkout.
- Checkout (`src/routes/checkout.tsx`): `useCheckoutPrefill` + `DireccionesGuardadas` (dirección predeterminada); `ciudad` del pedido se deriva con `ciudadDeDistrito`; cabecera `CheckoutHeader`.

**Pago / Niubiz**
- `src/lib/niubiz.ts` y `VisanetCheckout.configure` en `checkout.tsx`: envía `name` (completo), `email` y datos de facturación; el servidor autoriza con `transactionToken` (API de Autorización).
- La doc de la API de Autorización (subida por el dueño) pide `cardHolder.firstName/lastName/email` para comercios que manejan la tarjeta; NO confirma los parámetros de `configure` del Botón de Pago Web.
- Su menú lista como integraciones aparte: Pago con Yape, Pago con QR, Pago con PLIN, API de PagoEfectivo (+ callback).
- Medios anunciados al cliente: `src/lib/mediosPago.ts` (6 medios con `habilitado: true`, confirmados por el dueño) + `components/checkout/MediosPago.tsx`; logos SVG propios en `public/pagos/` (visa, mastercard, amex, yape, plin, pagoefectivo, niubiz). El texto anterior sobre integraciones separadas de Niubiz queda como referencia: el dueño confirmó que están disponibles.

**Ficha de producto (`src/routes/product.$handle.tsx`)**
- Existentes: `ProductGallery`, pestañas Especificaciones / Reseñas / Entrega, `ProductRecomendaciones` (misma categoría, 4 productos), cotización (`LeadFormDialog`) y WhatsApp.
- `StickyBuyBar`: fija en móvil (≤ 640 px) y al hacer scroll en pantallas grandes; panel «Ir a pagar / Seguir comprando» tras agregar.
- No existen medidas por producto (alto/ancho/fondo), plazas ni esquema: solo `volumen_m3` y `peso_kg` (ver DATABASE.md).
**Chatbot (`src/components/AsistenteChat.tsx`)**
- Streaming SSE en `POST /api/chat/stream` (eventos `status`, `token`, `reset`, `done`, `error`); si responde 404 usa `POST /api/chat`. Corte por inactividad de 8 s, errores clasificados y tarjeta de respaldo (ver TASK_LOG, «Robustez del chatbot»).
- Servidor: `registerChat` en `server/chat.js` (LangChain + Ollama, `OLLAMA_TIMEOUT_MS` por defecto 60 s); `/health` en `server/index.js`.

**Proyectos y reacciones**
- `src/routes/proyectos.tsx` (grilla + detalle con fotos), `src/hooks/useProyectos.ts` (tabla `proyectos`, solo publicados), admin en `_authenticated/gestionar-proyectos.tsx` + `src/lib/proyectos.functions.ts`.
- Reacciones: `useReaccionesProyectos` + `components/proyectos/ReaccionesProyecto.tsx`; datos en `proyecto_reacciones` y vista `v_proyecto_reacciones_conteo` (ver DATABASE.md).

---
## Admin móvil (2026-11-05)

**Patrón de tablas del panel (`src/routes/_authenticated/`)**
- Las pantallas usan `<table>` propias (no `ui/table.tsx`). En < 640 px la tabla lleva `hidden sm:table` y, dentro del mismo contenedor, se renderiza `<TarjetasMovil>` con una `<TarjetaFila>` por fila (`src/components/admin/TarjetaFila.tsx`). Para tablas nuevas, reutilizar ese par y `BTN_TACTIL`.
- `TarjetaFila`: `titulo`, `subtitulo`, `estado` (insignia), `imagen`, `datos` (`{etiqueta, valor, destacado?, completo?}`), `acciones` y `tono` (`normal` | `alerta` | `peligro`).
- `Button` mide 32–36 px (`sm` = `h-8`, `default` = `h-9`): en táctil pasar `className="h-11 min-w-11"`; `cn` (tailwind-merge) deja ganar la última clase.
- `useIsMobile` corta en 768 px; las tarjetas usan el breakpoint CSS `sm` (640 px) a propósito.

**Insumos (`insumos.tsx`)**
- `fmt` ahora es `formatoCantidad` de `src/lib/cantidades.ts` (enteros: unidades, planchas, piezas, paquetes, palos, bolsas; 1 decimal: metros, kg, litros, pies; otras: 2). El faltante usa `formatoFaltante`.
- `MovimientoDialog` e `InsumoDialog` aceptan `triggerClassName`.

**Ficha de producto — D7**
- `src/lib/piezas.ts` + `src/components/product/MedidasPiezas.tsx`: lectura de `products.piezas` y `products.esquema_url` (la nota anterior «no existen medidas» quedó superada en el front; faltan los datos y el editor).

**Admin móvil — ampliación (2026-11-07)**
- Además de las 7 pantallas iniciales, usan `TarjetasMovil`/`TarjetaFila`: `cupones`, `despachos`, `devoluciones`, `proveedores`, `produccion`, `caja` (`MovTable` e historial) y `correos-pedidos` (con `ui/table`, `className="hidden sm:table"`).
- Funciones locales compartidas por tabla y tarjeta: `editarCupon` (cupones), `datosDespacho` + `vacioDespachos` (despachos), `datosDevolucion` (devoluciones). Los botones de la tarjeta se agrandan con `[&_button]:h-11 [&_a]:h-11` sin tocar el JSX de la tabla.
- `src/lib/cantidades.ts` suma `limitarDecimales(texto, unidad)` para campos de entrada; `MovimientoDialog` acepta `unidad`.
- `src/components/produccion/MaterialesLista.tsx` formatea con `formatoCantidad`.

**Insumos MRP — estado de stock y calculadora (2026-11-08)**
- `src/lib/cantidades.ts`: `estadoStock(stock, mínimo)` → `sin_stock | insuficiente | suficiente | sin_minimo`; `faltaStock(estado)`; `ordenarPorUrgencia(lista)`.
- `insumos.tsx`: `ESTADO_STOCK` (etiqueta y clases por estado) alimenta la columna «Estado» de la tabla y la insignia de las tarjetas; `filtrados` se ordena con `ordenarPorUrgencia`.
- `FilaModelo`: controles de 44 px, piezas en una columna en móvil, resumen «Por juego …» con total de piezas.
