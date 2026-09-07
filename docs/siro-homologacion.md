# SIRO · primera etapa de integración

La primera versión opera exclusivamente en homologación y no modifica deudas ni
tesorería cuando SIRO aprueba un pago de prueba.

## Credenciales

Guardar como secretos las credenciales de homologación entregadas o publicadas
por Banco Roela. No guardar usuarios ni contraseñas del portal SIROWeb en
Firestore, variables `VITE_` ni archivos versionados.

```powershell
firebase functions:secrets:set SIRO_HOMO_USERNAME
firebase functions:secrets:set SIRO_HOMO_PASSWORD
```

## Despliegue

```powershell
firebase deploy --only "functions:siroGetConfiguration,functions:siroTestHomologation,functions:siroSaveAssignment,functions:siroDisableAssignment,functions:siroCreateCheckout,functions:siroGetOrderStatus,functions:siroSyncOrder,functions:siroPaymentCallback,functions:paymentResolveCheckoutProvider"
firebase deploy --only firestore:rules
npm run build
firebase deploy --only hosting
```

## Prueba funcional

1. Abrir `/admin/pagos`.
2. En **Banco Roela · SIRO**, presionar **Probar conexión**.
3. Elegir el convenio de homologación para un consorcio de prueba.
4. Ingresar como consorcista y presionar **Pagar online** sobre una expensa.
5. Completar el flujo de prueba de SIRO.
6. Verificar que el resultado indique aprobación de homologación y que la
   expensa real conserve su saldo.
7. Volver a `/admin/pagos` y usar **Sincronizar** para comprobar que la consulta
   por referencia es idempotente.

## Pendiente de la respuesta comercial

- Credenciales y URL definitivas de Producción.
- Modelo de un usuario API con múltiples administradores y convenios.
- Alta y vinculación de cuentas recaudadoras.
- Rendiciones, comisiones, devoluciones y contracargos.
- Confirmación automática de bases de deuda.
- Disponibilidad de notificaciones adicionales a `URL_OK`.

