# Validación técnica previa a la presentación

Fecha: 15 de septiembre de 2026  
Versión: 0.8.0

## Resultados locales

- Servidor MCP: 17 pruebas aprobadas.
- Atribución y rendimiento en Functions: 4 pruebas aprobadas.
- Agregación del panel web: 2 pruebas aprobadas.
- ESLint de Functions: aprobado sin observaciones.
- ESLint de la aplicación web: aprobado sin observaciones.
- Build de producción Vite: aprobado.
- Sitemap: 73 URLs, incluidas 6 inmobiliarias.
- HTML SEO estático: 69 rutas públicas generadas.
- Manifiesto y configuración MCP: JSON válido; versión `0.8.0` y endpoint
  `https://onoprop.com/mcp`.
- Revisión de patrones sensibles en el paquete MCP: sin coincidencias.

## Disponibilidad pública comprobada

- `https://onoprop.com`: HTTP 200.
- `https://onoprop.com/contacto`: HTTP 200.
- `https://onoprop.com/privacidad`: HTTP 200.
- `https://onoprop.com/terminos`: HTTP 200.
- `OPTIONS https://onoprop.com/mcp`: HTTP 204.

## Validación pendiente después del despliegue 0.8.0

1. Actualizar o volver a conectar ONO Prop en ChatGPT.
2. Ejecutar los prompts de `test-cases.md`.
3. Abrir una ficha enlazada y confirmar que la URL conserva los parámetros UTM.
4. Confirmar en Rendimiento que la visita se identifica como
   `ChatGPT · ONO Prop`.
5. Ejecutar **Scan Tools** en el portal de presentación de OpenAI.
