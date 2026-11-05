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

## 2026-11-05 — Parte 5: Catálogo móvil (2 columnas, estrellas, compra rápida)
- Estado: **Plan entregado, esperando autorización.** Sin código ni cambios en el repo.
- Hallazgos (verificados): `ProductCard.tsx` YA muestra estrellas reales (`useProductRatings` → vista `v_producto_rating`; sin reseñas no muestra nada) y YA tiene «Agregar al carrito» con control de cantidad. Las grillas de `catalogo.tsx`, `categoria.$slug.tsx`, `ProductsSection.tsx` y `OfertasSection.tsx` son `grid-cols-1` en móvil (solo `ProductRecomendaciones` y `perfil/favoritos` ya usan 2). Botones de la tarjeta: corazón y ± de 32 px; falta «compra rápida».
- Archivos previstos: `ProductCard.tsx`, `product-card.css`, las 4 grillas anteriores. Sin dependencias ni migraciones.
- Pendiente: autorización y decisión sobre qué significa «compra rápida» (ver plan).
- Nota: `v_producto_rating` no está versionada en `supabase/migrations/`; no se toca.
