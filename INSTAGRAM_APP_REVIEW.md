# Revisión de la aplicación de Instagram

Guía de preparación para solicitar acceso avanzado a:

- `instagram_business_basic`
- `instagram_business_content_publish`

No solicitar en esta primera revisión permisos de mensajes, comentarios,
insights, publicidad, Reels o Stories.

## Estado técnico comprobado

- Instagram Login completa correctamente el OAuth.
- La cuenta profesional queda vinculada al destino correcto de OnoProp.
- El token se almacena cifrado y nunca se entrega al navegador.
- La publicación de una imagen fue completada y se obtuvo su permalink.
- Están configuradas las URLs de redirección, desautorización y eliminación de
  datos.

El contador de llamadas de Meta puede demorar en reflejar las llamadas. Antes
de enviar la revisión, comprobar que el panel no muestre requisitos pendientes.

## Caso de uso principal para la revisión

La demostración debe centrarse en una inmobiliaria suscripta que conecta su
propia cuenta profesional de Instagram y publica un inmueble mediante el botón
**Publicar en mi Instagram**.

La cola de publicación en la cuenta central de Onoprop es una funcionalidad
adicional. No debe ser el único flujo mostrado, porque la necesidad de acceso
avanzado surge de permitir la conexión de cuentas pertenecientes a
inmobiliarias clientes.

## Entorno de revisión

Preparar antes de grabar o enviar:

- Un usuario de OnoProp dedicado al revisor, sin datos personales reales.
- Rol `admin` y acceso únicamente a una inmobiliaria de demostración.
- Módulos `inmuebles` e `instagram` habilitados.
- Permiso interno para editar inmuebles.
- Un inmueble de demostración, claramente identificado como prueba.
- Una o más imágenes públicas HTTPS que puedan ser descargadas por Meta.
- Una cuenta Instagram Business o Creator de demostración distinta de la
  cuenta central `@ono.prop`.
- Esa cuenta agregada como tester de la aplicación y con la invitación
  aceptada mientras la aplicación permanezca en modo desarrollo.

No guardar contraseñas ni tokens de prueba en este archivo o en el
repositorio. Las credenciales del portal se informan únicamente en el
formulario privado de revisión de Meta.

## Descripción general de la aplicación

Texto sugerido para pegar en Meta:

```text
OnoProp is a multi-tenant real estate management platform used by subscribed
real estate agencies in Argentina. An authorized agency administrator can
connect the agency's own Instagram Professional account through Instagram
Business Login. The administrator then selects a property owned or managed by
the agency, reviews the images and caption, and explicitly publishes that
content to the connected Instagram account.

OnoProp also allows an agency to submit a property to the central OnoProp
Instagram publication queue. Central-account content is not published
automatically: it must be reviewed and approved by an authorized OnoProp
administrator.

The first version only supports professional-account identification and
user-initiated publishing of single-image posts and image carousels. It does
not use Instagram messages, comments, insights, advertising, Stories or Reels.
```

## `instagram_business_basic`

### Justificación

```text
OnoProp uses instagram_business_basic after the agency administrator explicitly
authorizes the connection through Instagram Business Login. The application
retrieves the professional account identifiers, username and account type.

This information is required to identify the Instagram Professional account,
show the connected username inside OnoProp, associate the account with the
correct real estate agency tenant, prevent the same Instagram account from
being connected to two different OnoProp destinations, and address subsequent
publishing requests to the correct Instagram account.

OnoProp does not use this permission to access consumer Instagram accounts.
Access tokens are encrypted at rest, are never exposed to the browser and can
be revoked by disconnecting Instagram from OnoProp or through Meta.
```

### Evidencia que debe verse en el video

1. La inmobiliaria está inicialmente **Sin conectar**.
2. El usuario pulsa **Conectar Instagram propio**.
3. Aparece Instagram Login y se autoriza la cuenta profesional.
4. OnoProp vuelve a la pantalla **Difusión**.
5. La cuenta aparece **Conectada** y se muestra su `@username`.

## `instagram_business_content_publish`

### Justificación

```text
OnoProp uses instagram_business_content_publish so an authorized real estate
agency administrator can publish property marketing content to the agency's own
connected Instagram Professional account.

The user opens a property in OnoProp, enters the Distribution screen, reviews
or edits the caption, selects between one and ten property images, and clicks
"Publicar en mi Instagram". OnoProp's backend creates the required media
container, waits until Instagram finishes processing it and publishes it only
after that explicit user action. OnoProp supports one image or an image
carousel.

The application does not publish arbitrary third-party content and does not
perform unattended or scheduled publishing in this version. For the separate
central OnoProp account, submissions enter a queue and require approval by an
authorized OnoProp administrator before publication.
```

### Evidencia que debe verse en el video

1. Desde **Inmuebles**, abrir el inmueble de demostración mediante
   **Difusión**.
2. Abrir el canal **Instagram**.
3. Mostrar el texto de la publicación.
4. Seleccionar al menos una imagen.
5. Pulsar **Publicar en mi Instagram** y confirmar.
6. Esperar a que el estado indique que fue publicado.
7. Pulsar **Ver publicación** y mostrar el post resultante en Instagram.

## Instrucciones para el revisor

Reemplazar únicamente los valores entre corchetes antes de pegar:

```text
1. Open https://onoprop.com/login
2. Sign in with the OnoProp reviewer credentials supplied in the App Review
   form:
   Email: [REVIEWER_PORTAL_EMAIL]
   Password: [REVIEWER_PORTAL_PASSWORD]
3. Open https://onoprop.com/admin/inmuebles/listado
4. Locate the property named "[REVIEW_PROPERTY_TITLE]" and click "Difusión".
5. In "Cuentas de Instagram", click "Conectar Instagram propio".
6. Complete Instagram Business Login with an Instagram Professional account
   and authorize the two requested permissions.
7. Return to OnoProp and verify that the account is shown as "Conectada" with
   its Instagram username.
8. Scroll to the Instagram channel. Review the caption and select at least one
   image.
9. Click "Publicar en mi Instagram" and confirm the action.
10. Wait for the published status and click "Ver publicación" to open the
    resulting Instagram post.

The reviewer user is restricted to a demonstration real estate agency. The
property and its media are test content prepared specifically for this review.
If assistance is required, contact [REVIEW_CONTACT_EMAIL].
```

## Guion para el video

Grabar un único video corto y legible, preferentemente en una ventana privada:

1. Mostrar `https://onoprop.com/login`.
2. Iniciar sesión con el usuario de revisión.
3. Abrir **Inmuebles** y pulsar **Difusión** en el inmueble de prueba.
4. Mostrar **Instagram de la inmobiliaria — Sin conectar**.
5. Pulsar **Conectar Instagram propio**.
6. Mostrar la pantalla de autorización alojada por Instagram y aceptar.
7. Mostrar el regreso a OnoProp y el estado **Conectada**.
8. Mostrar el caption y la selección de imágenes.
9. Pulsar **Publicar en mi Instagram**.
10. Mostrar el estado final y abrir **Ver publicación**.

Evitar cortes que oculten el OAuth o la acción de publicación. No mostrar
contraseñas, tokens, secretos, Firebase Console ni código fuente.

## URLs públicas

- Portal: `https://onoprop.com`
- Inicio de sesión: `https://onoprop.com/login`
- Política de privacidad: `https://onoprop.com/privacidad`
- Condiciones del servicio: `https://onoprop.com/terminos`
- Eliminación de datos: `https://onoprop.com/eliminacion-de-datos`
- OAuth callback:
  `https://southamerica-east1-inmobiliaria-bcc63.cloudfunctions.net/instagramOAuthCallback`
- Deauthorize callback:
  `https://southamerica-east1-inmobiliaria-bcc63.cloudfunctions.net/instagramDeauthorize`
- Data deletion callback:
  `https://southamerica-east1-inmobiliaria-bcc63.cloudfunctions.net/instagramDataDeletion`

## Control previo al envío

- Los dos permisos están añadidos al mismo borrador de revisión.
- Los contadores o requisitos de llamadas de prueba están completos.
- La verificación comercial continúa vigente.
- La verificación como proveedor de tecnología está completada si el panel la
  exige para acceder a datos de empresas clientes.
- El nombre legal, correo de contacto y datos de la empresa coinciden entre
  OnoProp, las páginas legales y el portfolio empresarial de Meta.
- Las credenciales privadas del usuario revisor funcionan en una ventana
  privada.
- El usuario revisor sólo ve datos de demostración.
- La cuenta profesional usada en la grabación no está conectada simultáneamente
  como cuenta central de Onoprop.
- El video muestra el OAuth, el uso de ambos permisos y la publicación final.
- El post de demostración sigue disponible durante la revisión.
- No se solicitaron permisos que todavía no usa la aplicación.
