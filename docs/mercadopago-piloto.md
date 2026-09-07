# Mercado Pago: puesta en marcha del piloto

La integración usa Checkout Pro. La cuenta central ONO Prop se autentica con el
flujo `client_credentials`; las cuentas de inmobiliarias externas se conectan con
OAuth `authorization_code` y PKCE. ONO Prop no recibe contraseñas ni datos de
tarjetas. Los tokens se guardan cifrados y solamente son utilizados por Cloud
Functions.

## 1. Configurar la aplicación de Mercado Pago

- Seleccionar **Checkout Pro**, **API de Pagos** y el modelo **Marketplace**.
- Activar los permisos de lectura, escritura y acceso sin conexión.
- Activar PKCE para el flujo Authorization Code.
- Registrar como URL de redirección exacta:
  `https://southamerica-east1-inmobiliaria-bcc63.cloudfunctions.net/mercadoPagoOAuthCallback`
- Configurar Webhooks para los eventos **Pagos** y **Contracargos** con esta URL
  (no es necesario activar Planes y suscripciones):
  `https://southamerica-east1-inmobiliaria-bcc63.cloudfunctions.net/mercadoPagoWebhook`
- Copiar la clave secreta de Webhooks. No es el `access_token` ni el Client Secret.

## 2. Crear los secretos de Firebase

```powershell
firebase functions:secrets:set MERCADOPAGO_CLIENT_ID
firebase functions:secrets:set MERCADOPAGO_CLIENT_SECRET
firebase functions:secrets:set MERCADOPAGO_REDIRECT_URI
firebase functions:secrets:set MERCADOPAGO_TOKEN_ENCRYPTION_KEY
firebase functions:secrets:set MERCADOPAGO_WEBHOOK_SECRET
```

La clave de cifrado se puede generar en PowerShell así:

```powershell
$mercadoPagoKeyBytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Fill($mercadoPagoKeyBytes)
[Convert]::ToBase64String($mercadoPagoKeyBytes)
```

Debe pegarse completa, incluido un eventual `=` final.

## 3. Desplegar

```powershell
firebase deploy --only firestore:rules
firebase deploy --only functions
firebase deploy --only hosting
```

## 4. Conectar y asignar

1. Ingresar en `/admin/pagos` como usuario root.
2. Conectar la **Cuenta central ONO Prop**. Esta operación no abre una ventana de
   autorización porque utiliza las credenciales propias de la aplicación.
3. Asignarla al consorcio o contrato que participará en la prueba.
4. En consorcios, elegir además la cuenta de tesorería donde se registrará el ingreso.
5. Iniciar un pago pequeño y comprobar la conciliación en la misma pantalla.

Los abonos de las inmobiliarias y las donaciones siempre se cobran en la cuenta
central. Una inmobiliaria podrá conectar su cuenta mediante la ventana OAuth y
asignarla a sus propios consorcios o contratos sin que ONO Prop conozca sus
credenciales.

La cuenta corriente de cada inmobiliaria permite pagar el saldo ARS completo o
una obligación individual. El importe se obtiene nuevamente en Cloud Functions,
actualiza los intereses moratorios devengados, se acredita mediante el webhook y
se imputa primero a la deuda más antigua. La comisión efectiva y el importe neto
informados por Mercado Pago se conservan para conciliación interna; no se agregan
como recargo diferencial al cliente.

En expensas, el importe bruto cancela la deuda. La tesorería registra el ingreso
bruto y, por separado, las comisiones, impuestos y demás deducciones informadas
por Mercado Pago; el efecto conjunto coincide con el neto acreditado. En alquileres,
el recibo conserva también bruto, deducciones y neto para la liquidación posterior.

## Controles incluidos

- Firma HMAC de cada webhook y tolerancia temporal de cinco minutos.
- Consulta del pago a la API de Mercado Pago antes de acreditarlo.
- Validación de vendedor, importe, moneda y referencia externa.
- Idempotencia de órdenes, notificaciones y asientos contables.
- Devoluciones parciales, totales y contracargos procesados de forma idempotente:
  reabren el saldo, generan la reversión de tesorería y marcan las liquidaciones
  relacionadas para revisión.
- Los cobros administrados por Mercado Pago no pueden anularse manualmente desde
  ONO Prop; deben conciliarse con el estado informado por el proveedor.
- Primer piloto limitado a pesos argentinos.
