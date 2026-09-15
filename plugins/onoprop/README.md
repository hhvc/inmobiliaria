# ONO Prop para ChatGPT y Codex

Este paquete describe la integración pública y de solo lectura de ONO Prop.
El servidor MCP se publica en `https://onoprop.com/mcp` mediante Firebase Hosting
y la Cloud Function `onopropMcp`.

## Alcance inicial

- Buscar inmuebles publicados por inmobiliarias o particulares.
- Consultar una ficha pública actualizada.
- Abrir las rutas de ONO Prop para publicar gratis, sumar una inmobiliaria o
  conocer sus servicios.
- Solicitar contacto para una tasación profesional.

Cuando se pide una cantidad de dormitorios sin aclarar "como mínimo", la
búsqueda prioriza las coincidencias exactas y agrega como oportunidades los
inmuebles con más dormitorios cuyo precio no supera el máximo de las opciones
exactas en la misma moneda.

Las ubicaciones se comparan mediante ciudad, provincia y barrio por separado.
`Córdoba` se interpreta como Córdoba Capital; para buscar en toda la jurisdicción
debe pedirse expresamente `Provincia de Córdoba`. Cada ficha pública se conserva
como un resultado independiente, incluso cuando dos unidades comparten edificio,
precio y características o un inmueble es ofrecido por distintas inmobiliarias.

No requiere autenticación, no modifica datos y no entrega emails, teléfonos,
credenciales, datos administrativos ni información privada de propietarios.

Los enlaces generados por el servidor incluyen atribución UTM de la campaña
`onoprop_mcp`. Las visitas a fichas de inmobiliarias quedan identificadas como
`ChatGPT · ONO Prop` en el panel de rendimiento; las páginas comerciales
conservan la fuente al generar una consulta.

## Despliegue

```powershell
firebase deploy --only "functions:onopropMcp,functions:portalRecordPerformanceEvent,functions:portalGetPerformanceDashboard,hosting"
```

Luego se debe conectar `https://onoprop.com/mcp` en el modo desarrollador de
ChatGPT y ejecutar los casos de prueba de `submission/test-cases.md`.
