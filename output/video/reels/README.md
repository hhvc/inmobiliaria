# Reels de captación — ONO Prop

Dos versiones verticales de 15 segundos (1080 × 1920, MP4), cada una con opción de música instrumental original y otra sin audio. Los fondos son ilustrativos; no representan propiedades ni clientes reales. Logo y propuestas de valor proceden del portal.

## Textos sugeridos para Instagram

**Particulares**

¿Querés vender o alquilar tu inmueble? Publicalo gratis en ONO Prop. Cargá los datos y las fotos para preparar tu aviso. Empezá acá: https://onoprop.com/publicar?utm_source=instagram&utm_medium=organic_social&utm_campaign=captacion_particulares&utm_content=reel_publicar_gratis

**Inmobiliarias**

Tu inmobiliaria, tu marca y tus inmuebles en ONO Prop. Publicá propiedades, gestioná consultas y colaborá con colegas. Conocé cómo sumarte: https://onoprop.com/inmobiliarias?utm_source=instagram&utm_medium=organic_social&utm_campaign=captacion_inmobiliarias&utm_content=reel_inmobiliarias

## Edición

El texto y los tiempos se pueden cambiar en `generate.mjs`. Para regenerar los videos mudos, ejecutá `node generate.mjs <ruta-a-ffmpeg>` desde cualquier carpeta. Se usan fuentes de Windows Segoe UI. Después, `node add-music.mjs <ruta-a-ffmpeg>` compone dos pistas originales mediante síntesis local (sin muestras ni grabaciones externas) y crea las versiones `_Con_Musica.mp4`. También deja los archivos WAV editables. No hay locución. Si preferís música de la biblioteca de Instagram, publicá las versiones sin audio.

Prompts de los fondos: fotografía editorial vertical de un propietario en su hogar usando un teléfono y de una pequeña inmobiliaria independiente trabajando con fotos y una computadora; ambos en un contexto urbano cordobés, sin texto, logos ni interfaz inventada. Generados con la herramienta integrada de imágenes.
