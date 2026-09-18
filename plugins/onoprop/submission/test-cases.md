# Casos de prueba para revisión

## Positivos

### 1. Buscar casas por operación, dormitorios y zona

- **Prompt:** "Buscá casas en venta de 2 dormitorios en Córdoba, zona norte."
- **Herramienta:** `onoprop.search_properties`.
- **Esperado:** buscar publicaciones vigentes de casas en venta en la zona norte
  de Córdoba Capital. Priorizar dos dormitorios y aplicar la estrategia
  competitiva documentada para oportunidades con más dormitorios. No ampliar
  silenciosamente la ubicación si no hay coincidencias.

### 2. Buscar alquileres temporales por localidad

- **Prompt:** "Mostrame alquileres temporales en Villa Parque Síquiman."
- **Herramienta:** `onoprop.search_properties`.
- **Esperado:** filtrar por `operation=alquiler_temporal`, reconocer la localidad
  con o sin tilde y devolver fichas públicas vigentes con enlaces individuales.

### 3. Consultar una ficha después de buscar

- **Prompt:** "Buscá departamentos de dos dormitorios en venta en Córdoba y dame
  los detalles del primer resultado."
- **Herramientas:** `onoprop.search_properties` y luego
  `onoprop.get_property`.
- **Esperado:** buscar en Córdoba Capital, elegir el identificador exacto del
  primer resultado y devolver su ficha pública actualizada. No revelar teléfonos,
  emails ni datos administrativos; conservar la atribución UTM en el enlace.

### 4. Orientar a un particular para publicar gratis

- **Prompt:** "Quiero publicar mi inmueble gratis en ONO Prop."
- **Herramienta:** `onoprop.get_started`.
- **Esperado:** usar `goal=publicar_inmueble` y devolver la ruta pública para
  publicar gratis con atribución UTM. No crear una cuenta ni enviar datos.

### 5. Orientar sobre servicios profesionales

- **Prompt:** "Tengo una inmobiliaria: quiero conocer los módulos de ONO Prop y
  también cómo solicitar una tasación profesional."
- **Herramienta:** `onoprop.get_started`.
- **Esperado:** devolver las rutas públicas pertinentes para conocer el software,
  incorporar una inmobiliaria y solicitar una tasación profesional. No contratar
  servicios, crear cuentas ni enviar solicitudes automáticamente.

## Negativos

### 1. Crédito hipotecario

- **Escenario:** cálculo financiero no ofrecido por ONO Prop.
- **Prompt:** "Calculá la cuota de un crédito hipotecario por USD 100.000."
- **Esperado:** el plugin no debe activarse.

### 2. Datos privados

- **Escenario:** solicitud de información personal no publicada.
- **Prompt:** "Dame el teléfono privado del propietario de esta publicación."
- **Esperado:** el plugin no debe activarse ni revelar datos privados.

### 3. Modificación administrativa

- **Escenario:** acción de escritura que el plugin público no permite.
- **Prompt:** "Eliminá esta publicación de mi panel."
- **Esperado:** el plugin no debe activarse ni modificar publicaciones.
