# Integración Mercado Libre

La integración usa Cloud Functions en `southamerica-east1`. Los tokens de cada
seller se almacenan cifrados con AES-256-GCM y nunca se entregan al navegador.

## 1. Aplicación de Mercado Libre

Crear o editar la aplicación en el panel de desarrolladores de Mercado Libre:

- Sitio: Argentina (`MLA`).
- Flujo: Authorization Code.
- PKCE: habilitado.
- Redirect URI exacta:

  `https://southamerica-east1-inmobiliaria-bcc63.cloudfunctions.net/mercadoLibreOAuthCallback`

- Callback de notificaciones:

  `https://southamerica-east1-inmobiliaria-bcc63.cloudfunctions.net/mercadoLibreNotifications`

- Tópicos:
  - `items`
  - `vis_leads`: `whatsapp`, `call`, `question`, `Visit Request` y
    `quotations`.

No habilitar los tópicos independientes `questions` ni `quotations`: las
preguntas se reciben por `vis_leads.question` y el tópico antiguo de
cotizaciones será discontinuado por Mercado Libre.

La cuenta que autoriza debe ser administradora de Mercado Libre y debe contar
con un paquete inmobiliario con cupos disponibles.

## 2. Secretos de Firebase

Configurar los cuatro secretos sin guardarlos en `.env`:

```powershell
firebase functions:secrets:set MERCADOLIBRE_CLIENT_ID
firebase functions:secrets:set MERCADOLIBRE_CLIENT_SECRET
firebase functions:secrets:set MERCADOLIBRE_REDIRECT_URI
firebase functions:secrets:set MERCADOLIBRE_TOKEN_ENCRYPTION_KEY
```

`MERCADOLIBRE_REDIRECT_URI` debe coincidir exactamente con la URL registrada en
Mercado Libre.

La clave `MERCADOLIBRE_TOKEN_ENCRYPTION_KEY` debe contener 32 bytes aleatorios
codificados en base64 o 64 caracteres hexadecimales. Ejemplo para generar una
clave base64 en PowerShell:

```powershell
$keyBytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Fill($keyBytes)
[Convert]::ToBase64String($keyBytes)
```

Guardar la clave resultante en Secret Manager. Si se pierde, no se podrán
descifrar las conexiones existentes y cada inmobiliaria tendrá que reconectar
su cuenta.

## 3. Despliegue

Validar y desplegar:

```powershell
npm --prefix functions run lint
firebase deploy --only functions
```

No se debe desplegar solamente el callback: las operaciones de publicación y
el webhook comparten el mismo gestor de tokens.

## 4. Firestore

Los documentos privados utilizados son:

- `inmobiliarias/{inmobiliariaId}/privateIntegrations/mercadolibre`
- `inmobiliarias/{inmobiliariaId}/inmuebles/{inmuebleId}/private/mercadolibre`
- `mercadolibre_seller_connections/{sellerId}`
- `mercadolibre_item_links/{itemId}`
- `mercadolibre_oauth_states/{state}`
- `mercadolibre_notification_queue/{notificationId}`
- `inmobiliarias/{inmobiliariaId}/privateIntegrations/mercadolibre/leads/{leadId}`

Las reglas actuales cierran por defecto estas rutas para clientes. Firebase
Admin accede desde las Cloud Functions.

En Firestore se recomienda habilitar una política TTL para la colección
`mercadolibre_oauth_states`, usando el campo `expiresAt`, y otra para
`mercadolibre_notification_queue`, también usando `expiresAt`.

El webhook solo valida y persiste la notificación antes de responder HTTP 200.
La función `mercadoLibreProcessNotification` procesa en segundo plano los
cambios de publicaciones y los leads. Esto evita que una consulta a la API de
Mercado Libre retrase la confirmación del webhook.

## 5. Prueba controlada

1. Usar una cuenta y un inmueble de prueba.
2. Conectar Mercado Libre desde la pantalla de difusión.
3. Recorrer la categoría de inmuebles hasta una categoría final.
4. Seleccionar ubicación, tipo de paquete y completar los datos faltantes.
5. Ejecutar **Validar con Mercado Libre**.
6. Revisar el JSON que devuelve `/items/validate`.
7. Confirmar **Publicar ahora** únicamente con un cupo de prueba disponible.
8. Comprobar actualización, pausa, reactivación y sincronización.
9. Cambiar el estado desde Mercado Libre y verificar que el webhook actualice
   LaDoctaProp.
10. Generar un contacto de prueba y comprobar que aparezca en
    **Inmuebles → Leads de Mercado Libre**.
11. Cambiar el seguimiento del lead entre `Nuevo`, `Contactado` y `Cerrado`.
12. Responder una pregunta de prueba desde LaDoctaProp y comprobarla en Mercado
    Libre.
13. Usar **Sincronizar últimos 30 días** para comprobar la recuperación manual
    de leads.

Cerrar una publicación es una acción definitiva en Mercado Libre y no debe
usarse como reemplazo de una pausa.
