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

- [ ] Seleccionar la misma organización y proyecto que alojan la identidad del
  publicador.
- [ ] Confirmar **Apps Management: Write** si quien presenta no es propietario
  de la organización.
- [ ] Completar la verificación individual de **Héctor Horacio Vázquez Cuestas**
  y seleccionarla en **Developer Identity**. ONO Prop es el nombre comercial,
  no una sociedad distinta.
- [ ] Cargar nombre, descripciones y URLs desde `metadata.md`.
- [ ] Cargar un logo de producción desde
  `submission/assets/onoprop-plugin-icon.png` y revisar su vista previa.
- [ ] Ingresar `https://onoprop.com/mcp` y ejecutar **Scan Tools**.
- [ ] Si aparece **Domain not verified**, copiar el token exacto que entregue el
  portal. Recién entonces publicarlo, como respuesta de texto plano y sin JSON,
  en `https://onoprop.com/.well-known/openai-apps-challenge`.
- [ ] Revisar que el escaneo reconozca las tres herramientas y sus anotaciones.
- [ ] Cargar los prompts y casos de `test-cases.md`.
- [ ] Elegir Argentina como disponibilidad inicial.
- [ ] Copiar `release-notes.md`, completar las declaraciones y enviar a revisión.

## No hacer antes de recibir el desafío

No crear un token inventado ni dejar una respuesta genérica en la ruta de
verificación. OpenAI exige que el endpoint devuelva únicamente el token exacto
asignado a esta presentación.
