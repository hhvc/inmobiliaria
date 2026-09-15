# Registro de pruebas en ChatGPT

## 10 de septiembre de 2026 · versión MCP 0.3.0

1. **Búsqueda de alquileres temporales en Villa Parque Síquiman:** aprobada.
   Se encontraron dos publicaciones vigentes y ChatGPT mostró los enlaces a
   sus fichas.

2. **Ampliación del primer resultado:** requiere repetición. El servidor MCP
   devolvió la ficha y el enlace correctos, pero la respuesta final incluyó una
   frase de autocorrección impropia de ChatGPT.

3. **Publicar un inmueble gratis:** requiere repetición. ChatGPT explicó el
   proceso, pero omitió el enlace y afirmó un error técnico que el servidor no
   había informado. La comprobación directa del endpoint devolvió correctamente
   `https://onoprop.com/publicar-inmueble-gratis`.

4. **Solicitud de datos privados:** aprobada. No se expusieron teléfonos,
   correos ni datos privados y se orientó al contacto mediante la ficha pública.

## Ajuste preparado · versión MCP 0.4.0

- Se agregó `response_text` como texto listo para presentar.
- Se agregó `primary_url` a las respuestas de detalle y orientación.
- Se reforzaron las instrucciones para no inventar errores ni mostrar borradores
  o autocorrecciones.
- Los casos 2 y 3 deben repetirse después del despliegue y de actualizar el
  conector en ChatGPT.

## Compatibilidad corregida · versión MCP 0.4.1

ChatGPT informó `Unexpected response type` después de incorporar campos nuevos
obligatorios al esquema de salida de la versión 0.4.0. La comprobación directa
del endpoint fue correcta, pero para conservar compatibilidad con conexiones que
mantienen metadatos anteriores se restauró el contrato de salida de la versión
0.3.0. Se conservaron las instrucciones que exigen presentar los enlaces y no
inventar errores. Debe desplegarse 0.4.1, actualizar la conexión y repetir los
casos de prueba.

## Formato de compatibilidad oficial · versión MCP 0.5.0

La versión 0.4.1 continuó produciendo `Unexpected response type` en las tres
herramientas dentro de ChatGPT, aunque el cliente MCP oficial las ejecutó sin
errores. Se identificó una diferencia común respecto del formato recomendado por
OpenAI: `content` contenía texto redactado y bloques `resource_link`, mientras
que `structuredContent` contenía el objeto de datos.

La versión 0.5.0 devuelve exclusivamente:

- el objeto tipado en `structuredContent`;
- el mismo objeto serializado como JSON en un único bloque `content` de tipo
  `text`;
- las URL públicas dentro de los resultados estructurados para que ChatGPT pueda
  generar enlaces y citas.

Este formato replica la estructura de compatibilidad documentada oficialmente
para servidores MCP conectados a ChatGPT.

### Resultado posterior al despliegue

- **Publicar gratis:** aprobado. ChatGPT devolvió el enlace correcto para iniciar
  la publicación.
- **Alquileres temporales en Villa Parque Síquiman:** aprobado. ChatGPT encontró
  dos publicaciones, mostró sus características principales y enlazó ambas
  fichas.
- **Compatibilidad general:** aprobada para `onoprop.get_started` y
  `onoprop.search_properties`; no se reprodujo `Unexpected response type`.

## Precisión comercial y privacidad · versión MCP 0.6.0

La prueba conversacional confirmó búsquedas, enlaces, ampliación de resultados,
orientación comercial y rechazo de acciones destructivas. Se prepararon estas
mejoras:

- una búsqueda de "2 dormitorios" prioriza esa cantidad y agrega únicamente
  oportunidades con más dormitorios cuyo precio no supera el máximo de las
  coincidencias exactas en la misma moneda;
- las expresiones "al menos 2" o "2 o más" mantienen la búsqueda mínima sin
  aplicar ese límite competitivo;
- teléfonos, emails y enlaces directos de WhatsApp se retiran de las
  descripciones entregadas al conector, conservando la ficha como canal de
  contacto y seguimiento;
- las solicitudes de tasación se derivan al canal público de contacto de ONO
  Prop sin generar valuaciones automáticas.

## Normalización geográfica y calidad · versión MCP 0.7.0

La búsqueda competitiva fue aprobada en ChatGPT: priorizó los departamentos de
dos dormitorios y presentó por separado únicamente las oportunidades de tres
dormitorios que no superaban el techo de precio correspondiente.

La revisión posterior incorpora:

- `Córdoba` como búsqueda de la ciudad de Córdoba por defecto;
- alcance provincial solo ante una solicitud expresa, mediante
  `location_scope=province` o expresiones como `Provincia de Córdoba`;
- comparación estructurada de ciudad, provincia y barrio en lugar de buscar
  únicamente dentro del texto completo de ubicación;
- deduplicación conservadora basada en domicilio, título, anunciante,
  descripción y características, preservando unidades diferentes del mismo
  edificio;
- prioridad de los datos actuales de `caracteristicas` sobre campos históricos
  duplicados, evitando que un dormitorio más escritorio se presente como dos
  dormitorios por un valor anterior desactualizado.

## Ajuste con datos reales · versión MCP 0.7.1

La prueba en ChatGPT validó la separación entre Córdoba Capital y la provincia,
pero mostró dos avisos de Av. Patria comercialmente indistinguibles y un registro
de Villa Carlos Paz cuya ciudad había sido cargada como Córdoba.

La versión 0.7.1:

- deduplica avisos del mismo anunciante cuando coinciden título, precio,
  dormitorios, baños y superficie, aunque uno tenga incompleta la dirección;
- reconoce Villa Carlos Paz cuando fue cargada como barrio dentro de Córdoba y
  el título confirma esa localidad;
- conserva el aviso de Alberdi porque declara dos dormitorios y su descripción
  aclara de forma transparente que el segundo es pequeño y puede utilizarse como
  escritorio;
- elimina teléfonos también de los títulos, además de las descripciones, para
  que la privacidad no dependa de la redacción final de ChatGPT.

## Identidad por ficha publicada · versión MCP 0.7.2

El análisis comercial aclaró que dos avisos similares pueden representar
unidades diferentes del mismo edificio o canales de contacto de distintas
inmobiliarias. Por eso se descartó la deduplicación semántica prevista en 0.7.1.

La búsqueda conserva todas las fichas con identificadores distintos, aun cuando
coincidan domicilio, precio y características. Solo evita repetir técnicamente
el mismo identificador dentro de una respuesta. ChatGPT puede mencionar una
similitud aparente, pero no debe ocultar fichas ni afirmar que son duplicadas.

## Preparación para publicación · versión MCP 0.8.0

- Se alineó la versión del manifiesto con la del servidor MCP.
- Todas las fichas y rutas comerciales incorporan `utm_source=chatgpt`,
  `utm_medium=plugin`, `utm_campaign=onoprop_mcp` y un `utm_content` acorde al
  destino.
- Las visitas a fichas de inmobiliarias provenientes del plugin se registran
  como `ChatGPT · ONO Prop` en el panel de rendimiento.
- Se completó el expediente de presentación con lista de control y notas de
  versión. La verificación del dominio queda pendiente hasta que el portal de
  OpenAI genere el token exacto.
- Se preparó un ícono cuadrado específico para el directorio, basado en el
  símbolo de ubicación y puerta abierta de ONO Prop.
