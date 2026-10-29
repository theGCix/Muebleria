# Correo de confirmación con n8n local y servidor en Render (sin túnel)

Tu servidor vive en Render y n8n en tu PC. En vez de que Render busque a n8n (lo que exigiría un túnel), **n8n consulta a Supabase cada minuto**: todo es de "salida" desde tu PC, así que no hace falta exponer nada a internet.

```
Cliente paga → el servidor (Render) guarda el pedido en Supabase
                         ▲
                         │  cada minuto
                    n8n (tu PC): ¿hay pedidos pagados sin correo? → envía el correo (Gmail) → los marca
```

**Ventajas**
- Sin túnel, sin URL pública, sin tocar Render.
- Si tu PC estuvo apagada, al encenderla n8n envía los correos pendientes (hasta 3 días atrás). Nada se pierde.

**A tener en cuenta**
- El correo sale entre 2 y 3 minutos después del pago (el flujo espera 2 min para que el pedido termine de guardarse con sus productos).
- n8n debe estar encendido y el flujo *Active*. Si no, los correos se acumulan y salen al volver.
- No pongas `N8N_PEDIDO_PAGADO_URL` en Render: el aviso directo del servidor no se usa en este modo (si no hay variable, se salta solo).

## Puesta en marcha

### 1. Base de datos (una sola vez)
En Supabase → *SQL Editor*, ejecuta `supabase/migrations/20261029_correo_confirmacion.sql` (o `supabase db push`). Agrega la columna `correo_confirmacion_enviado_at` y **marca todos los pedidos actuales como ya avisados**, para no escribirles a clientes antiguos.

### 2. Importar el flujo
n8n → *Import from file* → `n8n/pedido-pagado-correo-polling.workflow.json`.
(Si tenías activo `pedido-pagado-correo.workflow.json`, desactívalo: este lo reemplaza.)

### 3. Credenciales
- **Supabase G&M** (tipo *Header Auth*): Name `apikey`, Value = la clave **service_role** (Supabase → Project Settings → API). Es secreta: solo vive en tu n8n; nunca en el frontend. Asígnala a los nodos *Pedidos por avisar* y *Marcar como avisado*.
- **Gmail G&M** (SMTP): la que ya tienes, en *Enviar correo al cliente*.

### 4. Editar 3 datos
- En los nodos *Pedidos por avisar* y *Marcar como avisado*: cambia `TU_PROYECTO` por el identificador de tu proyecto (la URL de Supabase es `https://ESTE-VALOR.supabase.co`).
- En *Armar correos*: `SITE_URL` (la dirección de tu tienda) (el remitente `REMITENTE_EMAIL` ya es proyectomuebleria1@gmail.com: debe ser la misma cuenta de la credencial).

### 5. Probar
1. En Supabase, elige un pedido reciente tuyo (con tu correo) y márcalo como pendiente de aviso:
   ```sql
   update orders set correo_confirmacion_enviado_at = null where order_number = 'GM-XXXX';
   ```
   (el pedido debe tener menos de 3 días y más de 2 minutos; si es más antiguo, haz esta prueba con una compra nueva).
2. En n8n pulsa **Execute workflow**: debe llegar el correo a tu bandeja y el pedido quedar marcado.
3. Activa el flujo (*Active*). Desde ahí funciona solo.

### Cómo saber que va bien
- *Executions* en n8n: una ejecución por minuto; casi todas terminan al instante sin pedidos nuevos.
- En Supabase: los pedidos nuevos pasan a tener `correo_confirmacion_enviado_at` con fecha.

## Si algo falla
- **401/403 en "Pedidos por avisar":** la clave de la credencial es incorrecta, o no es la service_role.
- **Error "column ... does not exist":** falta ejecutar el SQL del paso 1.
- **No llega correo pero el flujo termina:** el pedido no tiene correo válido, tiene menos de 2 minutos, o ya estaba marcado.
- **Llegan correos repetidos:** el envío funcionó pero falló el marcado. Revisa el nodo *Marcar como avisado* (sobre todo el `TU_PROYECTO`).
