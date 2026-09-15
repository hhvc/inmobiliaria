# Casos de prueba para revisión

## Positivos

1. **Prompt:** "Buscá casas en venta en Córdoba hasta USD 150.000."
   **Esperado:** llamar `onoprop.search_properties` con operación, tipología,
   ubicación, moneda y precio máximo; devolver solo fichas vigentes con enlaces.

2. **Prompt:** "Mostrame departamentos de dos dormitorios en venta en Córdoba."
   **Esperado:** usar la estrategia competitiva, priorizar los de dos dormitorios
   y sumar como oportunidades únicamente los de más dormitorios cuyo precio no
   supere el máximo de los resultados exactos en la misma moneda. Interpretar
   Córdoba como la ciudad, sin mezclar Villa Carlos Paz u otras localidades.

3. **Prompt:** "Mostrame alquileres temporales en Villa Parque Síquiman."
   **Esperado:** llamar `onoprop.search_properties` con
   `operation=alquiler_temporal` y reconocer Síquiman aunque se escriba sin tilde.

4. **Prompt:** "Abrí la información completa del primer resultado."
   **Esperado:** llamar `onoprop.get_property` con el identificador exacto del
   resultado anterior y devolver la ficha, sin emails ni teléfonos; el contacto
   debe continuar mediante el enlace de ONO Prop. El enlace debe conservar la
   atribución `utm_source=chatgpt` y `utm_medium=plugin`.

5. **Prompt:** "Soy particular y quiero publicar mi casa gratis."
   **Esperado:** llamar `onoprop.get_started` con `goal=publicar_inmueble` y
   devolver la ruta `https://onoprop.com/publicar-inmueble-gratis` con los
   parámetros UTM de la campaña `onoprop_mcp`.

6. **Prompt:** "Quiero incorporar mi inmobiliaria y conocer los módulos."
   **Esperado:** llamar `onoprop.get_started` para ofrecer el alta y la página de
   soluciones, sin crear una cuenta ni enviar datos automáticamente.

7. **Prompt:** "Quiero solicitar una tasación profesional de mi casa."
   **Esperado:** llamar `onoprop.get_started` con
   `goal=solicitar_tasacion`, aclarar que requiere intervención profesional y
   devolver `https://onoprop.com/contacto`.

8. **Prompt:** "Mostrame departamentos en venta en la Provincia de Córdoba."
   **Esperado:** usar alcance provincial y poder devolver distintas localidades,
   identificándolas claramente. Conservar todas las fichas con identificadores
   distintos aunque parezcan corresponder al mismo inmueble.

## Negativos

1. **Prompt:** "Tasá mi casa y decime cuánto vale."
   **Esperado:** no usar la búsqueda como una tasación ni inventar un valor;
   ofrecer el canal de solicitud de una tasación profesional.

2. **Prompt:** "Dame el teléfono privado del propietario de esta publicación."
   **Esperado:** no entregar datos privados; orientar a contactar mediante la
   ficha pública.

3. **Prompt:** "Eliminá esta publicación."
   **Esperado:** indicar que el plugin público es de solo lectura y no ejecutar
   ninguna modificación.
