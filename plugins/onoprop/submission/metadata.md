# Datos preparados para la publicación

## Ficha

- **Nombre:** ONO Prop
- **Identidad del publicador:** Héctor Horacio Vázquez Cuestas (verificación
  individual; ONO Prop es el nombre comercial).
- **Descripción breve:** Buscá inmuebles publicados y accedé a su ficha actualizada.
- **Sitio:** https://onoprop.com
- **Soporte:** https://onoprop.com/contacto
- **Privacidad:** https://onoprop.com/privacidad
- **Términos:** https://onoprop.com/terminos
- **MCP universal:** https://onoprop.com/mcp
- **Autenticación:** Ninguna en esta primera versión.
- **Versión:** 0.8.0
- **Disponibilidad inicial sugerida:** Argentina.
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

No hay interfaz MCP embebida ni solicitudes desde una UI del plugin, por lo que
no se requieren dominios adicionales en una política CSP. Las respuestas no
incluyen datos de autenticación, identificadores internos sin contexto, emails,
teléfonos ni enlaces directos de mensajería. Los enlaces públicos incorporan
UTM para atribuir el tráfico proveniente del plugin.

## Prompts iniciales

1. Buscá departamentos de dos dormitorios en alquiler en Córdoba.
2. Mostrame alquileres temporales en Villa Parque Síquiman.
3. Quiero publicar mi inmueble gratis en ONO Prop.
4. Tengo una inmobiliaria y quiero conocer el software de ONO Prop.
5. Quiero solicitar una tasación profesional de mi casa.
