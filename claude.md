# Módulo Ecommerce & Catálogo — Guía de Implementación
**G&M Mueblería** · Stack: React + TanStack Router + Supabase + Cloudinary + Zustand

---

## Resumen del módulo

El módulo de Ecommerce & Catálogo está **completamente construido** en el proyecto. Cubre:

| Funcionalidad | Archivo(s) |
|---|---|
| Homepage (Hero + Categorías + Catálogo + Testimonios + Footer) | `src/routes/index.tsx` |
| Listado de productos con búsqueda | `src/components/ProductsSection.tsx` |
| Tarjeta de producto | `src/components/ProductCard.tsx` |
| Página detalle de producto | `src/routes/product.$handle.tsx` |
| Carrito de compras (drawer) | `src/components/CartDrawer.tsx` |
| Checkout con Niubiz | `src/routes/checkout.tsx` ← **no tocar** |
| Login / Registro modal | `src/components/LoginModal.tsx` |
| Perfil y historial de pedidos | `src/routes/perfil.tsx` |
| Header con nav + carrito + auth | `src/components/Header.tsx` |

---

## 1. Variables de entorno

Crea o actualiza tu `.env` con estos valores (ya presentes en el `.env` del proyecto):

```env
# Entorno
VITE_ENV=prod                          # "local" para desarrollo

# URLs
VITE_APP_URL_LOCAL=http://localhost:5173
VITE_API_URL_LOCAL=http://localhost:3001
VITE_APP_URL_PROD=https://muebleria-q74c.onrender.com
VITE_API_URL_PROD=https://muebleria-api.onrender.com
FRONTEND_URL=https://muebleria-q74c.onrender.com

# Supabase (frontend)
VITE_SUPABASE_URL=https://ckgaipbgyyvvqctehyvi.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOi...  # anon key

# Supabase (servidor Express — nunca al browser)
SUPABASE_URL=https://ckgaipbgyyvvqctehyvi.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...

# Cloudinary
VITE_CLOUDINARY_CLOUD_NAME=deq1nvaqb
VITE_CLOUDINARY_API_KEY=591435747597739
VITE_CLOUDINARY_UPLOAD_PRESET=muebleria_unsigned
CLOUDINARY_API_SECRET=...
```

> ⚠️ Las variables `NIUBIZ_*` ya existen en tu servidor Express. No hace falta añadirlas aquí.

---

## 2. Base de datos — Migraciones

Ejecuta las migraciones en este orden desde el panel de Supabase (SQL Editor) o con `supabase db push`:

### 2.1 Tabla `products` (catálogo + Cloudinary)
```
supabase/migrations/20260530_products_cloudinary.sql
```

Crea la tabla `public.products` con:
- `id`, `nombre`, `descripcion`, `sku`, `precio`, `stock`, `categoria`
- `imagen_url` (URL directa) y `imagen_public_id` (Cloudinary public_id)
- `activo` (boolean) — solo productos activos son visibles al público
- RLS habilitado: público puede leer productos activos; staff puede hacer CRUD

### 2.2 Tablas de pedidos (ecommerce)
```
supabase/migrations/20260530_orders_ecommerce.sql
```

Crea:
- `public.orders` — pedido con campos de envío, totales y campos Niubiz (`niubiz_session_key`, `niubiz_token`, `niubiz_auth_code`, `niubiz_ref_code`)
- `public.order_items` — ítems de cada pedido
- RLS: anon puede crear pedidos (necesario para el flujo Niubiz); staff ve y actualiza todo

### 2.3 Tablas de producción adicionales
```
supabase/migrations/20260605b_produccion_tablas.sql
supabase/migrations/20260605_produccion_pipeline.sql
```

---

## 3. Estructura de archivos a implementar

```
src/
├── routes/
│   ├── __root.tsx              # Shell: QueryClientProvider + Toaster + useCartSync
│   ├── index.tsx               # Homepage pública (/)
│   ├── product.$handle.tsx     # Detalle de producto (/product/:id)
│   ├── checkout.tsx            # Checkout con Niubiz — NO MODIFICAR
│   ├── perfil.tsx              # Perfil y pedidos del cliente (/perfil)
│   └── login.tsx               # Página de login alternativa (/login)
├── components/
│   ├── Header.tsx              # Nav + carrito + auth
│   ├── Hero.tsx                # Banner principal
│   ├── Categories.tsx          # Grid de 4 categorías
│   ├── ProductsSection.tsx     # Catálogo con búsqueda
│   ├── ProductCard.tsx         # Tarjeta de producto
│   ├── CartDrawer.tsx          # Sheet lateral del carrito
│   ├── Testimonials.tsx        # Sección de reseñas
│   ├── Footer.tsx              # Pie de página
│   └── LoginModal.tsx          # Dialog login/registro
├── hooks/
│   ├── useProducts.ts          # React Query: listado y detalle de productos
│   ├── useAuth.ts              # Estado de sesión + roles
│   └── useCartSync.ts          # Stub de sincronización de carrito
├── stores/
│   └── cartStore.ts            # Zustand + persist (localStorage key: "gm-cart")
├── integrations/supabase/
│   ├── client.ts               # Cliente Supabase (singleton con Proxy)
│   └── types.ts                # Tipos generados
├── lib/
│   ├── cloudinary.ts           # uploadImage() + cloudinaryUrl()
│   └── config.server.ts        # Config del servidor (nunca al browser)
├── config.ts                   # API_URL y APP_URL según VITE_ENV
└── styles.css                  # Design system (tokens oklch)
```

---

## 4. Dependencias NPM

Todas ya están en `package.json`. Para instalar:

```bash
bun install
# o
npm install
```

Paquetes clave del módulo:

| Paquete | Uso |
|---|---|
| `@tanstack/react-router` | File-based routing |
| `@tanstack/react-query` | Fetching y caché de productos |
| `@supabase/supabase-js` | Auth + DB |
| `zustand` + `persist` | Carrito con localStorage |
| `sonner` | Toasts |
| `lucide-react` | Iconos |

---

## 5. Flujo de datos por funcionalidad

### 5.1 Catálogo de productos

```
Supabase (tabla products, activo=true)
    ↓  useProducts(limit, searchTerm)   [React Query]
ProductsSection → grid de ProductCard
    ↓  click "Agregar"
cartStore.addItem()                     [Zustand + persist]
    ↓
CartDrawer (badge actualizado en Header)
```

**Hook `useProducts`:**
```ts
// src/hooks/useProducts.ts
useProducts(first = 12, search?: string)
// Filtra por nombre o categoria usando ilike
// Ordena por created_at DESC
```

### 5.2 Página de detalle

```
/product/:id
    ↓  useProduct(id)
ProductPage (imagen Cloudinary o imagen_url)
    ↓  click "Agregar al carrito"
cartStore.addItem({ id, title, price, image, sku })
toast.success(...)
```

La ruta usa el `id` del producto como `handle`:
```ts
// product.$handle.tsx
const { handle } = Route.useParams(); // handle == product UUID
```

### 5.3 Imágenes con Cloudinary

```ts
// Prioridad: imagen_public_id (Cloudinary) > imagen_url (URL directa)
const imgSrc = product.imagen_public_id
  ? cloudinaryUrl(product.imagen_public_id, { w: 400, h: 300 })
  : product.imagen_url;

// cloudinaryUrl genera:
// https://res.cloudinary.com/{CLOUD_NAME}/image/upload/w_400,q_80,f_auto,h_300/{publicId}
```

Para subir imágenes desde el panel admin:
```ts
import { uploadImage } from "@/lib/cloudinary";
const result = await uploadImage(file, "muebleria/productos");
// result.public_id  → guardar en products.imagen_public_id
// result.secure_url → guardar en products.imagen_url (opcional)
```

### 5.4 Autenticación

```
LoginModal (Dialog)
├── Email + password  → supabase.auth.signInWithPassword()
├── Registro          → supabase.auth.signUp()
├── Google OAuth      → supabase.auth.signInWithOAuth({ provider: "google" })
└── Facebook OAuth    → supabase.auth.signInWithOAuth({ provider: "facebook" })

useAuth() → { user, session, roles[], loading }
roles: "admin" | "vendedor" | "cliente"  (tabla user_roles)
```

**Configurar OAuth en Supabase:**
1. Supabase Dashboard → Authentication → Providers
2. Habilitar Google y Facebook con sus Client ID/Secret
3. Redirect URL: `https://ckgaipbgyyvvqctehyvi.supabase.co/auth/v1/callback`

### 5.5 Carrito (Zustand)

```ts
// src/stores/cartStore.ts
const { items, addItem, removeItem, updateQty, clearCart, total } = useCartStore();

// Persiste en localStorage con key "gm-cart"
// total() es una función (no valor reactivo):
const totalAmount = total(); // llamar como función
```

### 5.6 Checkout → Niubiz (NO MODIFICAR)

El flujo ya está implementado y funcionando:
1. `CartDrawer` → requiere login → redirige a `/checkout`
2. `/checkout` → llama a `POST /api/niubiz/session` (servidor Express)
3. Abre popup `VisanetCheckout`
4. Resultado: modal de éxito/error + limpia carrito

---

## 6. Routing (TanStack Router file-based)

El archivo `src/routeTree.gen.ts` se genera automáticamente. **No editar a mano.**

Para agregar una nueva ruta pública (ej. `/contacto`):
```
src/routes/contacto.tsx
```

```tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/contacto")({
  component: ContactoPage,
});

function ContactoPage() {
  return <div>...</div>;
}
```

Rutas protegidas (solo admin/vendedor) van dentro de `_authenticated/`:
```
src/routes/_authenticated/nueva-ruta.tsx
```

---

## 7. Design System

El tema está definido en `src/styles.css` con tokens CSS oklch.

**Colores principales:**
| Token | Valor | Uso |
|---|---|---|
| `--primary` | `oklch(0.42 0.07 55)` | Botones, CTA |
| `--accent` | `oklch(0.62 0.14 45)` | Highlights, precios |
| `--background` | `oklch(0.985 0.008 80)` | Fondo cálido crema |
| `--card` | `oklch(0.98 0.01 80)` | Tarjetas |
| `--foreground` | `oklch(0.22 0.025 50)` | Texto principal |

**Tipografía:** La clase `font-display` usa la fuente del `@theme`. Para activarla, confirma que tienes la fuente configurada en el `@theme inline` de `styles.css`.

**Gradiente:** `bg-[var(--gradient-warm)]` — disponible en Header logo y Hero.

---

## 8. Configuración de Cloudinary

1. Crear cuenta en [cloudinary.com](https://cloudinary.com)
2. Dashboard → Settings → Upload → Upload presets
3. Crear preset: nombre `muebleria_unsigned`, modo **Unsigned**
4. Copiar **Cloud name** y **API Key** al `.env`

El preset unsigned permite subir imágenes desde el browser sin exponer el API secret.

---

## 9. Levantar el proyecto

```bash
# Desarrollo (frontend + servidor Express en paralelo)
bun run dev
# o
npm run dev

# Esto levanta:
# - Vite en http://localhost:5173
# - Express API en http://localhost:3001
```

Para producción (Render):
- Frontend: servir el `dist/` generado por `vite build`
- Backend: `server/index.js` con las variables de entorno de producción
- Cambiar `VITE_ENV=prod` en el `.env` de Render

---

## 10. Lista de verificación de implementación

### Base de datos
- [ ] Ejecutar migración `products_cloudinary.sql`
- [ ] Ejecutar migración `orders_ecommerce.sql`
- [ ] Ejecutar migraciones de producción (`20260605b_produccion_tablas.sql`, `20260605_produccion_pipeline.sql`)
- [ ] Verificar que la función `has_role()` existe (usada en las policies)
- [ ] Configurar OAuth providers en Supabase (Google, Facebook)

### Cloudinary
- [ ] Crear upload preset `muebleria_unsigned` en modo Unsigned
- [ ] Confirmar `VITE_CLOUDINARY_CLOUD_NAME` y `VITE_CLOUDINARY_API_KEY` en `.env`

### Variables de entorno
- [ ] `.env` con todas las variables listadas en sección 1
- [ ] Para producción: `VITE_ENV=prod` y URLs de Render

### Productos
- [ ] Cargar al menos un producto desde el panel admin (`/productos`)
- [ ] Verificar que `activo = true` para que aparezcan en el catálogo público

### Verificación funcional
- [ ] Homepage carga en `/` con Hero, Categorías, Catálogo, Testimonios
- [ ] Búsqueda de productos filtra en tiempo real
- [ ] Click en producto abre `/product/:id`
- [ ] "Agregar al carrito" actualiza el badge del header
- [ ] CartDrawer muestra ítems, permite modificar cantidad
- [ ] Sin sesión: checkout abre LoginModal
- [ ] Con sesión: checkout redirige a `/checkout` (Niubiz — ya funciona)
- [ ] Perfil `/perfil` muestra historial de pedidos del usuario

---

## 11. Notas importantes

**`useCartStore().total`** es una función, no un valor:
```tsx
// ✅ Correcto
const total = useCartStore((s) => s.total);
const amount = total(); // llamar

// ❌ Incorrecto
const { total } = useCartStore(); // total es función, no número
```

**`product.$handle.tsx`** usa el `id` UUID del producto como handle. Si quieres URLs por slug (`/product/mesa-comedor-roble`), necesitarías agregar un campo `slug` a la tabla y ajustar `useProduct()`.

**RLS en `orders`:** La policy actual permite a `anon` crear pedidos (necesario para que Niubiz pueda registrar la orden). El SELECT está restringido a admin/vendedor. Para que un cliente vea sus propios pedidos en `/perfil`, revisa que existe la policy:
```sql
CREATE POLICY "Cliente ve sus pedidos"
  ON public.orders FOR SELECT TO authenticated
  USING (email = auth.email());
```
Si no existe, agrégala.

**`routeTree.gen.ts`** se regenera automáticamente con `vite dev`. Si ves errores de rutas faltantes, reinicia el servidor de desarrollo.


























































































# Módulo Operaciones y Seguimiento de Pedidos — Guía de Implementación
**G&M Mueblería** · Rutas admin + pipeline de producción + vista cliente

---

## Qué cubre este módulo

| Funcionalidad | Archivo |
|---|---|
| Panel admin de pedidos online con pipeline | `src/routes/_authenticated/pedidos.tsx` |
| Vista de seguimiento del cliente | `src/routes/perfil.tsx` |
| Layout protegido con sidebar | `src/routes/_authenticated.tsx` |
| Sidebar de navegación admin | `src/components/AppSidebar.tsx` |
| Dashboard con KPIs y gráficos | `src/routes/_authenticated/dashboard.tsx` |

**Base de datos:**
| Migración | Qué crea |
|---|---|
| `20260605_produccion_pipeline.sql` (Paso 1) | Extiende `order_status` enum con `en_produccion`, `control_calidad`, `listo_despacho`; añade rol `carpintero` |
| `20260605b_produccion_tablas.sql` (Paso 2) | Tablas `produccion`, `order_estado_historial`, `notificaciones`; función RPC `cambiar_estado_pedido`; vista `v_produccion_panel` |

---

## ⚠️ Problemas detectados que debes corregir antes de implementar

### 1. Columnas faltantes en la tabla `orders`

La ruta `/perfil` consulta `orders.user_id` y `orders.estimated_delivery`, pero la migración original de `orders` (`20260530_orders_ecommerce.sql`) **no incluye esas columnas**. Sin ellas, la query de "Mis pedidos" del cliente no devuelve nada.

Ejecuta en el SQL Editor de Supabase:

```sql
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS estimated_delivery DATE;

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
```

Luego, en el checkout (`src/routes/checkout.tsx`), al crear la orden asegúrate de incluir `user_id`:
```ts
// Dentro del payload que construyes antes de INSERT
user_id: user?.id ?? null,
```

### 2. Mismatch del enum `order_status` entre perfil y pedidos

`perfil.tsx` usa `en_preparacion` (con tilde conceptual, del enum original).  
`pedidos.tsx` y la DB post-migración usan `en_produccion` (nuevo valor del pipeline).

Son **dos valores distintos en el enum**. El cliente ve "En preparación" pero el admin ve "En producción" — aunque ambos mapen al mismo estado real. Necesitas decidir cuál usar y unificar:

**Opción A — usar solo `en_produccion` (recomendado):** Actualiza `perfil.tsx` para reconocer `en_produccion`:

```ts
// src/routes/perfil.tsx — reemplaza el bloque STATUS_CONFIG y STATUS_STEPS
type OrderStatus =
  | "pendiente" | "pagado" | "en_produccion"
  | "control_calidad" | "listo_despacho"
  | "enviado" | "entregado" | "cancelado";

const STATUS_CONFIG: Record<OrderStatus, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  pendiente:       { label: "Pendiente",       icon: Clock,        color: "#92400e", bg: "#fef3c7" },
  pagado:          { label: "Pago recibido",   icon: CheckCircle2, color: "#065f46", bg: "#d1fae5" },
  en_produccion:   { label: "En producción",   icon: Package,      color: "#1e40af", bg: "#dbeafe" },
  control_calidad: { label: "Control calidad", icon: Package,      color: "#5b21b6", bg: "#ede9fe" },
  listo_despacho:  { label: "Listo despacho",  icon: Truck,        color: "#0e7490", bg: "#cffafe" },
  enviado:         { label: "En camino",        icon: Truck,        color: "#6d28d9", bg: "#ede9fe" },
  entregado:       { label: "Entregado",        icon: CheckCircle2, color: "#14532d", bg: "#dcfce7" },
  cancelado:       { label: "Cancelado",        icon: XCircle,     color: "#7f1d1d", bg: "#fee2e2" },
};

const STATUS_STEPS: OrderStatus[] = [
  "pagado", "en_produccion", "control_calidad", "listo_despacho", "enviado", "entregado"
];
```

**Opción B — deprecar `en_preparacion`:** Si ya tienes órdenes reales con ese estado, migra los datos antes de eliminar el valor del enum:
```sql
UPDATE public.orders SET status = 'en_produccion' WHERE status = 'en_preparacion';
```

### 3. RLS faltante: el cliente debe poder ver sus propios pedidos

La migración de `orders` solo define policies para `anon` (crear) y admin/vendedor (ver todo). El cliente autenticado no puede leer sus propios pedidos. Añade:

```sql
CREATE POLICY "Cliente ve sus propios pedidos"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR email = auth.email());
```

---

## 1. Orden de ejecución de migraciones

Ejecuta en este orden exacto (cada una en una transacción separada en el SQL Editor):

```
1. 20260529080048_...sql        ← perfiles, roles, has_role(), customers
2. 20260529080109_...sql        ← resto del schema base
3. 20260530_products_cloudinary.sql
4. 20260530_orders_ecommerce.sql
5. ALTER TABLE orders ADD COLUMN user_id, estimated_delivery  ← corrección manual
6. 20260605_produccion_pipeline.sql   ← PASO 1: solo extiende enums
7. 20260605b_produccion_tablas.sql    ← PASO 2: tablas y funciones
8. CREATE POLICY "Cliente ve sus propios pedidos"  ← corrección manual
```

> **Importante:** Las migraciones del Paso 1 y Paso 2 deben ejecutarse en **transacciones separadas**. Añadir valores a un enum no puede ir en la misma transacción que crear tablas que usen ese enum.

---

## 2. Estructura de tablas del módulo

### `produccion`
Un registro por pedido, creado automáticamente por la función `cambiar_estado_pedido` cuando el estado pasa a `en_produccion`.

| Campo | Tipo | Descripción |
|---|---|---|
| `order_id` | UUID UNIQUE | FK a `orders` |
| `asignado_a` | UUID | FK a `auth.users` (carpintero) |
| `status` | enum | `pendiente`, `en_proceso`, `pausado`, `terminado`, `rechazado_calidad` |
| `prioridad` | smallint 1–3 | 1=urgente, 2=normal, 3=baja |
| `fecha_inicio` | date | Auto: día del cambio a `en_produccion` |
| `fecha_fin_estimada` | date | Auto: +7 días desde inicio |
| `calidad_aprobada` | boolean | Resultado del control de calidad |

### `order_estado_historial`
Registro automático via trigger `trg_historial_order_status` cada vez que cambia `orders.status`.

| Campo | Tipo |
|---|---|
| `order_id` | UUID |
| `estado_anterior` | order_status |
| `estado_nuevo` | order_status |
| `cambiado_por` | UUID (usuario) |
| `motivo` | TEXT (opcional) |

### `notificaciones`
Cola de emails/SMS/WhatsApp encolados automáticamente por `cambiar_estado_pedido`. **No se envían solos** — necesitas un worker o cron que los procese (ver sección 5).

---

## 3. La función RPC `cambiar_estado_pedido`

Es el núcleo del módulo. Se llama desde el frontend así:

```ts
// src/routes/_authenticated/pedidos.tsx
await supabase.rpc("cambiar_estado_pedido", {
  _order_id: orderId,
  _nuevo_estado: nuevoEstado,   // ej: "en_produccion"
  // _motivo: "Confirmado por cliente" (opcional)
});
```

La función hace todo en una transacción:
1. Valida que la transición sea permitida (diagrama abajo)
2. Actualiza `orders.status`
3. El trigger `trg_historial_order_status` inserta en `order_estado_historial`
4. Si el nuevo estado es `en_produccion`, inserta/actualiza en `produccion`
5. Encola una notificación en `notificaciones`

### Diagrama de transiciones válidas

```
pendiente ──────────────────────────────────► cancelado
    │
    ▼
  pagado ─────────────────────────────────── cancelado
    │
    ▼
en_produccion ──────────────────────────── cancelado
    │
    ▼
control_calidad ◄──── (rechazar, vuelve a en_produccion)
    │
    ▼
listo_despacho
    │
    ├──► enviado ──► entregado
    │
    └──► entregado (entrega directa en tienda)
```

---

## 4. Flujo de datos en el panel admin (`/pedidos`)

```
Supabase: orders JOIN produccion
    ↓  useQuery([\"orders\"], fetchOrders, { refetchInterval: 60_000 })
PedidosPage
├── KPIs: total pedidos, pendientes/pagados, en producción, facturado
├── Pipeline visual: botones filtrables por estado con contador
├── Filtros: búsqueda por nº pedido / nombre / email / teléfono + select de estado
└── Tabla con paginación implícita (todos los pedidos)
     └── click ojo → Dialog detalle
          ├── Pipeline de avance visual (círculos + líneas)
          ├── Botones "Cambiar a:" (solo transiciones válidas del estado actual)
          │    └── mutation → supabase.rpc("cambiar_estado_pedido")
          │         └── onSuccess: invalidate ["orders"] + ["order-historial", id]
          ├── Datos del cliente
          ├── Productos (order_items)
          ├── Totales
          ├── Historial de estados
          └── Datos de pago Niubiz
```

**Auto-refresh:** la query tiene `refetchInterval: 60_000` (1 minuto). Si quieres tiempo real usa Supabase Realtime:
```ts
// Añadir en fetchOrders o en un useEffect:
supabase
  .channel("orders-changes")
  .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
    qc.invalidateQueries({ queryKey: ["orders"] });
  })
  .subscribe();
```

---

## 5. Procesamiento de notificaciones (cola `notificaciones`)

La tabla `notificaciones` actúa como cola de mensajes. El campo `enviado` empieza en `false`. **Los emails no se envían automáticamente** — necesitas implementar el worker.

### Opción A — Cron de Supabase (recomendado)

Crea una Edge Function que procesa la cola y configura el cron desde el dashboard:

```ts
// supabase/functions/send-notifications/index.ts
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async () => {
  const { data: pendientes } = await supabase
    .from("notificaciones")
    .select("*")
    .eq("enviado", false)
    .limit(50);

  for (const notif of pendientes ?? []) {
    try {
      // Enviar con Resend, SendGrid, etc.
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "G&M Mueblería <noreply@tudominio.com>",
          to: notif.destinatario_email,
          subject: notif.asunto,
          html: `<p>Hola ${notif.destinatario_nombre}, tu pedido ha cambiado de estado.</p>`,
        }),
      });
      await supabase
        .from("notificaciones")
        .update({ enviado: true, enviado_at: new Date().toISOString() })
        .eq("id", notif.id);
    } catch (err) {
      await supabase
        .from("notificaciones")
        .update({ error: String(err) })
        .eq("id", notif.id);
    }
  }
  return new Response("ok");
});
```

Configurar cron en Supabase Dashboard → Edge Functions → Schedules: `*/5 * * * *` (cada 5 minutos).

### Opción B — desde el servidor Express

Agrega un `setInterval` en `server/index.js` que llame al mismo endpoint de Supabase usando la `service_role` key.

---

## 6. Vista del cliente: `/perfil`

El cliente ve sus propios pedidos con un tracker visual de progreso. El flujo:

```
GET /perfil
    │
    ├── useAuth() → user
    └── useQuery(["mis-pedidos", user.id])
          └── supabase.from("orders").eq("user_id", userId)
                ↓
          Lista de PedidoCard
          ├── Estado con badge de color
          ├── Barra de progreso visual (pasos del pipeline)
          └── Detalle expandible: productos, totales, dirección
```

**Requisito previo:** la RLS policy "Cliente ve sus propios pedidos" debe existir (ver sección de correcciones), y la columna `user_id` debe estar en `orders`.

---

## 7. Roles y accesos

| Rol | Acceso al panel admin | Puede cambiar estados | Ve producción |
|---|---|---|---|
| `admin` | ✅ Todas las rutas `/_authenticated/` | ✅ Cualquier transición válida | ✅ |
| `vendedor` | ✅ Dashboard, Pedidos, Ventas, Clientes | ✅ Cualquier transición válida | ✅ |
| `carpintero` | ❌ Sin acceso al panel (aún no hay ruta dedicada) | ❌ | ✅ Solo sus propios registros de producción |
| `cliente` | ❌ | ❌ | ❌ (ve su propio `/perfil`) |

**Asignar un rol a un usuario** desde el SQL Editor:
```sql
-- Dar rol "vendedor" a un usuario por email
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'vendedor' FROM auth.users WHERE email = 'vendedor@tuempresa.com';
```

---

## 8. Vista `v_produccion_panel`

Disponible en la DB, lista los pedidos activos en producción (excluye `terminado`). Puede consultarse desde una futura ruta `/produccion` para el panel del carpintero:

```ts
const { data } = await supabase.from("v_produccion_panel").select("*");
// Devuelve: produccion_id, order_id, order_number, cliente, email,
//           total, order_status, prod_status, prioridad,
//           fecha_inicio, fecha_fin_estimada, calidad_aprobada, carpintero
```

---

## 9. Lista de verificación

### Base de datos
- [ ] Migración `20260605_produccion_pipeline.sql` ejecutada (Paso 1 — solo enums)
- [ ] Migración `20260605b_produccion_tablas.sql` ejecutada (Paso 2 — tablas)
- [ ] `ALTER TABLE orders ADD COLUMN user_id, estimated_delivery` ejecutado
- [ ] Policy "Cliente ve sus propios pedidos" creada
- [ ] Verificar que `has_role()` existe (viene de la migración base `20260529...`)

### Frontend
- [ ] `perfil.tsx`: `STATUS_CONFIG` y `STATUS_STEPS` actualizados a los estados del pipeline nuevo (`en_produccion`, `control_calidad`, `listo_despacho`)
- [ ] `checkout.tsx`: incluye `user_id: user?.id` en el INSERT de la orden
- [ ] Acceder a `/dashboard`, `/pedidos` con usuario admin y confirmar que carga

### Notificaciones (opcional pero recomendado)
- [ ] Crear Edge Function `send-notifications` con proveedor de email
- [ ] Configurar `RESEND_API_KEY` (o proveedor elegido) como secret en Supabase
- [ ] Configurar cron en Supabase

### Verificación funcional
- [ ] Admin puede ver todos los pedidos en `/pedidos`
- [ ] Pipeline visual muestra conteo por estado
- [ ] Click en un pedido abre el detalle con ítems e historial
- [ ] Cambiar estado de `pagado` → `en_produccion` funciona (llama al RPC)
- [ ] Al cambiar a `en_produccion`, se crea un registro en `produccion`
- [ ] El historial de estados registra el cambio automáticamente
- [ ] El cliente en `/perfil` ve sus pedidos (requiere columna `user_id`)
- [ ] La barra de progreso del cliente refleja el estado actual correctamente

---

## 10. Notas adicionales

**El Dialog de pedidos tiene un bug menor:** en `pedidos.tsx` la condición de apertura del Dialog es:
```tsx
// ❌ Como está ahora (bug lógico)
open={!!selectedId && !selectedId !== null}

// ✅ Corrección
open={!!selectedId}
```

**El query de `pedidos.tsx` hace JOIN con `produccion`** usando la sintaxis de Supabase nested relations (`produccion (...)`). Esto funciona porque existe la FK `produccion.order_id → orders.id` y es una relación 1:1 (UNIQUE).

**`cambiar_estado_pedido` usa `SECURITY DEFINER`**, lo que significa que se ejecuta con permisos del propietario de la función (normalmente `postgres`), no del usuario llamante. La verificación de roles la hace internamente con `has_role(auth.uid(), ...)`. No expongas esta función a `anon`.
























































































































































# Módulo Clientes y CRM — Guía de Implementación
**G&M Mueblería** · Estado real del código + lo que hay que construir

---

## Estado actual del módulo

A diferencia de los módulos anteriores (donde el código estaba casi completo), este módulo está **parcialmente construido**. Hay que ser claro sobre qué existe y qué hay que escribir:

| Pieza | Estado | Notas |
|---|---|---|
| `/clientes` | ⚠️ Stub básico | Solo lista con búsqueda — sin detalle, sin edición, sin historial |
| `/crm` | ❌ Placeholder | Es una página de links a herramientas externas (Twenty CRM, ERPNext), no un CRM real |
| `customers` tabla | ✅ Existe | `doc_tipo`, `doc_numero`, `nombre`, `email`, `telefono`, `direccion` |
| `searchCustomers()` | ✅ Existe | En `pos.functions.ts`, búsqueda por nombre o doc_numero |
| `upsertCustomer()` | ✅ Existe | Insert/update por doc_tipo+doc_numero |
| Historial de compras POS | ✅ Existe | `sales` tabla con `customer_id` |
| Historial de pedidos online | ✅ Existe | `orders` tabla con `email` (sin FK a customers) |
| Segmento / notas CRM | ❌ No existe | La tabla `customers` no tiene estos campos |
| Panel de detalle de cliente | ❌ No existe | Hay que construirlo |
| Vista 360° del cliente | ❌ No existe | Compras POS + pedidos online unificados |

---

## 1. Qué columnas faltan en `customers`

La tabla actual solo tiene datos de contacto básicos. Para un CRM funcional necesitas añadir:

```sql
-- Ejecutar en Supabase SQL Editor
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS segmento      TEXT    NOT NULL DEFAULT 'nuevo'
                                         CHECK (segmento IN ('nuevo', 'recurrente', 'vip', 'inactivo')),
  ADD COLUMN IF NOT EXISTS notas         TEXT,
  ADD COLUMN IF NOT EXISTS tags          TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS fecha_ultimo_contacto  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS distrito      TEXT,
  ADD COLUMN IF NOT EXISTS ciudad        TEXT    DEFAULT 'Lima';

-- Índice para filtrar por segmento
CREATE INDEX IF NOT EXISTS idx_customers_segmento ON public.customers(segmento);
```

### Vista de valor del cliente (computed en DB)

Esta vista une compras POS + pedidos online para tener el valor real por cliente:

```sql
CREATE OR REPLACE VIEW public.v_customer_valor AS
SELECT
  c.id,
  c.nombre,
  c.email,
  c.telefono,
  c.doc_tipo,
  c.doc_numero,
  c.segmento,
  c.notas,
  c.direccion,
  c.created_at,

  -- Ventas POS
  COUNT(DISTINCT s.id)            AS total_compras_pos,
  COALESCE(SUM(s.total), 0)       AS gasto_pos,
  MAX(s.created_at)               AS ultima_compra_pos,

  -- Pedidos online (match por email)
  COUNT(DISTINCT o.id)            AS total_pedidos_online,
  COALESCE(SUM(o.total), 0)       AS gasto_online,
  MAX(o.created_at)               AS ultimo_pedido_online,

  -- Total unificado
  COALESCE(SUM(s.total), 0) + COALESCE(SUM(o.total), 0) AS valor_total_cliente,

  GREATEST(MAX(s.created_at), MAX(o.created_at)) AS ultima_actividad

FROM public.customers c
LEFT JOIN public.sales s
  ON s.customer_id = c.id AND s.estado = 'completada'
LEFT JOIN public.orders o
  ON o.email = c.email AND o.status NOT IN ('pendiente', 'cancelado')
GROUP BY c.id;

GRANT SELECT ON public.v_customer_valor TO authenticated;
```

> **Nota:** Los pedidos online se vinculan al cliente por `email` porque `orders` no tiene FK a `customers`. Una vez hagas el `ALTER TABLE orders ADD COLUMN user_id` del módulo anterior, puedes mejorar este JOIN.

---

## 2. Ampliar `searchCustomers` en `pos.functions.ts`

La función actual devuelve los campos básicos y limita a 20 resultados. Amplía para incluir los nuevos campos y aumentar el límite:

```ts
// src/lib/pos.functions.ts — reemplazar searchCustomers
export async function searchCustomers(input: { data: { q: string; limit?: number } }) {
  const { q, limit = 50 } = z.object({
    q: z.string().max(100),
    limit: z.number().int().min(1).max(200).optional(),
  }).parse(input.data);

  const { supabase } = await getAuthenticatedClient();
  const trimmed = q.trim();

  let query = supabase
    .from("customers")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (trimmed) {
    query = query.or(
      `nombre.ilike.%${trimmed}%,doc_numero.ilike.%${trimmed}%,email.ilike.%${trimmed}%,telefono.ilike.%${trimmed}%`
    );
  }

  const { data: rows, error } = await query;
  if (error) throw new Error(error.message);
  return { customers: rows ?? [] };
}
```

Añade también estas dos funciones nuevas en `pos.functions.ts`:

```ts
// Obtener un cliente con su valor completo (vista v_customer_valor)
export async function getCustomerValor(input: { id: string }) {
  const { id } = z.object({ id: z.string().uuid() }).parse(input);
  const { supabase } = await getAuthenticatedClient();
  const { data, error } = await supabase
    .from("v_customer_valor")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return { customer: data };
}

// Historial de compras POS de un cliente
export async function getCustomerSales(input: { customer_id: string }) {
  const { customer_id } = z.object({ customer_id: z.string().uuid() }).parse(input);
  const { supabase } = await getAuthenticatedClient();
  const { data, error } = await supabase
    .from("sales")
    .select("id, numero, tipo, total, metodo_pago, estado, created_at, sale_items(title, qty, unit_price)")
    .eq("customer_id", customer_id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return { sales: data ?? [] };
}

// Historial de pedidos online de un cliente (por email)
export async function getCustomerOrders(input: { email: string }) {
  const { email } = z.object({ email: z.string().email() }).parse(input);
  const { supabase } = await getAuthenticatedClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_number, total, status, created_at")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return { orders: data ?? [] };
}

// Actualizar segmento y notas de un cliente
export async function updateCustomerCrm(input: {
  id: string;
  segmento: "nuevo" | "recurrente" | "vip" | "inactivo";
  notas?: string | null;
  tags?: string[];
}) {
  const data = z.object({
    id: z.string().uuid(),
    segmento: z.enum(["nuevo", "recurrente", "vip", "inactivo"]),
    notas: z.string().max(2000).optional().nullable(),
    tags: z.array(z.string()).optional(),
  }).parse(input);

  const { supabase } = await getAuthenticatedClient();
  const { data: row, error } = await supabase
    .from("customers")
    .update({
      segmento: data.segmento,
      notas: data.notas ?? null,
      tags: data.tags ?? [],
      fecha_ultimo_contacto: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", data.id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { customer: row };
}
```

---

## 3. Reescribir `/clientes` — Panel CRM completo

Reemplaza el contenido actual de `src/routes/_authenticated/clientes.tsx` con esta implementación. Es la pieza más grande de este módulo:

```tsx
// src/routes/_authenticated/clientes.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  searchCustomers, getCustomerValor, getCustomerSales,
  getCustomerOrders, updateCustomerCrm, upsertCustomer,
} from "@/lib/pos.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2, Search, UserPlus, Eye, TrendingUp,
  ShoppingBag, Package, Phone, Mail, MapPin,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({ meta: [{ title: "Clientes — G&M" }] }),
  component: ClientesPage,
});

const fmt = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n);
const fmtDate = (d: string | null) =>
  d ? format(new Date(d), "dd/MM/yyyy") : "—";

const SEGMENTO_CONFIG = {
  nuevo:      { label: "Nuevo",      color: "#1e40af", bg: "#dbeafe" },
  recurrente: { label: "Recurrente", color: "#065f46", bg: "#d1fae5" },
  vip:        { label: "VIP",        color: "#78350f", bg: "#fef3c7" },
  inactivo:   { label: "Inactivo",   color: "#6b7280", bg: "#f3f4f6" },
} as const;

type Segmento = keyof typeof SEGMENTO_CONFIG;

// ── Detalle 360° del cliente ─────────────────────────────────
function ClienteDetalle({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ segmento: "nuevo" as Segmento, notas: "" });

  const { data: cv, isLoading } = useQuery({
    queryKey: ["customer-valor", customerId],
    queryFn: () => getCustomerValor({ id: customerId }),
    onSuccess: (d) => {
      setForm({
        segmento: (d.customer.segmento ?? "nuevo") as Segmento,
        notas: d.customer.notas ?? "",
      });
    },
  });

  const { data: salesData } = useQuery({
    queryKey: ["customer-sales", customerId],
    queryFn: () => getCustomerSales({ customer_id: customerId }),
  });

  const { data: ordersData } = useQuery({
    queryKey: ["customer-orders", cv?.customer?.email],
    queryFn: () => getCustomerOrders({ email: cv!.customer.email! }),
    enabled: !!cv?.customer?.email,
  });

  const saveMut = useMutation({
    mutationFn: () => updateCustomerCrm({ id: customerId, ...form }),
    onSuccess: () => {
      toast.success("Cliente actualizado");
      qc.invalidateQueries({ queryKey: ["customer-valor", customerId] });
      qc.invalidateQueries({ queryKey: ["customers-list"] });
      setEditMode(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const c = cv?.customer;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {isLoading ? "Cargando..." : c?.nombre}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : c ? (
          <div className="space-y-5 mt-1">

            {/* KPIs */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-muted/40 rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground mb-0.5">Valor total</p>
                <p className="font-display text-lg font-semibold">{fmt(Number(c.valor_total_cliente ?? 0))}</p>
              </div>
              <div className="bg-muted/40 rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground mb-0.5">Compras POS</p>
                <p className="font-display text-lg font-semibold">{c.total_compras_pos ?? 0}</p>
              </div>
              <div className="bg-muted/40 rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground mb-0.5">Pedidos online</p>
                <p className="font-display text-lg font-semibold">{c.total_pedidos_online ?? 0}</p>
              </div>
            </div>

            {/* Datos de contacto */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm bg-muted/30 rounded-xl p-4">
              <div>
                <span className="text-muted-foreground text-xs">Documento</span>
                <p className="font-medium">{c.doc_tipo} {c.doc_numero}</p>
              </div>
              {c.email && (
                <div className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <span className="text-muted-foreground text-xs">Email</span>
                    <p className="font-medium text-sm truncate">{c.email}</p>
                  </div>
                </div>
              )}
              {c.telefono && (
                <div className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <span className="text-muted-foreground text-xs">Teléfono</span>
                    <p className="font-medium">{c.telefono}</p>
                  </div>
                </div>
              )}
              {c.direccion && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <span className="text-muted-foreground text-xs">Dirección</span>
                    <p className="font-medium text-sm">{c.direccion}</p>
                  </div>
                </div>
              )}
              <div>
                <span className="text-muted-foreground text-xs">Cliente desde</span>
                <p className="font-medium">{fmtDate(c.created_at)}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Última actividad</span>
                <p className="font-medium">{fmtDate(c.ultima_actividad)}</p>
              </div>
            </div>

            {/* CRM: segmento y notas */}
            <div className="border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">CRM</h4>
                {!editMode ? (
                  <Button size="sm" variant="outline" onClick={() => setEditMode(true)}>
                    Editar
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditMode(false)}>
                      Cancelar
                    </Button>
                    <Button size="sm" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
                      {saveMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                      Guardar
                    </Button>
                  </div>
                )}
              </div>

              {editMode ? (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Segmento</Label>
                    <Select
                      value={form.segmento}
                      onValueChange={(v) => setForm((f) => ({ ...f, segmento: v as Segmento }))}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(SEGMENTO_CONFIG).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Notas internas</Label>
                    <Textarea
                      className="mt-1 text-sm"
                      rows={3}
                      value={form.notas}
                      onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                      placeholder="Preferencias, historial de contacto, observaciones..."
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Segmento:</span>
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{
                        color: SEGMENTO_CONFIG[c.segmento as Segmento]?.color ?? "#6b7280",
                        background: SEGMENTO_CONFIG[c.segmento as Segmento]?.bg ?? "#f3f4f6",
                      }}
                    >
                      {SEGMENTO_CONFIG[c.segmento as Segmento]?.label ?? c.segmento}
                    </span>
                  </div>
                  {c.notas ? (
                    <p className="text-muted-foreground text-xs bg-muted/30 rounded-lg p-3 whitespace-pre-line">
                      {c.notas}
                    </p>
                  ) : (
                    <p className="text-muted-foreground text-xs italic">Sin notas</p>
                  )}
                </div>
              )}
            </div>

            {/* Historial POS */}
            {(salesData?.sales ?? []).length > 0 && (
              <section>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                  <ShoppingBag className="h-4 w-4" /> Compras en tienda
                </h4>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {salesData!.sales.map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between text-sm p-2.5 rounded-lg bg-muted/30">
                      <div>
                        <span className="font-mono text-xs text-muted-foreground">{s.numero}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{fmtDate(s.created_at)}</span>
                      </div>
                      <span className="font-semibold">{fmt(Number(s.total))}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Historial online */}
            {(ordersData?.orders ?? []).length > 0 && (
              <section>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                  <Package className="h-4 w-4" /> Pedidos online
                </h4>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {ordersData!.orders.map((o: any) => (
                    <div key={o.id} className="flex items-center justify-between text-sm p-2.5 rounded-lg bg-muted/30">
                      <div>
                        <span className="font-mono text-xs text-muted-foreground">{o.order_number}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{fmtDate(o.created_at)}</span>
                      </div>
                      <span className="font-semibold">{fmt(Number(o.total))}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ── Página principal ──────────────────────────────────────────
function ClientesPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [segmentoFilter, setSegmentoFilter] = useState("todos");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["customers-list", q],
    queryFn: () => searchCustomers({ data: { q, limit: 100 } }),
  });

  const filtered = useMemo(() => {
    const list = data?.customers ?? [];
    if (segmentoFilter === "todos") return list;
    return list.filter((c: any) => c.segmento === segmentoFilter);
  }, [data, segmentoFilter]);

  // KPIs
  const stats = useMemo(() => {
    const all = data?.customers ?? [];
    return {
      total: all.length,
      vip: all.filter((c: any) => c.segmento === "vip").length,
      recurrente: all.filter((c: any) => c.segmento === "recurrente").length,
      nuevo: all.filter((c: any) => c.segmento === "nuevo").length,
    };
  }, [data]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold">Clientes</h1>
          <p className="text-muted-foreground mt-0.5">Directorio y CRM</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total clientes", value: stats.total },
          { label: "Nuevos",         value: stats.nuevo },
          { label: "Recurrentes",    value: stats.recurrente },
          { label: "VIP",            value: stats.vip },
        ].map(({ label, value }) => (
          <div key={label} className="bg-card border border-border/50 rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className="font-display text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre, documento, email o teléfono…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select value={segmentoFilter} onValueChange={setSegmentoFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Segmento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los segmentos</SelectItem>
            {Object.entries(SEGMENTO_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabla */}
      <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-14">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-14 text-muted-foreground text-sm">
            No se encontraron clientes.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/40">
                  {["Nombre", "Documento", "Contacto", "Segmento", "Cliente desde", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filtered.map((c: any) => {
                  const seg = SEGMENTO_CONFIG[c.segmento as Segmento] ?? SEGMENTO_CONFIG.nuevo;
                  return (
                    <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{c.nombre}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs font-mono">
                        {c.doc_tipo} {c.doc_numero}
                      </td>
                      <td className="px-4 py-3">
                        {c.email && <p className="text-xs text-muted-foreground">{c.email}</p>}
                        {c.telefono && <p className="text-xs text-muted-foreground">{c.telefono}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ color: seg.color, background: seg.bg }}
                        >
                          {seg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {fmtDate(c.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedId(c.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detalle modal */}
      {selectedId && (
        <ClienteDetalle
          customerId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
```

---

## 4. Actualizar el sidebar con link a CRM

El sidebar (`AppSidebar.tsx`) ya tiene el link a `/clientes`. Lo que falta es decidir qué hacer con `/crm`:

**Opción A — mantener `/crm` como está** (recursos externos): no toques nada, está en el sidebar bajo "Operación".

**Opción B — convertir `/crm` en el nuevo panel de clientes** y eliminar la ruta `/clientes` separada: renombra la ruta y actualiza el item del sidebar.

**Opción C — añadir `/crm` al sidebar apuntando al panel de clientes renovado**: actualiza el item existente de "Clientes" para que apunte a la nueva lógica. La página `/crm` con recursos externos puede quedar como submenú o eliminarse.

La opción más limpia para el usuario es la **A**, dejando el panel de Clientes mejorado en `/clientes` y `/crm` como está (o directamente borrando la ruta `/crm` si no la quieres).

Si quieres eliminar `/crm` del sidebar, edita `AppSidebar.tsx`:

```tsx
// Elimina o comenta esta línea del array items:
// { title: "CRM",      url: "/crm",      icon: ...,   roles: [...] },
```

---

## 5. Actualizar `upsertCustomer` para manejar los nuevos campos

La función actual ya funciona con los campos base. Para que también guarde `distrito` y `ciudad` al crear desde el POS:

```ts
// src/lib/pos.functions.ts — ampliar CustomerSchema
const CustomerSchema = z.object({
  doc_tipo: z.enum(["DNI", "RUC", "CE", "PASAPORTE"]),
  doc_numero: z.string().min(6).max(20).regex(/^[A-Z0-9]+$/i),
  nombre: z.string().min(1).max(255),
  email: z.string().email().max(255).optional().nullable().or(z.literal("")),
  telefono: z.string().max(30).optional().nullable(),
  direccion: z.string().max(500).optional().nullable(),
  distrito: z.string().max(100).optional().nullable(),   // nuevo
  ciudad: z.string().max(100).optional().nullable(),     // nuevo
});
```

---

## 6. Lógica de segmentación automática (opcional)

Puedes crear un cron o función SQL que actualice automáticamente el segmento según el comportamiento de compra:

```sql
-- Función para recalcular segmentos (ejecutar periodicamente o desde un cron)
CREATE OR REPLACE FUNCTION public.recalcular_segmentos()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- VIP: más de S/2000 en total
  UPDATE public.customers c
  SET segmento = 'vip'
  FROM public.v_customer_valor v
  WHERE v.id = c.id
    AND v.valor_total_cliente > 2000
    AND c.segmento <> 'inactivo';

  -- Recurrente: 2+ compras y no VIP
  UPDATE public.customers c
  SET segmento = 'recurrente'
  FROM public.v_customer_valor v
  WHERE v.id = c.id
    AND (v.total_compras_pos + v.total_pedidos_online) >= 2
    AND v.valor_total_cliente <= 2000
    AND c.segmento NOT IN ('vip', 'inactivo');

  -- Inactivo: sin actividad en 180 días
  UPDATE public.customers c
  SET segmento = 'inactivo'
  FROM public.v_customer_valor v
  WHERE v.id = c.id
    AND (v.ultima_actividad IS NULL OR v.ultima_actividad < now() - interval '180 days')
    AND c.segmento NOT IN ('vip');
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalcular_segmentos() TO authenticated;
```

Puedes llamarla manualmente desde el panel o programarla como cron de Supabase.

---

## 7. Lista de verificación

### Base de datos
- [ ] `ALTER TABLE customers ADD COLUMN segmento, notas, tags, fecha_ultimo_contacto, distrito, ciudad`
- [ ] Crear vista `v_customer_valor`
- [ ] (Opcional) Crear función `recalcular_segmentos()`

### Backend (`pos.functions.ts`)
- [ ] Ampliar `searchCustomers` (más campos, búsqueda por email y teléfono)
- [ ] Añadir `getCustomerValor()`
- [ ] Añadir `getCustomerSales()`
- [ ] Añadir `getCustomerOrders()`
- [ ] Añadir `updateCustomerCrm()`
- [ ] Ampliar `CustomerSchema` con `distrito` y `ciudad`

### Frontend
- [ ] Reemplazar `src/routes/_authenticated/clientes.tsx` con la implementación completa
- [ ] Verificar que `Textarea` esté importado en `clientes.tsx` (es un componente shadcn/ui que ya existe en `src/components/ui/`)
- [ ] Decidir qué hacer con `/crm` (mantener, eliminar o redirigir)

### Verificación funcional
- [ ] Lista de clientes carga con los nuevos campos de segmento
- [ ] Filtro por segmento funciona
- [ ] Búsqueda por email y teléfono funciona
- [ ] Click en ojo abre el detalle 360° del cliente
- [ ] KPIs de valor total muestran suma de POS + online
- [ ] Editar segmento y notas guarda correctamente
- [ ] Historial de compras POS aparece en el detalle
- [ ] Historial de pedidos online aparece (si el cliente tiene email en `orders`)

---

## 8. Notas importantes

**La vista `v_customer_valor` une POS y online por email.** Esto funciona cuando el cliente en tienda tiene el mismo email que usó al comprar online. Si no tiene email registrado en `customers`, el historial online no se mostrará. Para mejorar esta vinculación a futuro, añade el campo `customer_id` en `orders` y crea un FK.

**`createStaffUser` en `pos.functions.ts` usa `VITE_SUPABASE_SERVICE_KEY`** — una service key expuesta al browser es un riesgo de seguridad. Este patrón fue construido así en el proyecto original. Si quieres moverlo al servidor Express, la función de creación de usuarios debería ir en `server/index.js` usando la `SUPABASE_SECRET_KEY` del env del servidor (que no se expone al browser).

**El primer usuario que se registra en Supabase recibe rol `admin` automáticamente** (trigger `handle_new_user`). Los siguientes reciben `vendedor` por defecto. Puedes cambiar esto en la migración `20260529080048`.