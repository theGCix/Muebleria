# Correo de confirmación de pago al cliente

Cuando un cliente paga, n8n le envía un correo con el resumen de su pedido (productos, montos, entrega y botón "Ver mi pedido").

```
Cliente paga → el servidor guarda el pedido → POST a n8n → correo desde tu Gmail al cliente
```

Archivos: `pedido-pagado-correo.workflow.json` (flujo para importar), `armar-correo.js` (el código del correo) y `armar-correo.test.js` (pruebas).

> Este flujo y el de WhatsApp (`pedido-pagado.workflow.json`) usan **el mismo webhook** (`/webhook/gm-pedido-pagado`): activa solo uno a la vez. Cuando quieras ambos, se unen en un solo flujo con dos ramas.

## Requisitos
- Tu credencial SMTP de Gmail en n8n (la que ya probaste).
- El servidor avisando a n8n: `server/notificaciones.js` (parche `n8n-pedido-pagado`) y, en Render, `N8N_PEDIDO_PAGADO_URL` y `N8N_WEBHOOK_SECRET`. Para probar solo en tu PC no necesitas Render: usa el paso 4.

## Puesta en marcha
1. **Importar:** n8n → *Workflows → Import from file* → `n8n/pedido-pagado-correo.workflow.json`.
2. **Credenciales:**
   - Nodo *Pedido pagado (webhook)*: crea una credencial **Header Auth** llamada `G&M webhook secret` con Name `x-webhook-secret` y Value = una contraseña larga (la misma irá en Render como `N8N_WEBHOOK_SECRET`).
   - Nodo *Enviar correo al cliente*: elige tu credencial SMTP de Gmail.
3. **Remitente:** en el nodo *Armar correo* cambia `REMITENTE_EMAIL` por tu cuenta Gmail (la misma de la credencial; si no coincide, Gmail cambia el remitente).
4. **Probar** (PowerShell, con el flujo abierto y *Listen for test event* activado en el webhook; pon tu correo para recibirlo):
   ```powershell
   $body = @{
     evento = "pedido_pagado"
     pedido = @{ numero = "GM-PRUEBA"; nombre = "Tu Nombre"; email = "TU_CORREO@gmail.com"; subtotal = 1100; envio = 150; total = 1250
                 metodo_entrega = "domicilio"; direccion = "Av. Larco 123"; distrito = "Miraflores"; requiere_cotizar_flete = $false }
     items  = @(@{ titulo = "Sofá London"; cantidad = 1; total = 1100 })
     enlaces = @{ cliente_pedidos = "http://localhost:5173/perfil/pedidos" }
   } | ConvertTo-Json -Depth 5
   Invoke-RestMethod -Method Post -Uri "http://localhost:5678/webhook-test/gm-pedido-pagado" `
     -Headers @{ "x-webhook-secret" = "TU_SECRETO" } -ContentType "application/json; charset=utf-8" `
     -Body ([System.Text.Encoding]::UTF8.GetBytes($body))
   ```
   Revisa tu bandeja (y spam la primera vez). Prueba también con `requiere_cotizar_flete = $true` y con `metodo_entrega = "recojo_tienda"` para ver las otras variantes.
5. **Activar:** interruptor *Active* del flujo. La URL *Production* del webhook es la que va en `N8N_PEDIDO_PAGADO_URL` (con túnel: ver `LOCAL-Y-TUNEL.md`).

## Qué dice el correo según el pedido
| Caso | Entrega | Envío |
|---|---|---|
| Domicilio en Lima | dirección y fecha estimada (si existe) | monto |
| Provincia por cotizar | "te escribiremos para confirmar costo y agencia" | "Por confirmar" |
| Recojo en tienda | "te avisaremos cuando esté listo" | "Recojo sin costo" |

Si el pedido trae cupón, se muestra la línea de descuento. Si el cliente no tiene un correo válido, el flujo termina sin enviar ni dar error.

## Notas
- **Límite de Gmail:** unos 500 correos al día en cuentas gratuitas. Si el volumen crece o los correos caen en spam, pasa a Resend (ya está en tu proyecto): solo cambia el nodo de envío.
- El correo no promete plazos: solo muestra la fecha estimada si el pedido la tiene.
- Para recibir una copia en el negocio, en el nodo *Enviar correo al cliente* → *Options* → *BCC Email*.
