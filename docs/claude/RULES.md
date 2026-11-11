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
