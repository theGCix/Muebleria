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