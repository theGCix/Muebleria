# PROJECT — G&M Mueblería

> Estado al 2026-11-05: Parte 3/8 implementada (D1/D2 fases 1–4). Parte 4/8: entregas A, B y E6 hechas (E6 con los 6 medios y logos SVG propios); N2 pendiente y D7 en curso (ficha lista; falta editor admin). Admin móvil (tablas → tarjetas) aplicado. Detalle en TASK_LOG.md y MODULES.md (hallazgos verificados en el repo).

## Resumen
- Plataforma e-commerce + POS/ERP de una mueblería en Lima, Perú (Los Olivos).
- Repo: https://github.com/theGCix/Muebleria
- Moneda: S/ · Enfoque: móvil primero.
- Modos de negocio: **manufactura** (fabricación bajo pedido con talleres externos, BOM) y **retail** (compra-reventa).

## Stack
React, TypeScript, Vite, TanStack Router/Query, Supabase (PostgreSQL, RLS, Edge Functions), Tailwind, shadcn/ui, Cloudinary. Deploy en Render (proxy Express).

## Identidad visual (conservar)
Nogal, dorado y teal.

## Rol de Claude en este proyecto
Ingeniero full-stack senior + UI/UX e-commerce.

## Alcance de la Parte 3/8 — Confianza, legal y contenido
| ID | Tema |
|----|------|
| T1 | Footer y legal (Libro de Reclamaciones, contacto, privacidad/ARCO) |
| D1 | Materiales, tapizados y opciones por producto |
| D2 | Trazabilidad de opciones (color, firmeza, patas) producto → carrito → pedido → Mis pedidos → carpintero |
| H1 | Stock: urgencia solo con stock ≤ 3; "Fabricación bajo pedido" |
| H2 | Imágenes con logos de terceros |

## Alcance de la Parte 4/8 — Checkout y detalle de producto
| ID | Tema | Estado |
|----|------|--------|
| E4/D6 | Una sola fuente de distrito (ficha ↔ checkout ↔ tarjetas) | Hecho (4ccfac7) |
| K4 | «Envío desde S/ X» (mínimo del tarifario) o pedir distrito; nunca asumir | Hecho |
| E3 | Cabecera mínima del checkout (logo + «Compra segura») | Hecho |
| E5 | Campos agrupados; sin «Ciudad» (se deriva Lima/Callao) | Hecho |
| R2 | Carrito: nombre completo, sin SKU, envío estimado, «Vaciar» discreto | Hecho (733413e) |
| D3 | Barra de compra fija (siempre visible en móvil ≤ 640 px) | Hecho |
| D4 | Tras agregar: «Ir a pagar» + «Seguir comprando» | Hecho |
| D5 | Cotización personalizada como acción secundaria | Hecho |
| D8 | Un solo color/valor → texto, sin selector | Hecho |
| E6 | Logos y medios de pago | Hecho: Visa, Mastercard, Amex, Yape, Plin y PagoEfectivo habilitados; logos SVG en `public/pagos/` (ver TASK_LOG) |
| N2 | Precargar nombre, apellido y correo en Niubiz | Pendiente: falta doc «Botón de Pago Web» |
| D7 | Medidas, plazas y esquema por producto (por pieza) | En curso: ficha hecha con `products.piezas`; falta editor en el admin, plantilla CSV y confirmar la migración de piezas |

## Datos pendientes de confirmar con el dueño
Razón social, RUC, dirección, correo ARCO, horarios, WhatsApp, redes, logos oficiales de pago (opcional: reemplazan los SVG simplificados de `public/pagos/`) y datos del Libro de Reclamaciones. **No se inventan.**


## Admin móvil — tablas anchas → tarjetas (2026-11-05)
| Pantalla | Estado |
|----------|--------|
| Pedidos, Ventas realizadas, Clientes, Productos, Combos, Usuarios, Insumos (stock y MRP) | Hecho: tarjetas en < 640 px, controles de 44 px, cortes de Insumos corregidos y unidades con formato por tipo (ver TASK_LOG) |
| Cupones, Despachos, Devoluciones, Proveedores, Producción, Caja (movimientos e historial), Correos de pedidos | Hecho (2026-11-07): tarjetas en < 640 px |
| Cabeceras e inputs | Hecho (2026-11-07): botones de cabecera a 44 px en móvil; `limitarDecimales` en Movimiento de stock y Stock mínimo; `MaterialesLista` con unidades formateadas |
| Pendiente | Prueba en navegador a 360/414/768 px con datos reales; historial de roles y tablas dentro de diálogos siguen con scroll horizontal |
