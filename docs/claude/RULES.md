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
15. Niubiz: no asumir parámetros del SDK ni medios habilitados; pedir la documentación o confirmación. No anunciar medios de pago que el cobro no ofrezca.

## Reglas de negocio (H1)
- Urgencia de stock solo si stock ≤ 3.
- Muebles bajo pedido: mostrar "Fabricación bajo pedido".
- **Precio con opciones:** el servidor es la única fuente (`server/pagos.js`). Precio = (lista + suma de `ajuste_precio`) con la oferta aplicada al total (decisión del dueño). No tocar `pagos.js` ni `pagos.test.js` (23 pruebas) sin mostrar la fórmula. Un commit "fix" (385fc16) la revirtió por error y se restauró en 494dc69.

## Reglas de negocio (Parte 4)
- **Distrito de envío:** una sola fuente (`useDistritoEnvio`). En el checkout manda el distrito elegido en la ficha sobre la dirección predeterminada (decisión del dueño); sin distrito nunca se asume uno.
- **«Envío desde S/ X»:** sale del mínimo vigente del tarifario (`precioEnvioDesde()` en `src/lib/envios.ts`), nunca de un monto fijo en el código.
- **`ciudad` del pedido:** se deriva del distrito (`ciudadDeDistrito`: Callao o Lima); el cliente ya no la escribe.