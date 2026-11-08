# TASK_LOG

## 2026-11-04 — Parte 3/8: Confianza, legal y contenido
- Estado: **Plan entregado, esperando autorización.** Sin código ni cambios en el repo.
- Tareas: T1, D1, D2, H1, H2 (ver PROJECT.md).
- Dependencias: D1 → D2 → H1; H2 independiente; T1 bloqueada por datos del negocio.
- Pendiente: autorización del dueño y datos legales/comerciales.

## 2026-11-04 — Inspección (autorizada: "empecemos")
- Repo clonado en modo lectura; sin cambios al código.
- Inspeccionados: T1 (completo), D1, D2 (hasta Mis pedidos/carpintero), H1 (UI). Pendiente: H2 (requiere ver imágenes) y datos reales de Supabase.
- Hallazgos en MODULES.md.

## 2026-11-04 — Implementación T1 + H1 (autorizada)
- Datos del dueño: Av. Gerardo Unger 5427; lun-dom 10:00-20:00; WhatsApp 922629024; sin redes; correo ARCO = Gmail del negocio; pagos: débito, crédito, efectivo, transferencia, Yape, Plin.
- Pendientes T1: razón social legal, RUC, URL Libro de Reclamaciones (Indecopi).
- Archivos modificados: src/config.ts, src/components/Footer.tsx, src/components/ProductCard.tsx, src/components/product/LivePrice.tsx.
- H1: urgencia solo con stock ≤3 (tarjeta y ficha). "Fabricación bajo pedido" pospuesto hasta que el dueño defina qué productos lo son (mesas de centro, a confirmar).
- D1/D2: dueño eligió opción "completo" (tablas de opciones por producto). Propuesta de diseño pendiente.
- tsc: sin errores en archivos modificados; src/integrations/supabase/types.ts está en UTF-16 (preexistente).

## 2026-11-04 — D1/D2 fase 1 preparada
- Decisiones: precio por opción; firmeza/patas preseleccionadas; combos con predeterminadas.
- Entregado: migración 20261104_opciones_producto.sql (+ rollback y verificación). Pendiente: aprobación del dueño y ejecución en Supabase.
- Siguiente: fase 2 (servidor: validación, precio, copia de opciones, title generado en el servidor).

## 2026-11-05 — D1/D2 fases 2 a 4 (opciones por producto)
- Fase 2 (servidor: validación, precio, snapshot, título) en 622bf2b. Fase 3 (carrito por `lineId`, ficha con opciones de BD y respaldo) en 1a4cc08; sus archivos nuevos faltaron y se subieron en 6f10656 y 75d203f.
- Incidente: el commit "fix" (385fc16) devolvió `pagos.js` a la regla antigua (oferta antes del ajuste) y borró un test. Restaurado en 494dc69; 23 pruebas OK.
- Fase 4 (494dc69): Mis pedidos, admin `pedidos.tsx`, `OrdenCard` y `PasosFabricacion` muestran las opciones (`src/lib/opcionesPedido.ts`, `src/components/OpcionesPedido.tsx`). `v_mi_produccion` NO necesitó cambios: el carpintero lee `order_items.opciones` directo.
- Fase 5 (editor de opciones en el admin + datos reales con plantilla CSV): sin verificar en el repo.

## 2026-11-05 — Parte 4/8: Checkout y detalle de producto
- Plan entregado y aprobado ("si"). Decisiones del dueño: en el checkout manda el distrito de la ficha; «Envío desde» sale del mínimo vigente del tarifario.
- **Entrega A (4ccfac7):** `src/hooks/useDistritoEnvio.ts` (fuente única), `guardarDistrito` y `DISTRITO_EVENT` en `src/lib/entrega.ts`, `distritoDeTarifa`/`precioEnvioDesde`/`ciudadDeDistrito` en `src/lib/envios.ts`, `src/components/checkout/CheckoutHeader.tsx`; «Ciudad» eliminada del checkout; campos a 44 px. Tocó `DeliveryPromise.tsx`, `ProductCard.tsx`, `useCheckoutPrefill.ts`, `checkout.tsx`.
- **Entrega B (733413e):** `CartDrawer.tsx` (nombre completo, sin SKU, envío estimado, «Vaciar» con confirmación), `StickyBuyBar.tsx` (fija en móvil; exporta `SeguirComprandoLink`), panel posterior a agregar en `product.$handle.tsx`, color único como texto (también en `OpcionesProducto.tsx`), `AsistenteChat.tsx` sube sobre la barra en `/product/`.
- **E6 (commit 9b0601b; luego ajustado, ver última entrada):** `src/lib/mediosPago.ts` (lista con `habilitado`), `src/components/checkout/MediosPago.tsx` (logo con respaldo de texto), `public/pagos/LEEME.txt`, cambios en `checkout.tsx`. Hoy solo tarjetas (Visa, Mastercard, Amex) y sello Niubiz. Se retiró el logo que se cargaba desde el host de pruebas de Niubiz (`static-content-qas`). Yape, Plin y PagoEfectivo quedan `habilitado: false`: en la documentación de Niubiz son integraciones aparte y el cobro actual (Botón de Pago Web) es solo con tarjeta.
- **Pendientes:**
  - Logos oficiales en `public/pagos/` (visa, mastercard, amex, niubiz).
  - Dueño: qué medios tiene contratados con Niubiz y si quiere integrar Yape/Plin/PagoEfectivo (cada uno es un flujo nuevo).
  - N2: falta la página «Botón de Pago Web» de Niubiz (¿`configure` acepta apellido?). Hoy se envía `name` completo y `email`.
  - D7: migración propuesta (`products`: `alto_cm`, `ancho_cm`, `fondo_cm`, `plazas`, `esquema_url`, todas opcionales) y definir cómo se cargan; confirmar si las tallas son productos distintos.

## 2026-11-05 — E6 ajustado (decisión del dueño)
- El dueño indicó que Yape, Plin y PagoEfectivo **sí están disponibles** en el cobro (junto a las tarjetas) y pidió que los logos los genere Claude en SVG.
- `src/lib/mediosPago.ts`: Yape, Plin y PagoEfectivo pasan a `habilitado: true` (el bloque «También puedes pagar con» del checkout ya se muestra solo).
- Logos nuevos en `public/pagos/` (simplificados, no oficiales): `visa`, `mastercard`, `amex`, `yape`, `plin`, `pagoefectivo`, `niubiz` (.svg) + `LEEME.txt`. El `public/pagos/` anterior nunca se subió al repo (faltaba en el commit 9b0601b): ahora va en el patch.
- Pendiente: reemplazar por logos oficiales si el dueño los consigue (mismo nombre de archivo). La nota previa de «cobro solo con tarjeta» queda superada por esta confirmación.

## 2026-11-05 — Catálogo en móvil (plan aprobado: «aprobado», «Comprar ahora»)
- Retomado desde cero: la sesión anterior solo dejó el plan; el código no se había guardado.
- **Grillas a 2 columnas en móvil** (`gap-3`, `sm:gap-6`; `sm`/`md`/`lg` sin cambios): `catalogo.tsx`, `categoria.$slug.tsx`, `ProductsSection.tsx`, `OfertasSection.tsx`. La `PiezaDestacada` y su esqueleto ocupan las 2 columnas en móvil (`col-span-2`).
- **`ProductCard.tsx`** (solo clases `@container`, sin media queries nuevas): tarjeta estrecha (< 13rem) con relleno menor, nombre `text-sm`, sin descripción ni chips, sin «Ahorras» (queda la insignia −%), envío reducido a «Llega …». Estrellas y datos de reseñas sin cambios (siguen saliendo de `useProductRating`; nada inventado).
- **Compra rápida:** botón «Comprar ahora» («Comprar» en tarjeta estrecha, `aria-label` completo). Agrega con el mismo `addItem` si aún no está en el carrito y va a `/checkout` igual que «Ir a pagar». Oculto si está agotado.
- **Táctil ≥ 44 px:** corazón (círculo visible de 32 px dentro de un área de 44 px), botones ±, «Agregar», «Comprar» y «Cotiza a medida».
- Contraste: `muted-foreground` sobre `card` = 5.7:1 (≥ 4.5).
- Verificación: `tsc --noEmit` sin errores nuevos; `vite build` OK; capturas a 360 y 414 px con datos de prueba: 2 columnas, sin scroll horizontal, 0 botones < 44 px; «Comprar ahora» deja el producto en `gm-cart` y navega a `/checkout`.
- Pendientes / notas: la tarjeta sigue usando `id` (no `lineId`) para cantidad/quitar; correcto mientras la tarjeta agregue sin opciones. Verificar en un celular real y con datos reales.

## 2026-11-05 — Parte 5: K2 (filtros) y K3 (productos) del catálogo — plan
- Estado: **Plan entregado, esperando autorización.** Sin código ni cambios en el repo (solo esta entrada).
- Inspeccionados (solo lectura): `catalogo.tsx`, `categoria.$slug.tsx`, `ProductCard.tsx`, `categories.ts`, `useProducts.ts`, `AsistenteChat.tsx`, `ExitCouponDialog.tsx`, `Header.tsx`, `MobileBottomBar.tsx`, `CategoryMobileAccordion.tsx`, `CategoryMegaMenu.tsx`.
- Hallazgos: filtros siempre visibles y `FilterChip` duplicado en las dos rutas; chips ~32 px (< 44 px); `ProductCard` muestra `categoria`, `subcategoria` y `material_base` crudos (slugs) aunque `categories.ts` ya tiene las etiquetas; no existe campo de nombre comercial en `products`; `MobileBottomBar` es solo del panel interno (no aplica al catálogo público); en público compiten por la esquina inferior el botón del chat (`bottom-6 right-6`, z-50) y la pastilla del cupón (`bottom-20 left-3`, z-30).
- Pendiente: autorización del dueño; definir «nombres comerciales» y qué se entiende por «categorías duplicadas».

## 2026-11-05 — Ofertas: carrusel responsive (plan aprobado: «aplica todo para móvil y pc … hazlo a tu criterio»)
- Antes: `OfertasSection.tsx` era una grilla (2/3/4 columnas) con «Ver las N ofertas restantes»; no había carrusel de ofertas.
- Ahora: carrusel con `ui/carousel.tsx` (Embla, ya en `package.json`; **sin dependencias nuevas**) en móvil y escritorio. Tarjetas por vista: 2 (móvil, `basis-[46%]`), 3 (≥ sm), 4 (≥ lg); `slidesToScroll: "auto"` avanza una página completa. Se muestran las 24 ofertas de `useOfertas(24)`; se eliminó el botón «Ver restantes».
- Uniformidad: las diapositivas se estiran a la misma altura (flex) y el bloque de precio/acciones de `ProductCard` queda abajo (`mt-auto`). `ProductCard.tsx` y `product-card.css` NO se tocaron.
- Indicadores: flechas ‹ › + puntos (≤ 4 páginas) o contador «3 / 12» con barra de avance (más páginas). Todo ≥ 44 px, activo en `primary`, inactivo `muted-foreground/70` (los puntos de `HeroSlider` son blancos de 10 px y no sirven sobre fondo claro). Textos en español y `aria-current`.
- Al cambiar de chip de categoría el carrusel vuelve a la primera página (`key` en `Carousel`). `py-3` en el contenido para que el viewport (overflow) no recorte la sombra/inclinación 3D de `.gmc-card`.
- Sin autoplay (decisión de criterio: son ofertas que el cliente compara; no se mueven solas).
- Verificación: solo sintaxis TSX (el zip no trae `node_modules` y no hay red). **Pendiente:** `tsc --noEmit`, `vite build` y prueba a 360/414/768/1280 px con datos reales (arrastre sin disparar el enlace, cambio de chip, flechas, teclado).
- Pendiente aparte (Parte 5/K2): los chips de categoría de esta sección siguen en ~32 px de alto (< 44 px).

## 2026-11-05 — Robustez del chatbot (continuación)
- Retomado desde un chat anterior cuyo trabajo no llegó al repo (solo se conservó el guion de pruebas); se reimplementó según ese guion. Si existía un plan aprobado con más puntos, falta contrastarlo.
- `src/components/AsistenteChat.tsx` (único archivo de código tocado; servidor sin cambios):
  - Corte a los **8 s sin ningún evento** del servidor (`SIN_EVENTOS_MS`); cada evento/bytes reinicia el reloj, así una respuesta lenta pero viva no se corta.
  - Errores clasificados (`ChatError`): `timeout`, `servidor` (503, usa el texto `error` del servidor), `limite` (429) y `sin_red`.
  - Tarjeta de respaldo (`role="alert"`): mensaje, «Reintentar» (reenvía sin duplicar el mensaje del cliente), «Escribir por WhatsApp» y «Mientras tanto» (catálogo, envíos). Botones ≥ 44 px.
  - Esqueleto de carga mientras llega el primer evento; ping a `/health` una vez al abrir el chat (despierta Render).
  - Modo sin streaming (`/api/chat`) ahora también clasifica errores y corta a los 30 s.
- Verificado con servidor simulado + Playwright (390 px): colgado → respaldo a 8,4 s; reintentar OK; 503; 429; sin red; respuesta viva de 15 s sin corte.
- Sin probar: contra el backend real (LangChain + Ollama) ni `node --test server/chat*.test.js` (no se tocó el servidor).

## 2026-11-05 — Reacciones en Proyectos (plan aprobado)
- Decisiones del dueño: **solo con sesión**; **varios tipos** de reacción; contador **visible desde la primera reacción**.
- Tipos: `me_gusta` 👍, `me_encanta` ❤️, `impresionante` 😮, `lo_quiero` 🙌. Una reacción por persona y proyecto: tocar la misma la quita, otra la cambia.
- **BD (pendiente de ejecutar; requiere confirmación del dueño por las RLS):** `supabase/migrations/20261105_proyecto_reacciones.sql` — tabla `proyecto_reacciones` (única por `proyecto_id`+`user_id`), 4 políticas (cada quien lo suyo; admin ve y quita), vista pública `v_proyecto_reacciones_conteo` (solo conteos). Incluye verificación y rollback comentados.
- **Front:** `src/hooks/useReaccionesProyectos.ts` (consulta, actualización inmediata con reversión si falla, reacción pendiente tras iniciar sesión vía `sessionStorage`), `src/components/proyectos/ReaccionesProyecto.tsx` (`ResumenReacciones` en la tarjeta, `SelectorReacciones` en el detalle, botones ≥ 44 px, `aria-pressed`), cambios en `src/routes/proyectos.tsx`. Sin dependencias nuevas.
- Sin sesión: al reaccionar se abre el `LoginModal` y la reacción elegida se aplica al volver.
- Si la migración aún no se ejecutó, las consultas fallan en silencio y no se muestran reacciones (el resto de la página no se afecta).
- Verificación: `tsc` sin errores nuevos; `vite build` OK; prueba en navegador a 390 px con Supabase simulado (con estado): resumen en tarjeta solo con reacciones, selector con conteos, sin sesión → login y pendiente guardado, con sesión → reaccionar (POST), cambiar (POST) y quitar (DELETE), reacción previa marcada, 0 botones < 44 px.
- Pendiente: ejecutar la migración en Supabase y probar con datos reales; columna de reacciones en `gestionar-proyectos.tsx` (opcional, no hecho).

## 2026-11-05 — D7 (medidas, plazas y esquema): estado hasta hoy
- Decisiones del dueño: los muebles **no tienen tallas**; cada producto tiene **una o más piezas** y **cada pieza tiene sus propias medidas y plazas**. El esquema es una imagen en Cloudinary (`esquema_url`). `types.ts` queda fuera de D7.
- BD: `20261105_medidas_producto.sql` (`products`: `alto_cm`, `ancho_cm`, `fondo_cm`, `plazas`, `esquema_url`, opcionales) ejecutada y verificada por el dueño (`con_dato = 0`). `20261105_piezas_producto.sql` (`products.piezas jsonb`, lista de `{nombre, alto_cm, ancho_cm, fondo_cm, plazas}`) entregada con rollback y verificación; **ejecución sin confirmar**. Ninguna migración está en `supabase/migrations/` del repo.
- Front (en el repo): `src/lib/piezas.ts` (normaliza el jsonb, descarta lo inválido, nunca inventa), `src/components/product/MedidasPiezas.tsx` (tabla por pieza con solo las columnas que existan + esquema) y 6 líneas en `product.$handle.tsx` (pestaña Especificaciones). Sin datos no se muestra nada.
- Pendiente: confirmar que `useProduct` trae `piezas` y `esquema_url` (¿`select("*")`?); editor de piezas en el formulario de producto del admin y plantilla CSV (una fila por pieza); decidir si se eliminan `alto_cm`, `ancho_cm`, `fondo_cm` y `plazas` de `products` (quedan sin uso porque las medidas viven en `piezas`; todas están en NULL).

## 2026-11-05 — Admin móvil: tablas anchas → tarjetas apiladas (plan aprobado: «si, aplico»)
- Alcance: Pedidos, Ventas realizadas, Clientes, Productos, Combos, Usuarios e Insumos MRP. En **< 640 px** (`sm` de Tailwind) la tabla se oculta (`hidden sm:table`) y se muestran tarjetas (`TarjetasMovil`, `sm:hidden`) con nombre, estado, total/stock y la acción principal. Desde 640 px la tabla sigue igual. Sin dependencias nuevas; no se tocaron hooks, consultas, mutaciones ni permisos.
- **Nuevos:** `src/components/admin/TarjetaFila.tsx` (`TarjetaFila`, `TarjetasMovil`, `BTN_TACTIL = "h-11 min-w-11"`) y `src/lib/cantidades.ts` (`formatoCantidad`, `formatoFaltante`, `formatoNumero`, `decimalesDeUnidad`).
- **Modificados** (`src/routes/_authenticated/`): `pedidos`, `ventas`, `clientes`, `productos`, `combos`, `usuarios`, `insumos` (.tsx). Las tarjetas van dentro del mismo contenedor de la tabla (sin fragmentos ni re-indentar).
- Por pantalla: Pedidos (cliente, estado, total, fecha, Nº, DNI, «Ver detalle»); Ventas (cliente, estado, total, fecha, comprobante, canal, SUNAT, «Ver comprobante»); Clientes (nombre, segmento, contacto, canal, «Ver detalle»); Productos (foto, nombre, SKU, oferta, precio, stock, tipo, Editar y Eliminar con el `confirm()` de siempre); Combos (nombre, estado, precio, qué incluye, Editar y Eliminar); Usuarios (rol actual y selector de rol a ancho completo, mismo `disabled` para el propio usuario); Insumos (stock y MRP, ver abajo).
- Refactor mínimo: el objeto de `setEditItem` de Productos y Combos pasó a `editarProducto(p)` / `editarCombo(c)` (mismo contenido) para que lo compartan tabla y tarjetas. Los estados vacíos de Productos y Combos se repiten dentro de las tarjetas, porque en móvil la tabla (y su fila vacía) no se ve.
- **Insumos, cortes corregidos:** el resultado del MRP estaba en un contenedor `overflow-hidden` sin scroll y recortaba «Faltante»/estado → ahora `overflow-x-auto`, valores con `whitespace-nowrap` y tarjetas en móvil con estado «Faltan X» u «OK»; en la tabla de stock los encabezados («Stock mínimo») y valores no se parten, y la tarjeta muestra «Stock bajo»/«OK» (antes solo un triángulo); la tabla «Insumos a descontar» del diálogo Fabricar también pasó a `overflow-x-auto`. «OK» pasó de `green-600` a `green-700` (contraste).
- **Unidades (solo visualización, no cambia lo guardado):** enteros para `unidades`, `planchas`, `piezas`, `paquetes`, `palos`, `bolsas`; máximo 1 decimal (sin «.0») para `metros`, `kg`, `litros`, `pies`; otra unidad: hasta 2 decimales como antes. Un valor que se redondea a 0 se muestra «< 0.1» / «< 1» en vez de «0». Los valores de la tabla de stock, que se imprimían crudos, ahora usan el mismo formato.
- Controles ≥ 44 px: `Button` sigue en 32–36 px globalmente; solo las tarjetas usan `h-11`. `MovimientoDialog` e `InsumoDialog` reciben `triggerClassName` opcional (sin cambiar su lógica).
- **No se tocó:** «Historial de cambios de rol» (Usuarios, mantiene scroll horizontal); tablas de ítems dentro de los diálogos de Ventas; botones de cabecera («Nuevo producto», «Nuevo insumo», «Nuevo combo», 36 px); formularios de los diálogos en móvil. Observación: la columna «Productos» de Pedidos solo muestra el DNI (no se cambió).
- Verificación: sintaxis TS de los 9 archivos sin errores y sin nombres sin definir; formateo de cantidades probado con una batería de casos en Node (enteros, 1 decimal, redondeo a 0, negativos, nulos, unidad desconocida). Sin `node_modules` ni red. **Pendiente:** `tsc --noEmit`, `vite build` y prueba a 360/414/768 px con datos reales (estados vacíos, diálogos de Insumos desde la tarjeta, selector de rol, eliminar).
- Riesgos conocidos: tabla y tarjetas conviven en el DOM (los botones de Movimiento/Editar de Insumos se renderizan dos veces por fila; solo uno es visible); el redondeo por unidad puede ocultar decimales que sí están guardados.

## 2026-11-07 — Admin móvil, Parte 1/6 (A5/F4 + F6): verificación y cierre (plan aprobado: A + B + C)
- **Verificación previa (código real, commit 1d5f49a):** las 7 pantallas pedidas (Pedidos, Ventas, Clientes, Productos, Combos, Usuarios, Insumos) ya tenían tarjetas en < 640 px, `TarjetaFila.tsx` y `cantidades.ts`. Este trabajo cubre lo que faltaba.
- **A — unidades:** `src/components/produccion/MaterialesLista.tsx` (vista del carpintero) imprimía `stock_actual` crudo y `necesario.toFixed(2)`; ahora usa `formatoCantidad` (enteros para unidades/planchas, 1 decimal para metros/kg).
- **B — cabeceras e inputs:** botones de cabecera a 44 px solo en móvil (`h-11 sm:h-9` / `sm:h-8`, solo clases): «Nuevo producto», «Nuevo combo», «Nuevo cupón», «Nuevo insumo», «Nueva devolución», «Programar despacho» + «Hoja de ruta», «Nuevo proveedor» + «Actualizar». Nuevo `limitarDecimales(texto, unidad)` en `src/lib/cantidades.ts`: recorta lo que se escribe (enteros → ninguno; metros, kg, litros, pies → 1; otra unidad, sin cambios). Se aplica en `insumos.tsx` a la cantidad de «Registrar movimiento» (`MovimientoDialog` recibe `unidad` opcional; se pasa desde tabla y tarjeta) y a «Stock mínimo» de `InsumoDialog` (según la unidad elegida). Recorta (no redondea): «12.34» → «12.3».
- **C — tarjetas en < 640 px** (mismo patrón `hidden sm:table` + `TarjetasMovil`): `cupones`, `despachos`, `devoluciones`, `proveedores`, `produccion`, `caja` (movimientos y historial de turnos) y `correos-pedidos` (esta usa `ui/table`: `className="hidden sm:table"`; solo lectura, sin acción).
  - Para no duplicar lógica se extrajeron funciones locales con el mismo contenido: `editarCupon(c)` (cupones), `datosDespacho(d)` y `vacioDespachos` (despachos), `datosDevolucion(d)` (devoluciones). Tabla y tarjeta usan los mismos botones y el mismo `onClick`; en la tarjeta los botones/enlaces suben a 44 px con `[&_button]:h-11 [&_a]:h-11`.
  - Cupones: el interruptor activo/inactivo va en un `label` de 44 px.
- **No se tocó:** hooks, consultas, mutaciones, permisos, RLS, IGV/series. Historial de roles (Usuarios) y tablas de ítems dentro de diálogos siguen con scroll horizontal. Cantidad de «juegos» del MRP y cantidades de órdenes de compra no se limitaron (no son insumos con unidad en ese formulario).
- **Verificación:** `tsc --noEmit` sin errores nuevos (solo los 10 preexistentes de `src/integrations/supabase/types.ts`); `vite build` OK; `limitarDecimales`/`formatoCantidad` probados en Node con 12 casos. `eslint` sin hallazgos nuevos (los de `no-explicit-any`, `no-unused-expressions` y prettier/CRLF ya existían). **Sin probar en navegador** (360/414/768 px) ni con datos reales.
- Riesgos: tabla y tarjetas conviven en el DOM (los botones se renderizan dos veces; solo uno se ve); el recorte de decimales no corrige valores ya guardados; si cambias la unidad de un insumo, el «Stock mínimo» ya escrito no se vuelve a recortar hasta editarlo.

## 2026-11-08 — Insumos MRP: F5 (Stock) y F7 (Calculadora) — plan aprobado e implementado
- **Inspección previa (código real):** `insumos.tsx` (`InsumosPage`, `FilaModelo`, `CalculadoraMrp`, `InsumoDialog`), `pos.functions.ts` (`listInsumos`, `upsertInsumo`, `calcularMrp`, `getStockBajo`) y la vista `v_insumos_stock_bajo` (según `claude.md`). La lista salía por nombre; el estado era solo `stock_actual < stock_minimo` (ámbar / «OK»). `calcularMrp` ya calculaba bien (`max(0, necesario − stock)` por insumo, ordenado por faltante).
- **Por qué todo salía «OK»:** (1) `stock_minimo` vale 0 por defecto, y con 0 de stock y mínimo 0 la regla daba «OK»; (2) `InsumoDialog` enviaba el mínimo como texto al editarlo, y `upsertInsumo` valida `z.number()` (probable fallo al guardar; no se pudo comprobar contra la BD).
- **Decisiones del usuario:** stock 0 sin mínimo → rojo «Sin stock»; stock > 0 sin mínimo → gris «Sin mínimo»; el resumen incluye el total de piezas; «Juegos» solo admite enteros.
- **F5 – Stock:** nuevo `estadoStock`, `faltaStock` y `ordenarPorUrgencia` en `src/lib/cantidades.ts`. Estados: **Sin stock** (≤ 0, rojo), **Insuficiente** (0 < stock < mínimo, rojo; misma regla que la vista de alertas), **Suficiente** (stock ≥ mínimo, verde), **Sin mínimo** (gris). Orden: sin stock → insuficientes (menor cobertura stock/mínimo primero) → resto por nombre. Tabla: columna «Estado» con insignia y stock en color; tarjetas móviles: insignia, `tono="peligro"` si falta y dato «Faltan X». Ya no aparece «OK».
- **`InsumoDialog`:** `stock_minimo` se convierte a número al guardar (`Number(...) || 0`).
- **F7 – Calculadora:** + / − de las piezas (London) y ✕ de quitar modelo a 44 px; en < 640 px las piezas van una por fila (3 columnas desde `sm`); con `aria-label`. Resumen compacto: «Por juego: 1× 1 cuerpo · 1× 2 cuerpos · 1× 3 cuerpos · 3 piezas · N juegos = M piezas». «Juegos» redondea hacia abajo (`Math.floor`, mínimo 1) para no enviar decimales a `calcularMrp` (exige enteros). Topes 0–3 por pieza y fórmulas sin cambios.
- **No se tocó:** `pos.functions.ts`, vista `v_insumos_stock_bajo`, RLS, permisos, `FabricarDialog`.
- **Verificación:** `tsc --noEmit` sin errores nuevos (10 preexistentes de `types.ts`); `vite build` OK; `eslint` sin hallazgos en los 2 archivos; `estadoStock` / `ordenarPorUrgencia` probados en Node (12 casos, incluye valores como texto y orden). **Sin probar en navegador** (360/414/768 px) ni con datos reales.
- **Riesgos:** el aviso superior y el contador del menú siguen usando la vista (`stock < mínimo`), por lo que no cuentan los insumos «Sin stock» con mínimo 0; si los mínimos reales están en 0 hay que cargarlos; el orden por cobertura mezcla unidades (se usa proporción, no diferencia).

## 2026-11-08 — F8 Fabricar (MRP) y F10 Proveedores — plan aprobado e implementado (con la recomendación en cada decisión)
- **Inspección previa:** `FabricarDialog` (`insumos.tsx`), `enviarAProduccion` y `calcularMrp` (`pos.functions.ts`), tablas `orders`, `produccion`, `order_items`, `insumos`, `insumo_movimientos`, trigger `actualizar_stock_insumo` y políticas RLS (`supabase/migrations/policies.sql`; ojo: `DATABASE.md` indica que las migraciones se corren en el SQL Editor y que el repo puede no reflejar producción).
- **Problemas encontrados:** (1) 4 inserts sueltos desde el cliente → si el último fallaba quedaban orden y producción sin descuento, y al reintentar se duplicaba; (2) sin clave de idempotencia (`GM-${Date.now()}`); (3) los ids de insumo se buscaban por nombre y los no encontrados se descartaban en silencio; (4) la vista previa usaba el stock del momento del cálculo; (5) el aviso decía «puede quedar stock negativo» pero el trigger recorta en 0 (`GREATEST(stock − cantidad, 0)`), así que el movimiento registraba más de lo realmente descontado.
- **Decisiones del usuario:** bloquear la fabricación si falta stock (recomendado); atomicidad con función SQL en migración (recomendado).
- **F8 — migración `supabase/migrations/20261108_fabricar_mrp.sql`:** función `public.fabricar_mrp(_order_number, _descripcion, _insumos jsonb, _carpintero_id, _observaciones, _fecha_fin_estimada, _prioridad)`, **`SECURITY INVOKER`** (rige el RLS de quien llama; no se tocaron tablas, políticas ni permisos de tablas; solo `GRANT EXECUTE` de la función a `authenticated`). Una sola transacción: orden interna → producción → mueble (`order_items`) → salidas en `insumo_movimientos` (el trigger descuenta). Idempotente por `order_number`; si la clave existe con la misma descripción devuelve esa orden (`duplicado = true`) sin descontar, y con otra descripción rechaza. Candado de asesoría (`pg_advisory_xact_lock`) + `FOR UPDATE` en insumos; suma insumos repetidos; rechaza con «Stock insuficiente: …» sin dejar nada a medias. **Debe ejecutarse en el SQL Editor de Supabase antes de desplegar el frontend.**
- **F8 — frontend:** `enviarAProduccion` ahora hace una sola llamada `rpc("fabricar_mrp")` y recibe `order_number` (clave). `calcularMrp` devuelve `insumo_id` por insumo. `FabricarDialog`: lee el stock actual al abrir (skeleton mientras carga), muestra por insumo «Se descuenta / Stock actual / Quedará» (y «Faltan X» / «No alcanza» en rojo), bloquea «Confirmar» si falta stock o mientras carga, una clave `GM-<ms>-<4 letras>` por apertura, guard síncrono contra toques repetidos, cantidades redondeadas a 3 decimales (precisión de la BD), reintento seguro tras un error (misma clave) y botones de 44 px en móvil.
- **F10 — `proveedores.tsx`:** `ProveedorDetalle` ya no muestra «Cargando…» ni spinner: skeleton en el título y en el cuerpo con la misma estructura y medidas (badge, RUC, «Editar», pestañas, 6 tarjetas, 3 botones), `aria-busy` y texto `sr-only`. Sin dependencias nuevas (`ui/skeleton`).
- **Verificación:** `tsc --noEmit` sin errores nuevos (10 preexistentes de `types.ts`); `vite build` OK; **función SQL probada en un Postgres real (sandbox) con 10 escenarios**: éxito, insumos repetidos, duplicado, stock insuficiente con rollback total, clave reutilizada con otra orden, vendedor (RLS), usuario sin rol (RLS), insumo inexistente/datos inválidos, concurrencia con la misma clave y dos órdenes que juntas no caben, y coherencia libro de movimientos vs stock; **5 pruebas de render** (React Testing Library) de `FabricarDialog` y del skeleton (encontraron que tres clics seguidos disparaban tres llamadas → se agregó el guard). Esquema de prueba imitando `policies.sql`, no tu BD real. **Sin probar en navegador ni contra Supabase.**
- **Riesgos / notas:** si las políticas reales difieren de `policies.sql`, la función hereda las reales (es INVOKER); un vendedor no puede bloquear filas de `insumos` por RLS, por eso existe el candado de asesoría; `policies.sql` deja a cualquier usuario con rol insertar en `insumo_movimientos` y `produccion` (no se cambió); el carpintero ve sus materiales por `materiales_orden` (su SQL no está en el repo; los movimientos conservan la cantidad completa necesaria).
