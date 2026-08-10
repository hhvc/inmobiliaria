# Módulo tributario de ONO Prop

## Objetivo

Centralizar obligaciones asociadas a inmuebles sin acoplar el producto a una jurisdicción. El MVP funciona con carga manual y enlaces oficiales. Cada organismo podrá incorporar luego un conector sin modificar el modelo operativo.

## Entidades

### Objeto fiscal

Representa un inmueble ante un organismo recaudador. Conserva el inmueble de ONO Prop, identificador fiscal, jurisdicción, organismo, autorización del propietario, recordatorios y estado de integración.

Ruta: `/inmobiliarias/{inmobiliariaId}/tax_objects/{taxObjectId}`.

### Obligación tributaria

Representa un período exigible: concepto, período, vencimiento, importe, estado, cedulón, enlace de pago y evidencia.

Ruta: `/inmobiliarias/{inmobiliariaId}/tax_obligations/{obligationId}`.

### Evento de auditoría

Registro inmutable de altas, cambios, pagos y archivos. No contiene credenciales ni secretos de organismos.

Ruta: `/inmobiliarias/{inmobiliariaId}/tax_events/{eventId}`.

### Configuración y avisos automáticos

Cada inmobiliaria dispone de una configuración propia en
`tax_notification_settings/default` y avisos inmutables en `tax_notifications`.
El usuario solamente puede marcar un aviso como leído; las altas las realiza el
backend con identificadores determinísticos.

La función `taxProcessDueReminders` se ejecuta diariamente a las 06:30 de
Argentina y:

1. Procesa exclusivamente inmobiliarias activas con el módulo `tributos`.
2. Respeta los días de aviso configurados en cada objeto fiscal.
3. Genera una sola alerta de mora por obligación y actualiza su estado a vencida.
4. Evita duplicados aunque Cloud Scheduler reintente la ejecución.
5. Agrupa las alertas nuevas en un único correo diario por inmobiliaria.
6. Mantiene el correo desactivado hasta que un administrador lo habilite y defina
   destinatarios.

El canal WhatsApp queda identificado como `not_configured`, listo para una etapa
posterior sin simular que actualmente existe envío automático.

## Contrato de un futuro conector

Un adaptador por proveedor deberá implementar, según los permisos concedidos:

1. Resolver el identificador externo a partir del identificador fiscal.
2. Consultar resumen del objeto.
3. Sincronizar deuda y vencimientos de forma idempotente.
4. Obtener cedulón o URL oficial, si existe.
5. Obtener enlace oficial de pago, sin cobrar fondos en ONO Prop.
6. Reconciliar la acreditación del pago.
7. Informar salud, fecha y error sanitizado de la integración.

Las credenciales de aplicación vivirán exclusivamente en Secret Manager y las llamadas se realizarán desde Cloud Functions.

## Privacidad y autorización

- No se solicitan ni almacenan claves ARCA, CiDi o bancarias de clientes.
- La suscripción al módulo no equivale a representación del propietario.
- Cada objeto registra si la consulta es pública o si existe autorización pendiente, vigente, vencida o revocada.
- El acceso queda limitado a usuarios autorizados de la inmobiliaria y toda gestión genera auditoría.
- Los enlaces externos admitidos deben usar HTTPS.

## Etapas

1. MVP manual: objetos, obligaciones, vencimientos, pagos, evidencia y enlaces oficiales.
2. Municipalidad de Córdoba: conector SAM sujeto a credenciales y permisos oficiales.
3. Rentas Córdoba: conector sujeto a disponibilidad de API o convenio.
4. Alertas automáticas internas y resumen diario por correo (implementado).
5. Reportes a propietarios y canal WhatsApp con consentimiento verificable.
6. Incorporación de nuevas plazas con catálogo y tarifas jurisdiccionales.
