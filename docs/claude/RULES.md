# RULES — Reglas de trabajo

1. Consultar archivos reales antes de proponer cambios.
2. Rutas verificadas y lectura selectiva; no analizar todo el repo.
3. Cambios mínimos, reversibles, **sin dependencias nuevas**.
4. Conservar diseño: nogal, dorado, teal.
5. No inventar datos legales, comerciales ni técnicos; preguntar si faltan.
6. Entregar archivos modificados por separado (ruta completa).
7. Texto legal definitivo requiere aprobación del dueño.
8. Esperar autorización antes de implementar.
9. Primera respuesta de cada parte: plan, archivos a inspeccionar, dudas, dependencias (sin código).
10. Reglas previas vigentes: no cambiar IGV/series/numeración sin mostrar fórmula; no aplicar cambios de RLS sin confirmación.
11. Entrega de archivos: individuales con ruta de proyecto. Solo se usa .zip si el dueño lo pide en ese mensaje.
12. Al subir: `git add` explícito de los archivos NUEVOS y revisar `git status`. (La Fase 3 rompió el build de Render porque faltaron dos archivos nuevos.)
13. Antes de entregar: `tsc --noEmit` (ignorar los errores preexistentes de `src/integrations/supabase/types.ts`, que está en UTF-16) y `vite build`. Para el servidor: `node --test server/pagos.test.js`.
14. UX móvil (360–414 px): controles táctiles ≥ 44 px y contraste ≥ 4.5:1.
15. Niubiz: no asumir parámetros del SDK ni medios habilitados; pedir la documentación o confirmación. No anunciar medios de pago que el cobro no ofrezca. Medios confirmados por el dueño (2026-11-05): tarjetas, Yape, Plin y PagoEfectivo (`src/lib/mediosPago.ts`).
16. Entrega de código como patch (`git apply`). Los archivos NUEVOS (p. ej. `public/pagos/*.svg`) van dentro del patch; revisar `git status` antes del commit.

## Reglas de negocio (H1)
- Urgencia de stock solo si stock ≤ 3.
- Muebles bajo pedido: mostrar "Fabricación bajo pedido".
- **Precio con opciones:** el servidor es la única fuente (`server/pagos.js`). Precio = (lista + suma de `ajuste_precio`) con la oferta aplicada al total (decisión del dueño). No tocar `pagos.js` ni `pagos.test.js` (23 pruebas) sin mostrar la fórmula. Un commit "fix" (385fc16) la revirtió por error y se restauró en 494dc69.

## Reglas de negocio (Parte 4)
- **Distrito de envío:** una sola fuente (`useDistritoEnvio`). En el checkout manda el distrito elegido en la ficha sobre la dirección predeterminada (decisión del dueño); sin distrito nunca se asume uno.
- **«Envío desde S/ X»:** sale del mínimo vigente del tarifario (`precioEnvioDesde()` en `src/lib/envios.ts`), nunca de un monto fijo en el código.
- **`ciudad` del pedido:** se deriva del distrito (`ciudadDeDistrito`: Callao o Lima); el cliente ya no la escribe.


## Reglas de negocio (Admin móvil)
- **Tablas del panel en móvil (< 640 px):** tarjetas apiladas con nombre, estado, total/stock y la acción principal; controles táctiles ≥ 44 px (`BTN_TACTIL`). No se cambian consultas, mutaciones ni permisos al adaptar una pantalla.
- **Cantidades de insumos (solo visualización):** enteros para unidades, planchas, piezas, paquetes, palos y bolsas; máximo 1 decimal para metros, kg, litros y pies; otra unidad conserva hasta 2 decimales. Se formatea con `src/lib/cantidades.ts`, nunca con `toFixed` suelto. Lo ya guardado en la BD no se redondea. En campos de entrada (Movimiento de stock, Stock mínimo) `limitarDecimales(texto, unidad)` recorta lo que se escribe a esos mismos decimales.
- **Botones de cabecera del panel en móvil:** `h-11 sm:h-9` (o `sm:h-8` si son `size="sm"`), solo clases.
- **Estado de stock de insumos:** rojo si stock ≤ 0 («Sin stock») o stock < mínimo («Insuficiente»); verde si stock ≥ mínimo (mínimo > 0); gris «Sin mínimo» si hay stock pero no hay mínimo. Los faltantes van primero. Se calcula con `estadoStock` (`src/lib/cantidades.ts`), nunca comparando a mano.
- **Calculadora MRP:** los controles + / − miden ≥ 44 px; «Juegos» es entero (mínimo 1); no se cambian las fórmulas de `calcularMrp`.
- **Fabricar insumos:** siempre por `fabricar_mrp` (transacción única, idempotente por `order_number`); nunca volver a insertar `orders` / `produccion` / `insumo_movimientos` suelto desde el cliente. No se permite fabricar si el stock actual no alcanza: así el movimiento coincide con el descuento real (el trigger recorta en 0).
- **Estados de carga en modales:** skeleton con la misma estructura y medidas que el contenido final, no texto «Cargando…» ni spinner centrado.
- **Definiciones de métricas (no redefinir por pantalla):** *sesión única* = `DISTINCT session_id` de `eventos_web` (por sesión de navegador, no por persona; visitas, páginas vistas y sesiones NO son lo mismo). *Pedido online pagado* = `orders.status NOT IN ('pendiente','cancelado')` y `notas` sin prefijo «[MRP]» (órdenes internas de fabricación). *Conversión web* = pedidos pagados ÷ sesiones únicas × 100; con 0 sesiones se muestra «—», nunca 0.00%. Los días se cortan en hora de Lima (America/Lima) en las tres funciones `get_*`.
- **Una métrica clave por pantalla:** Dashboard = Ingresos totales; Analytics = Conversión web; Central = Órdenes en producción. El resto es complementario y no se duplica entre pantallas.
- **Estado actual vs histórico:** un número que describe cómo está el negocio *ahora* (órdenes activas, pipeline, alertas, caja abierta) no depende del período y se rotula «estado actual»; un número que se mide en un lapso (ingresos, conversión, terminadas, tiempo de producción) depende del período compartido y lo muestra. Órdenes activas = producción no terminada + control de calidad + listo despacho (`enviado` = «En ruta», aparte). Las terminadas se cuentan por `fecha_fin_real`.
- **Período compartido:** Dashboard, Analytics y Central usan `usePeriodo(..., { compartido: "analisis" })`; no volver a crear estados de período propios en esas tres pantallas. Los rangos se calculan con la hora de Lima (`hoyLima`).
- **Caja:** el sistema solo avisa (> 24 h abierta; recordatorio a las 21:00 Lima), nunca cierra una caja. Un error al cargar la caja no se trata como «no hay caja abierta».
- **Recuperar carritos:** nunca inventar teléfonos ni correos (se valida con `whatsappLink` y `esCorreoValido`); abrir WhatsApp/correo no marca el carrito: solo «Sí, marcar como contactado». Un cupón por carrito (`cupon_recuperacion_carrito`, solo admin, 5 % / 48 h, mismo código que n8n); si venció o se usó no se crea otro. Un aviso automático cuenta como enviado solo si `recordatorio_enviado = true`. El estado de `carritos` se cambia con `cambiar_estado_carrito` (no hay política UPDATE).
- **Filtros de listas mezcladas (local + online):** filtrar por una vigencia común (`esAnulada`), no por el texto de estado de un solo canal; cada filtro con etiqueta visible.

## Reglas visuales (Parte 7.1)
- **Naranja en texto:** nunca `text-accent` ni `/80` sobre texto: usar `text-accent-strong` (mismo tono 45, `oklch(0.52 0.14 45)`; 5.6:1 sobre el fondo, 4.75:1 sobre `secondary`). Etiquetas naranjas con texto claro: `bg-accent-strong text-accent-foreground`. `--accent` queda para fondos, bordes y hovers sin texto.
- **`--gradient-warm`:** el extremo naranja usa el mismo valor oscuro para que el texto claro sobre el degradado cumpla 4.5:1.
- **Fotos:** `cloudinaryUrl(id, { w, h })` recorta con `c_fill,g_auto` (antes w+h estiraba la imagen). Fotos de clientes: `liviana(url, w, h)`. Tarjetas de producto, categoría y reseña en 4:3; galería de clientes cuadrada.
- **Barra de promoción del header:** se oculta al bajar > 80 px y vuelve al llegar a < 24 px (`top-0` ↔ `-top-8`, sin cambiar la altura del header).

## Reglas visuales (Parte 7.3)
- **Tamaño mínimo de texto en la tienda pública: 12 px** (`text-xs` o `font-size: 12px`); nunca `text-[9–11px]`. Aplica a ficha, tarjetas, carrito, checkout y páginas públicas; el admin queda aparte.
- **Plazos de entrega:** una sola fuente, `src/lib/entrega.ts` (`textoPlazoLima()`, `textoPlazoProvincias()`); no escribir «5–7 días» a mano. «Tiempos de entrega» vive solo en la tarjeta `DeliveryPromise`.
- **Distrito:** se elige con `DistritoCombobox` (ficha y checkout); la búsqueda ignora tildes y mayúsculas (`lib/buscarDistrito.ts`).
- **Favoritos:** el aviso sale con `avisoFavorito()` (abajo, con «Deshacer»); «Deshacer» usa `addToWishlist` / `removeFromWishlist`, nunca `toggleWishlist` (usaría un estado viejo).
- **Moneda:** el monto se muestra con «S/»; no se escribe «PEN» como texto.
- **Pestañas con desplazamiento horizontal:** llevan indicador (degradado + flecha) visible solo si hay contenido oculto.

## Reglas de seguimiento y accesibilidad (Parte 7.5)
- **Embudo GA4/Meta:** cada paso se dispara desde un único lugar (`view_item` ficha, `add_to_cart` `cartStore`, `view_cart` `CartDrawer`, `begin_checkout` y `add_shipping_info` checkout, `add_payment_info` `handlePagar`, `purchase` con dedupe por pedido). Nunca reenviar un paso desde un segundo punto; si solo hay que registrarlo en `eventos_web`, usar `trackEvent({ ..., solo_bd: true })`.
- **`carrito_iniciado`:** una vez por sesión, desde `cartStore`, con `solo_bd` (el `add_to_cart` de GA4/Meta ya sale de `trackAddToCart`).
- **Menú de categorías:** debe poder operarse con teclado (patrón del `CategoryMegaMenu`); todo control interactivo nuevo del sitio público lleva `focus-visible` visible, nunca `outline-none` sin reemplazo.
- **`alt`:** imagen de contenido = descripción de lo que se ve; decorativa o dentro de un botón con `aria-label` = `alt=""`. Fotos del taller: `alt` por foto en `lib/taller.ts`.
- **Terceros bajo demanda:** mapas y video del taller no cargan hasta que el cliente los pide (sin scripts de Google/YouTube al abrir la página).

## Reglas del panel (Parte 8.1)
- **Campos de mes:** usar siempre `CAMPO_MES` (`components/admin/TarjetaFila.tsx`); nunca un ancho fijo (`w-[170px]`, `w-40`): el control nativo recorta el ícono.
- **Menú lateral:** el filtro vive en `lib/buscarMenu.ts` y se aplica sobre `canSee`; las opciones se definen solo en `nav-config`. El filtro no escribe en `localStorage` ni cambia el estado de los grupos plegados.

## Reglas de boletas y compartir (Parte 8.2)
- **Compartir comprobantes:** siempre con `armarMensajeComprobante` (`lib/compartirComprobante.ts`); nunca armar el mensaje a mano ni crear enlaces públicos propios (un correlativo `B001-…` es adivinable). Solo se incluye el enlace de Nubefact si el comprobante está aceptado por SUNAT, no anulado y es `https`. No incluir DNI, dirección ni teléfono del cliente en el mensaje.
- **Boletas en móvil:** ítems con `ItemsBoleta` (tarjetas < 640 px); el HTML de `comprobante-pdf.ts` no debe fijar anchos en cm fuera de `@media print`.
- **Filtros en chips:** usar `FiltrosEstado` (una fila con scroll horizontal), no `flex-wrap`.
- **Variables de Vite:** en el navegador solo existen las `VITE_*` (por eso el RUC del emisor es `VITE_SUNAT_RUC`).
