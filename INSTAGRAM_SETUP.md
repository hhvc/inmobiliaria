# Integración Instagram

La integración usa Instagram API con Instagram Login y Cloud Functions en
`southamerica-east1`. Una sola aplicación de Meta administra dos destinos:

- La cuenta central de Onoprop, conectada únicamente por un usuario `root`.
- Una cuenta profesional propia por inmobiliaria, disponible cuando la
  suscripción incluye el módulo `instagram`.

Los tokens se almacenan cifrados con AES-256-GCM y nunca se entregan al
navegador.

## 1. Aplicación de Meta

En la aplicación de Onoprop, abrir **Instagram > API setup with Instagram
login** y configurar Business Login for Instagram.

Usar las credenciales que Meta muestra dentro de este producto de Instagram.
El Instagram App ID/Secret puede no coincidir con otras credenciales de la
aplicación principal.

Permisos mínimos:

- `instagram_business_basic`
- `instagram_business_content_publish`

URLs exactas:

- OAuth Redirect URI:

  `https://southamerica-east1-inmobiliaria-bcc63.cloudfunctions.net/instagramOAuthCallback`

- Deauthorize Callback URL:

  `https://southamerica-east1-inmobiliaria-bcc63.cloudfunctions.net/instagramDeauthorize`

- Data Deletion Request URL:

  `https://southamerica-east1-inmobiliaria-bcc63.cloudfunctions.net/instagramDataDeletion`

- Privacy Policy URL:

  `https://onoprop.com/privacidad`

- Terms of Service URL:

  `https://onoprop.com/terminos`

- User Data Deletion Instructions:

  `https://onoprop.com/eliminacion-de-datos`

En **App domains** usar `onoprop.com` (sin protocolo ni ruta) y en
**Category** seleccionar `Business and Pages` / `Empresa y páginas`.

Para las pruebas iniciales, agregar la cuenta profesional de Onoprop como
tester o cuenta administrada por la aplicación. Las cuentas deben ser Business
o Creator; las cuentas personales no pueden publicar mediante esta API.

La cuenta central puede probarse con Standard Access. Antes de permitir que
inmobiliarias externas conecten sus cuentas, solicitar Advanced Access para
los permisos anteriores y completar App Review.

## 2. Secretos de Firebase

Configurar los cuatro secretos:

```powershell
firebase functions:secrets:set INSTAGRAM_APP_ID
firebase functions:secrets:set INSTAGRAM_APP_SECRET
firebase functions:secrets:set INSTAGRAM_REDIRECT_URI
firebase functions:secrets:set INSTAGRAM_TOKEN_ENCRYPTION_KEY
```

El valor de `INSTAGRAM_REDIRECT_URI` debe ser exactamente:

`https://southamerica-east1-inmobiliaria-bcc63.cloudfunctions.net/instagramOAuthCallback`

La clave de cifrado debe contener 32 bytes aleatorios codificados en base64 o
64 caracteres hexadecimales. Para generarla en PowerShell:

```powershell
$keyBytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Fill($keyBytes)
[Convert]::ToBase64String($keyBytes)
```

Conservar el `=` final si aparece. Si se pierde la clave, las cuentas deberán
volver a conectarse.

## 3. Modelo comercial

- Toda inmobiliaria activa puede enviar un inmueble a la cola de Onoprop.
- Sólo un usuario `root` puede conectar la cuenta central, aprobar, rechazar y
  publicar las solicitudes.
- Para publicar en la cuenta propia, la inmobiliaria debe tener el módulo
  `instagram` dentro de `modulosSuscriptos`.
- El módulo se habilita desde **Usuarios y suscripciones**.

El backend vuelve a comprobar estos permisos antes de publicar. Ocultar un
botón en el navegador no se considera un control de autorización.

## 4. Almacenamiento privado

Rutas principales:

- `platform_private_integrations/instagram_onoprop`
- `inmobiliarias/{inmobiliariaId}/privateIntegrations/instagram`
- `instagram_account_connections/{instagramUserId}`
- `instagram_oauth_states/{state}`
- `instagram_onoprop_publication_requests/{requestId}`
- `inmobiliarias/{inmobiliariaId}/inmuebles/{inmuebleId}/private/instagram`
- `instagram_data_deletion_requests/{confirmationCode}`

Las reglas de Firestore cierran estas rutas para clientes y las Cloud Functions
acceden mediante Firebase Admin.

Configurar TTL para:

- `instagram_oauth_states`, campo `expiresAt`.
- `instagram_data_deletion_requests`, campo `expiresAt`.

La función programada `instagramMaintainConnections` se ejecuta diariamente a
las 03:15 (`America/Argentina/Buenos_Aires`) y actúa como segunda barrera:

- renueva los tokens que están a siete días o menos de vencer;
- conserva la conexión ante errores transitorios para reintentar al día
  siguiente;
- marca para reconexión los tokens ausentes, dañados o vencidos;
- reconstruye los vínculos privados para los distintos identificadores que
  Meta puede devolver;
- elimina por lotes estados OAuth y comprobantes de eliminación vencidos.

La limpieza programada no reemplaza la configuración TTL de Firestore, pero
evita que una demora o una omisión del TTL deje documentos temporales
indefinidamente.

## 5. Publicación

La primera versión publica:

- Una imagen.
- Carruseles de 2 a 10 imágenes.
- Caption editable de hasta 2200 caracteres.

Meta descarga cada imagen desde su URL. Por eso las imágenes del inmueble deben
ser accesibles públicamente mediante HTTPS.

La pantalla **Difusión** permite:

- Conectar/desconectar la cuenta propia.
- Conectar/desconectar la cuenta central cuando el usuario es `root`.
- Seleccionar y ordenar implícitamente las imágenes según el orden del
  inmueble.
- Publicar en la cuenta propia.
- Enviar a la cola central de Onoprop.
- Probar una cuenta conectada mediante una llamada real a Instagram, sin crear
  contenido, con el botón **Probar con Meta**.

La cola root está en:

`/admin/inmuebles/instagram-onoprop`

## 6. Despliegue y prueba

Validar:

```powershell
npm --prefix functions run lint
npm run lint
npm run test:instagram
npm run build
```

Desplegar primero las funciones para que las URLs registradas en Meta respondan:

```powershell
firebase deploy --only functions
firebase deploy --only hosting
```

Prueba inicial:

1. Conectar la cuenta profesional de Onoprop desde Difusión con un usuario
   `root`.
2. Seleccionar un inmueble con imágenes públicas.
3. Enviarlo a Onoprop.
4. Abrir la cola root y aprobarlo.
5. Confirmar el permalink publicado.
6. Habilitar el módulo `Instagram propio` a una inmobiliaria piloto.
7. Conectar su cuenta profesional.
8. Publicar el mismo inmueble en su cuenta.
9. Desconectar ambas cuentas y comprobar que ya no se pueda publicar.

Reels, Stories, comentarios, mensajes, insights y publicidad paga quedan fuera
de esta primera versión.
