# Integración ARCA — homologación

La primera etapa de ONO Prop está deliberadamente limitada a:

- WSAA y WSFEv1 de homologación.
- Factura C (`CbteTipo 11`).
- Servicios (`Concepto 2`).
- Pesos argentinos.
- Un perfil fiscal por emisor y punto de venta.
- Emisión idempotente vinculada a una obligación de alquiler.

Producción permanece bloqueada en backend aunque alguien altere el frontend.

## Seguridad de credenciales

No reutilizar certificados ni claves privadas que hayan sido versionados en Git. Generar un par nuevo para homologación, registrar el certificado en ARCA y autorizar el servicio `wsfe` para el CUIT representado.

Los tres valores se cargan únicamente en Google Secret Manager:

```powershell
firebase functions:secrets:set ARCA_HOMO_CERTIFICATE
firebase functions:secrets:set ARCA_HOMO_PRIVATE_KEY
firebase functions:secrets:set ARCA_TOKEN_ENCRYPTION_KEY
```

El certificado y la clave aceptan PEM real, PEM con saltos escritos como `\n` o el archivo PEM completo codificado en Base64. La clave de cifrado debe ser una cadena Base64 de 32 bytes aleatorios.

Ejemplo para generar la clave de cifrado:

```powershell
$arcaKeyBytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Fill($arcaKeyBytes)
[Convert]::ToBase64String($arcaKeyBytes)
```

El signo y token de WSAA se cifran con AES-256-GCM antes de almacenarse. Nunca se devuelven al navegador.

## Puesta en marcha

1. Crear en ARCA un certificado de homologación nuevo y autorizar `wsfe`.
2. Crear un punto de venta específico para Web Services de factura electrónica.
3. Cargar los tres secretos.
4. Desplegar funciones, reglas y hosting.
5. Ingresar como root a `/admin/arca`.
6. Crear el perfil con el CUIT y punto de venta correspondientes.
7. Ejecutar **Probar conexión**. El control valida WSAA, servidores WSFE, certificado, CUIT y puntos de venta.
8. Desde un contrato de alquiler, preparar el borrador y solicitar el CAE de prueba.

## Modelo multiemisor

Cada emisor tendrá un perfil fiscal separado. El perfil guarda configuración y referencia de credencial, nunca la clave privada. Para incorporar propietarios distintos se deberá contar con su delegación/autorización en ARCA y asignar un juego de credenciales aislado al perfil correspondiente.

Antes de habilitar producción faltan, como mínimo, el almacén de credenciales multiemisor, autorización expresa por propietario, representación y puntos de venta reales, comprobantes PDF/QR, notas de crédito, auditoría operativa y pruebas integrales de correlatividad.
