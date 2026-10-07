# ONO Prop para Android

Este directorio contiene la Trusted Web Activity (TWA) que empaqueta la PWA
publicada en `https://onoprop.com` para su futura distribución en Google Play.

## Identidad estable

- Application ID: `com.onoprop.app`
- Nombre: `ONO Prop`
- Target SDK: Android 16 / API 36
- URL inicial: distingue la distribución de Google Play con
  `app_distribution=google_play`.
- Permisos nativos iniciales: ninguno. Las notificaciones y la ubicación no se
  solicitan mientras no exista una función que las necesite.

El Application ID y la firma no deben cambiar una vez publicada la aplicación.

## Modo Google Play

La URL inicial y los accesos rápidos incluyen
`app_distribution=google_play`. El frontend conserva esa marca durante la
sesión de la TWA y aplica estas reglas:

- no inicia aportes, compras, contrataciones ni pagos externos de servicios
  digitales;
- permite consultar saldos, vencimientos y servicios ya contratados;
- mantiene los cobros de alquileres y expensas, porque documentan obligaciones
  y servicios inmobiliarios del mundo real.

La misma aplicación web abierta normalmente en el navegador conserva sus
circuitos comerciales actuales.

## Compilación local de prueba

La compilación requiere JDK 17 y Android SDK. Bubblewrap los valida con:

```powershell
bubblewrap doctor
```

Para generar un APK de depuración que no requiere la clave de producción:

```powershell
./gradlew.bat assembleDebug
```

El APK resultante se crea en `app/build/outputs/apk/debug/` y no debe
versionarse.

## Firma y publicación

La clave de carga de Google Play debe conservarse fuera de Git y respaldarse de
forma segura. La configuración espera encontrarla en
`../.secrets/onoprop-upload.keystore`, una ruta ignorada por Git. Nunca se deben
versionar archivos `.keystore`, `.jks`, sus contraseñas ni propiedades locales
de firma.

Antes de generar el App Bundle de producción se debe:

1. Crear y resguardar una clave de carga exclusiva de ONO Prop.
2. Activar Play App Signing al crear la aplicación en Play Console.
3. Incorporar en `/.well-known/assetlinks.json` la huella SHA-256 del
   certificado de firma de la aplicación que entregue Google Play.
4. Volver a validar el modo Google Play ante cada cambio comercial: los
   servicios digitales no deben ofrecer Mercado Pago dentro de la app; los
   pagos inmobiliarios reales se mantienen separados.
5. Completar privacidad, seguridad de datos, funciones financieras, acceso para
   revisión y clasificación de contenido en Play Console.

No es necesario crear ni exponer una clave de producción para desarrollar o
probar el APK de depuración.

Los scripts de operación son:

```powershell
./scripts/generate-android-upload-key.ps1
./scripts/build-android-release.ps1
```

El primero se ejecuta una sola vez. Genera la clave y un archivo local de
recuperación dentro de `.secrets/`, sin imprimir la contraseña. Ambos archivos
deben respaldarse juntos fuera del equipo. El segundo lee esa contraseña solo
durante la compilación y limpia las variables temporales al finalizar.

El `assetlinks.json` inicial contiene la huella del certificado de carga para
validar instalaciones firmadas localmente. Cuando Play App Signing entregue su
certificado de firma, hay que agregar también esa huella antes de publicar.
