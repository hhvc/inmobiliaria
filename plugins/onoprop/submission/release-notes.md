# Notas de versión para la presentación

## Texto público cargado en OpenAI

Initial release of ONO Prop for Argentina. The plugin provides read-only access
to current public property listings, supports filtering by transaction type,
property type, location, price, and bedrooms, and opens each listing for
verification and contact through the portal. Results are ranked only by
relevance, the requested price or date order, and recency; paid featured status
is not exposed or used for ranking. It also guides owners who want to publish
for free, real estate agencies interested in ONO Prop, and users requesting a
professional valuation. No authentication or test credentials are required.

## Versión 0.8.0 · presentación inicial

ONO Prop ofrece un servidor MCP público y de solo lectura para buscar inmuebles
vigentes en Argentina, consultar sus fichas y acceder a los recorridos públicos
para publicar gratis, incorporar una inmobiliaria, conocer el software o
solicitar una tasación profesional.

Esta presentación inicial incluye tres herramientas sin autenticación:

- `onoprop.search_properties` busca publicaciones con filtros de operación,
  tipología, ubicación, precio y dormitorios.
- `onoprop.get_property` recupera la información pública actualizada de una
  ficha seleccionada.
- `onoprop.get_started` devuelve rutas públicas para iniciar los principales
  recorridos comerciales.

El servidor conserva cada ficha publicada como un resultado independiente,
distingue Córdoba Capital de la Provincia de Córdoba, admite alquileres
temporales y evita exponer teléfonos, emails o información administrativa. Los
enlaces incluyen atribución UTM para medir el tráfico originado en el plugin.
Los resultados se ordenan por coincidencia, precio o fecha según la consulta y
no reciben prioridad por destaques pagos ni acuerdos publicitarios.

No se requieren credenciales de prueba, MFA ni acceso a una red privada. El
endpoint de producción es `https://onoprop.com/mcp`.
