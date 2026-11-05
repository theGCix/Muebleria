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

## 2026-11-05 — Página Proyectos: ocultar (A) vs proyectos realizados (B) — plan
- Estado: **Plan entregado, esperando autorización.** Sin código ni cambios en el repo (solo estas notas de docs).
- Inspeccionados (solo lectura): `src/routes/proyectos.tsx`, `src/hooks/useProyectos.ts`, `src/lib/proyectos.functions.ts`, `src/routes/_authenticated/gestionar-proyectos.tsx`, `Footer.tsx`, `Header.tsx`, `nav-config.ts`, `server/sitemap.js`, `scripts/generate-sitemap.mjs`, `scripts/prerender.mjs`, `src/lib/chatSugerencias.ts`, `server/chatNavegacion.js`, `terminos.tsx`, `useGaleriaClientes.ts`, historial git de `proyectos.tsx`.
- Hallazgos: ver MODULES.md («Proyectos») y DATABASE.md («`proyectos`»). Resumen: el texto «Nuevos modelos pronto» NO existe en el código ni en el historial git (el vacío actual dice «Muy pronto»); la página ya lee la tabla `proyectos` y el pie de página ya oculta el enlace sin proyectos, pero `/proyectos` sigue en sitemap, prerender, chatbot y términos; la tabla no tiene distrito, tiempo, materiales ni antes/después; su migración no está en el repo.
- Recomendación: **A ahora** (cambio pequeño y reversible) y **B por fases, solo cuando el dueño tenga proyectos reales con datos y autorización de los clientes**.
- Pendiente del dueño: confirmar qué ve hoy en producción, cuántas filas hay en `proyectos`, esquema real de la tabla, y si hay proyectos reales con las 4 informaciones y permiso de los clientes.

## 2026-11-05 — Proyectos, Fase 1 (A) implementada (autorizada: «Fase 1 A primero»)
- Decisiones del dueño: Fase 1 (A) ahora; B en espera (hoy **no hay proyectos reales**); tiempo de ejecución como texto libre («2 semanas»); sin proyectos, redirigir a **/catalogo**.
- Patch `proyectos-fase1.patch` (7 archivos, sin archivos nuevos, sin dependencias, sin cambios de BD ni de RLS):
  - `src/routes/proyectos.tsx`: sin proyectos publicados → `<Navigate to="/catalogo" replace />` (se quitó el vacío «Muy pronto»); la vista `pagina_vista` solo se registra si hay proyectos.
  - `server/sitemap.js`: `/proyectos` sale de las páginas fijas y se agrega solo si hay proyectos publicados con foto https (`leerProyectos`); si la tabla no existe o falla, se omite sin marcar el sitemap como parcial.
  - `server/sitemap.test.js`: el simulador devuelve `proyectos` vacío por defecto; 4 pruebas nuevas.
  - `scripts/generate-sitemap.mjs` (modo `SITEMAP_STATIC=1`): misma regla. `scripts/prerender.mjs`: se retiró `/proyectos`.
  - `src/lib/chatSugerencias.ts`: las dos respuestas fijas ya no prometen «Proyectos»; apuntan a Testimonios.
  - `src/components/AsistenteChat.tsx`: si no hay proyectos, el botón «Ver proyectos realizados» que manda el servidor se cambia por «Ver testimonios» (sin duplicar). `server/chatNavegacion.js` NO se tocó.
- Verificación: `node --test server/sitemap.test.js server/chat-navegacion.test.js` → 21/21 OK; `node --check` de los .mjs OK; TypeScript sin errores de sintaxis en los 3 archivos .ts/.tsx. **Sin probar:** `tsc --noEmit` y `vite build` completos (el zip no trae `node_modules`), ni en navegador (redirección, botón del chat).
- No tocado, a la espera de aprobación del dueño: `src/routes/terminos.tsx` (el texto sobre fotos de reseñas cita la «galería de Proyectos realizados» y su enlace; con la redirección lleva al catálogo).
- Pendiente (Fase 2 / B): sigue en espera hasta tener proyectos reales con antes/después, distrito, tiempo («2 semanas») y materiales, y permiso del cliente.
- **Idea nueva del dueño (no planificada):** mostrar productos/ideas nuevas con «me gusta» o reacciones para medir si hay demanda antes de fabricarlos. Es otra función (reacciones de clientes), distinta de B: requiere plan aparte (tabla de reacciones, quién puede votar —anónimo o con cuenta—, antiabuso, privacidad, dónde se muestra y cómo se lee en el panel).

## 2026-11-05 — Proyectos, Fase 2 (B) implementada (autorizada: «vamos con la fase 2-b»)
- Patch `proyectos-fase2.patch` (se aplica DESPUÉS de `proyectos-fase1.patch`; 4 archivos modificados + 1 migración nueva; sin dependencias nuevas). Comprobado: aplica limpio sobre el zip original + Fase 1.
- **Migración nueva (requiere ejecutarla en Supabase y `git add`):** `supabase/migrations/20261105_proyectos_realizados.sql` → `proyectos`: `distrito`, `tiempo_ejecucion` (texto libre), `materiales text[]`, `fotos_antes text[]`, `fotos_despues text[]`, `autorizacion_cliente boolean default false`. Idempotente. Sin cambios de RLS (por verificar con `pg_policies`).
- `src/hooks/useProyectos.ts`: lee las columnas nuevas; si la migración no está aplicada, reintenta con las columnas anteriores (no oculta los proyectos existentes). Distrito y fotos antes/después solo salen si `autorizacion_cliente = true`.
- `src/lib/proyectos.functions.ts`: validación de los campos nuevos; no se puede publicar distrito o antes/después sin `autorizacion_cliente`; los errores de validación ahora muestran el mensaje (antes salía el JSON de zod); si la migración falta, un proyecto sin datos nuevos se sigue guardando.
- `src/routes/_authenticated/gestionar-proyectos.tsx`: campos Distrito, Tiempo de ejecución («2 semanas»), Materiales (separados por coma), tres grupos de fotos (proyecto ≤ 8, antes ≤ 4, después ≤ 4) e interruptor de autorización del cliente.
- `src/routes/proyectos.tsx`: tarjeta con distrito y tiempo; diálogo con distrito, tiempo, materiales (chips), bloque Antes/Después (miniaturas que abren la galería) y etiquetas en la foto. Lo vacío no se muestra.
- No cambia: sitemap, prerender y chat (Fase 1 ya los condiciona a que haya proyectos). `terminos.tsx` sigue sin tocar (a la espera del dueño).
- Verificación: TypeScript sin errores de sintaxis en los 4 archivos; `git apply --check` OK. **Sin probar:** `tsc --noEmit`, `vite build`, ni el flujo en navegador/Supabase (el zip no trae `node_modules`).
- Pendiente: ejecutar la migración; cargar un primer proyecto REAL (con autorización del cliente); revisar `pg_policies` de `proyectos`; decidir sobre `terminos.tsx`; la idea de reacciones («me gusta») sigue sin plan.