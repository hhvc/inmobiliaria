# Datos preparados para la publicación

## Ficha

- **Nombre:** ONO Prop
- **Identidad del publicador:** Héctor Horacio Vázquez Cuestas (verificación
  individual; ONO Prop es el nombre comercial).
- **Descripción breve:** Buscá inmuebles publicados y accedé a su ficha actualizada.
- **Subtítulo en inglés (US):** Search published properties.
- **Descripción en inglés (US):** ONO Prop lets users search current property
  listings published by real estate agencies and private owners, filter by
  transaction type, property type, location, price, and bedrooms, and open each
  public listing to verify details and contact the advertiser through the portal.
  It also guides owners who want to list a property for free, real estate
  agencies interested in managing and distributing their listings with ONO Prop,
  and users who want to request a professional valuation through the portal's
  commercial contact channel.
- **Traducción:** Español (Latinoamérica), con el subtítulo y descripción en
  español indicados en esta ficha.
- **Sitio:** https://onoprop.com
- **Soporte:** https://onoprop.com/contacto
- **Privacidad:** https://onoprop.com/privacidad
- **Términos:** https://onoprop.com/terminos
- **MCP universal:** https://onoprop.com/mcp
- **Autenticación:** Ninguna en esta primera versión.
- **Versión:** 0.8.0
- **Disponibilidad inicial:** Argentina (`AR`) únicamente.
- **Categoría sugerida:** Business. Si el portal no ofrece esa denominación,
  elegir la categoría equivalente orientada a negocios o inmuebles.
- **Logo para cargar:** `submission/assets/onoprop-plugin-icon.png`.

La identidad seleccionada en OpenAI debe ser la individual del titular. El
nombre del plugin continúa siendo **ONO Prop** y coincide con el nombre comercial
declarado en los términos y la política de privacidad del sitio.

## Descripción larga

ONO Prop permite buscar inmuebles actualmente publicados por inmobiliarias y
particulares, filtrar por operación, tipología, ubicación, precio y dormitorios,
y abrir la ficha pública para verificar los datos y contactar desde el portal.
También orienta a propietarios que quieran publicar gratis y a inmobiliarias
interesadas en administrar y difundir sus avisos con ONO Prop, y deriva las
solicitudes de tasación profesional al canal comercial del portal.

## Herramientas y seguridad

Todas las herramientas declaran `readOnlyHint: true`, `destructiveHint: false`
y `openWorldHint: false`: solo consultan el conjunto acotado de publicaciones
públicas y rutas comerciales propias de ONO Prop. No navegan por Internet, no
envían mensajes y no crean, modifican ni eliminan registros.

### Justificaciones para el portal

#### `onoprop.search_properties`

- **Read Only:** Solo consulta publicaciones públicas vigentes y aplica filtros;
  no crea, modifica ni elimina datos.
- **Open World:** Consulta exclusivamente el conjunto acotado de publicaciones
  públicas de ONO Prop; no navega Internet ni accede a servicios externos abiertos.
- **Destructive:** No ejecuta escrituras, mensajes, pagos ni cambios de estado;
  devuelve resultados de búsqueda y enlaces públicos.

#### `onoprop.get_property`

- **Read Only:** Recupera la ficha pública actual de un inmueble por su
  identificador; no altera la publicación ni sus datos.
- **Open World:** Accede únicamente a fichas públicas alojadas en ONO Prop; no
  consulta fuentes externas ni Internet abierto.
- **Destructive:** No modifica, elimina ni despublica inmuebles y no envía
  comunicaciones; solo devuelve información pública.

#### `onoprop.get_started`

- **Read Only:** Devuelve rutas públicas de ONO Prop para publicar gratis, sumar
  una inmobiliaria, conocer servicios o solicitar una tasación; no crea cuentas
  ni solicitudes.
- **Open World:** Las rutas pertenecen exclusivamente al dominio `onoprop.com` y
  a recorridos predefinidos; no navega ni consulta servicios externos.
- **Destructive:** No envía formularios, mensajes o transacciones y no cambia
  datos; solo orienta con enlaces públicos.

No hay interfaz MCP embebida ni solicitudes desde una UI del plugin, por lo que
no se requieren dominios adicionales en una política CSP. Las respuestas no
incluyen datos de autenticación, identificadores internos sin contexto, emails,
teléfonos ni enlaces directos de mensajería. Los enlaces públicos incorporan
UTM para atribuir el tráfico proveniente del plugin. La búsqueda no expone el
estado de destaque comercial ni prioriza publicaciones por pagos, promociones o
acuerdos publicitarios.

## Prompts iniciales para el portal

OpenAI admite hasta tres prompts en esta pantalla:

1. Buscá casas en venta de 2 dormitorios en Córdoba, zona norte.
2. Mostrame alquileres temporales en Villa Parque Síquiman.
3. Quiero publicar mi inmueble gratis en ONO Prop.
