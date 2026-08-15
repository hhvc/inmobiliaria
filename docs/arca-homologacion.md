# Integración ARCA — multiemisor por delegación

ONO Prop opera como prestador tecnológico con un computador fiscal propio por ambiente. Cada locador conserva su identidad fiscal, punto de venta y numeración, y autoriza a ONO Prop a actuar como representante mediante el Administrador de Relaciones de ARCA.

No se solicitan ni almacenan la clave fiscal, el certificado ni la clave privada del cliente.

## Separación de identidades

- **Titular de la credencial:** CUIT asociado al certificado/computador fiscal de ONO Prop.
- **Emisor o representado:** CUIT del locador que figura en el perfil fiscal y en `Auth.Cuit` de WSFE.
- **Punto de venta:** pertenece al emisor representado.
- **Ticket WSAA:** se obtiene una vez por ambiente, credencial y servicio; no se genera un ticket por cliente.

El perfil fiscal nunca guarda secretos. Conserva el CUIT representado, punto de venta, locador vinculado, datos impresos y el estado de la validación productiva.

## Alta de un nuevo emisor en Producción

1. Crear el perfil fiscal en `/admin/arca`, vincularlo al locador y dejar deshabilitada la emisión real.
2. El cliente ingresa personalmente a ARCA y delega **Facturación Electrónica** al CUIT con el que opera ONO Prop.
3. ONO Prop acepta la designación.
4. Actuando por el CUIT representado, ONO Prop asocia el servicio a su computador fiscal de Producción.
5. Verificar que el punto de venta WSFE del cliente esté activo.
6. Ejecutar **Probar PROD**. Esta acción consulta WSFE y la numeración, pero no solicita CAE.
7. Consultar la constancia real, completar los datos impresos y revisar Ingresos Brutos e inicio de actividades.
8. Habilitar expresamente la emisión real escribiendo la confirmación solicitada.

Si la delegación se completa mientras existe un ticket WSAA vigente, la nueva relación puede no quedar disponible hasta la renovación del ticket.

## Homologación

Homologación valida la integración técnica de la plataforma. Cuando el CUIT del perfil es distinto del certificado de prueba, **Probar plataforma HOMO** controla solamente FEDummy y la vigencia de la credencial; el CUIT y punto de venta reales se validan con **Probar PROD**.

## Seguridad y permisos

Los secretos se guardan exclusivamente en Google Secret Manager:

```powershell
firebase functions:secrets:set ARCA_HOMO_CERTIFICATE
firebase functions:secrets:set ARCA_HOMO_PRIVATE_KEY
firebase functions:secrets:set ARCA_PROD_CERTIFICATE
firebase functions:secrets:set ARCA_PROD_PRIVATE_KEY
firebase functions:secrets:set ARCA_TOKEN_ENCRYPTION_KEY
```

La clave de cifrado debe contener 32 bytes aleatorios codificados en Base64. Los tokens y firmas WSAA se cifran con AES-256-GCM y nunca se devuelven al navegador.

- Solo ONO Prop (`root`) crea perfiles, prueba la plataforma en HOMO, consulta la constancia desde Administración y habilita o deshabilita Producción.
- Un administrador puede probar la conexión productiva de los perfiles de su inmobiliaria.
- Una vez habilitado el perfil, el administrador puede preparar y emitir facturas o notas de crédito solamente dentro de esa inmobiliaria.
- Cada emisión conserva doble confirmación, bloqueo por CUIT/punto/tipo, idempotencia, auditoría y reconciliación.

Referencias oficiales: [delegación de Web Services](https://www.afip.gob.ar/ws/wsaa/adminrel.delegarws.pdf) y [manual WSAA](https://www.arca.gob.ar/ws/WSAA/WSAAmanualDev.pdf).
