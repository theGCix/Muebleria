# Carrito abandonado con n8n (sin túnel)

Mismo patrón que el correo de confirmación de pago: **n8n consulta a Supabase** (todo es de "salida" desde tu PC, no se expone nada).

```
Cliente deja su carrito → la web lo guarda en `carritos` (ya existe: syncCartSnapshot)
                              ▲
                              │  cada 10 min
                         n8n: ¿carritos con correo y sin actividad? → (cupón) → correo (Gmail) → los marca
```

## Qué recibe el cliente

| Cuándo | Correo |
|---|---|
| ≈ 1 h sin actividad | **Paso 1** — recordatorio con sus productos y botón "Completar mi pedido" |
| ≥ 24 h sin actividad (y ≥ 12 h después del paso 1) | **Paso 2** — mismo carrito + cupón `VUELVE-XXXXXXXX` de 5 %, 48 h, un solo uso |

- Solo se escribe a carritos con **correo válido** (el correo se captura en el checkout). Los carritos sin correo se pueden seguir contactando por WhatsApp desde *Carritos abandonados*.
- Si el cliente compra, `markCartRecovered` ya cierra el carrito (`recuperado`) y n8n lo ignora.
- Si el cliente vuelve a mover su carrito, los avisos se reinician (cambio en `syncCartSnapshot`).
- Si tu PC estuvo apagada, al volver n8n envía lo pendiente (hasta 3 días atrás).
- Los enlaces llevan `utm_source=n8n&utm_medium=email&utm_campaign=carrito_abandonado&utm_content=pasoN`, así los ves en GA4 y en `eventos_web`.
- En el panel admin, el carrito pasa a **Contactado** y `recordatorio_enviado = true`.

## Puesta en marcha (en este orden)

### 1. Base de datos — antes de desplegar la web
Supabase → *SQL Editor* → ejecuta `supabase/migrations/20261030_carrito_abandonado_n8n.sql`.
Agrega `recordatorio_1_at` y `recordatorio_2_at`, y **marca los carritos actuales como ya atendidos** para no escribirles a visitantes antiguos.

> Despliega el frontend **después** de este SQL: `syncCartSnapshot` ahora escribe esas dos columnas y, si no existen, el guardado de carritos falla en silencio.

### 2. Importar el flujo
n8n → *Import from file* → `n8n/carrito-abandonado.workflow.json`.

### 3. Credenciales
Las mismas del correo de pago: **Supabase G&M** (Header Auth, `apikey` = service_role) en *Carritos por avisar*, *Crear cupón* y *Marcar como avisado*; **Gmail G&M** (SMTP) en *Enviar correo al cliente*.

### 4. Editar
- `TU_PROYECTO` en los 3 nodos de Supabase.
- En *Armar correos*: `SITE_URL` (ya viene con `https://muebleria-q74c.onrender.com`; cámbiala si usas otro dominio), y si quieres `CUPON_PORCENTAJE`, `CUPON_HORAS`, `HORAS_PASO_2`.

### 5. Probar
1. Con una ventana de incógnito, agrega un producto, pon tu correo en el checkout y no pagues.
2. En Supabase: `update carritos set last_activity_at = now() - interval '2 hours' where email = 'tu@correo.com';`
3. En n8n: **Execute workflow** → debe llegar el paso 1 y el carrito quedar `contactado`.
4. Para el paso 2: `update carritos set last_activity_at = now() - interval '30 hours', recordatorio_1_at = now() - interval '20 hours' where email = 'tu@correo.com';` → Execute workflow → llega con cupón y aparece en *Cupones* (origen `carrito_abandonado`).
5. Activa el flujo (*Active*).

## Si algo falla
- **401/403 en "Carritos por avisar":** la clave no es la service_role.
- **Error en "Crear cupón" (400):** la tabla `cupones` tiene alguna columna obligatoria distinta a las del formulario del admin; revisa el mensaje y ajusta el objeto `cupon` en *Armar correos*.
- **No llega nada:** el carrito no tiene correo válido, tiene < 1 h de inactividad, o ya fue marcado.
- **Llegan correos repetidos:** falló el nodo *Marcar como avisado* (revisa `TU_PROYECTO`).

## No lo mezcles con la Edge Function
`supabase/functions/recordatorios-carrito` hace lo mismo por otra vía y depende de una vista (`v_carritos_pendientes_paso`) que no está en las migraciones del repo. **No la programes** si usas este flujo, o el cliente recibiría recordatorios duplicados.

## Tests
`node --test n8n/*.test.js`
