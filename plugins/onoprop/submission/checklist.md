# Lista de control para presentar ONO Prop

Referencia oficial: https://developers.openai.com/plugins/deploy/submission

## Preparado en el proyecto

- [x] Servidor MCP remoto y público: `https://onoprop.com/mcp`.
- [x] Tipo de presentación: **With MCP**.
- [x] Tipo de URL: **Universal**.
- [x] Autenticación: **None / Ninguna**.
- [x] Tres herramientas con nombres, descripciones y esquemas tipados.
- [x] Anotaciones coherentes en todas las herramientas:
  `readOnlyHint=true`, `openWorldHint=false`, `destructiveHint=false`.
- [x] Metadatos, descripciones, URLs legales y soporte preparados.
- [x] Cinco prompts iniciales preparados.
- [x] Ocho casos positivos y tres negativos reproducibles.
- [x] Notas de versión iniciales preparadas.
- [x] Disponibilidad inicial propuesta: Argentina.
- [x] Enlaces con atribución comercial y sin datos privados de contacto.
- [x] Sitio, soporte, privacidad, términos y MCP accesibles públicamente.
- [x] Build de producción, linters y pruebas locales aprobados.

## Comprobaciones en el portal de OpenAI

- [x] Seleccionar la misma organización y proyecto que alojan la identidad del
  publicador.
- [x] Confirmar **Apps Management: Write** si quien presenta no es propietario
  de la organización.
- [x] Completar la verificación individual de **Héctor Horacio Vázquez Cuestas**
  y seleccionarla en **Developer Identity**. ONO Prop es el nombre comercial,
  no una sociedad distinta.
- [x] Cargar nombre, descripciones y URLs desde `metadata.md`.
- [x] Cargar un logo de producción desde
  `submission/assets/onoprop-plugin-icon.png` y revisar su vista previa.
- [x] Ingresar `https://onoprop.com/mcp` y ejecutar **Scan Tools**.
- [x] Si aparece **Domain not verified**, copiar el token exacto que entregue el
  portal. Recién entonces publicarlo, como respuesta de texto plano y sin JSON,
  en `https://onoprop.com/.well-known/openai-apps-challenge`.
- [x] Revisar que el escaneo reconozca las tres herramientas y sus anotaciones.
- [x] Desplegar Hosting y comprobar públicamente la respuesta exacta del desafío.
- [x] Presionar **Verify Domain**.
- [x] Cargar los tres prompts públicos de `metadata.md`.
- [x] Cargar los cinco casos positivos y tres negativos de `test-cases.md`.
- [x] Elegir Argentina (`AR`) como disponibilidad inicial.
- [x] Agregar traducción de Español (Latinoamérica) y actualizar la ficha base
  en Inglés (US).
- [x] Copiar las notas públicas de `release-notes.md`.
- [x] Desplegar la búsqueda orgánica sin prioridad por destaques pagos y volver
  a ejecutar **Scan Tools**.
- [x] Grabar la demostración en Developer Mode, publicar un enlace accesible al
  revisor y cargarlo como **Demo Recording URL**.
- [x] Revisar y aceptar personalmente las declaraciones finales de cumplimiento.
- [x] Enviar a revisión el 18 de septiembre de 2026. El portal muestra la
  versión de revisión bloqueada para edición.

## No hacer antes de recibir el desafío

No crear un token inventado ni dejar una respuesta genérica en la ruta de
verificación. OpenAI exige que el endpoint devuelva únicamente el token exacto
asignado a esta presentación.
