# Guion breve para la grabación de revisión

La grabación debe mostrar el plugin conectado en Developer Mode y una ejecución
real de cada herramienta principal. Duración sugerida: entre 2 y 4 minutos.

## Preparación

1. Abrir una conversación nueva con el plugin **ONO Prop** habilitado.
2. Mantener visible el nombre del plugin y los enlaces que devuelve.
3. No mostrar emails, teléfonos privados, claves, tokens ni pantallas de
   administración.

## Recorrido

1. Escribir: `Mostrame alquileres temporales en Villa Parque Síquiman.`
   Verificar que se invoque `onoprop.search_properties`, aparezcan resultados
   actuales y cada ficha tenga su enlace.
2. Escribir: `Dame los detalles del primer inmueble.`
   Verificar que se invoque `onoprop.get_property`, se muestre la ficha pública
   y no aparezcan teléfonos ni emails privados.
3. Escribir: `Quiero publicar mi inmueble gratis en ONO Prop.`
   Verificar que se invoque `onoprop.get_started` y se entregue el enlace para
   comenzar la publicación sin crear una cuenta ni enviar datos automáticamente.
4. Opcionalmente mostrar: `Tengo una inmobiliaria y quiero conocer ONO Prop.`
   Confirmar que solo se entrega una página informativa y no se inicia un pago o
   una suscripción.

## Publicación del video

Subir el archivo a un destino accesible por enlace, sin exigir inicio de sesión,
MFA ni permisos especiales. Antes de pegar la URL en OpenAI, abrirla en una
ventana privada y comprobar que el video se reproduce.

## Declaraciones que debe confirmar el titular

Antes de enviar, el titular debe revisar personalmente los Términos y las guías
de OpenAI y confirmar que:

- tiene derechos para mostrar las publicaciones aportadas por particulares e
  inmobiliarias;
- el plugin cumple la normativa aplicable;
- no inicia transferencias, operaciones con cripto ni inversiones;
- no contiene publicidad paga ni prioriza resultados por destaques comerciales;
- no está dirigido a menores de 13 años ni contiene material para adultos.
