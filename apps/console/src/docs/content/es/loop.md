Un turno empieza cuando el dispositivo detecta la palabra de activación y abre un stream hacia el worker. La transcripción, el ciclo del agente y la respuesta hablada ocurren dentro de una misma sesión, así que el escritorio conserva el contexto entre turnos consecutivos.

![Una cinta de onda que sale de un dispositivo pequeño, atraviesa una nube y vuelve](/handbook/loop.jpg)

## El turno, de punta a punta

1. El dispositivo se conecta con su token, envía `hello` y recibe el `ui_state` actual.
2. Lo despiertas o mantienes presionado para hablar; los cuadros de audio viajan al worker mientras escucha.
3. `audio_end` —o `hold_end`, o un `text_input` escrito— cierra la captura y el turno se ejecuta.
4. El servidor recorre `ui_state` por `listening` → `thinking` → `speaking`, para que la cara siempre coincida con lo que está pasando.
5. Vuelve la voz: anunciada por `tts_start`, transmitida como audio crudo y cerrada por `turn_end`.
6. El escritorio vuelve a `idle`, `focus` o `dashboard`.

Cuando una herramienta necesita aprobación, el turno se detiene entre los pasos 4 y 5. El servidor envía `confirm_request`, el dispositivo muestra el resumen con botones Sí/No, y el efecto espera tu `confirm` — o expira a los 30 segundos.

## Qué envía el dispositivo

La captura tiene dos formas que terminan igual:

- **Mantener para hablar** encierra el audio entre `hold_start` y `hold_end`.
- **Palabra de activación** arranca con `wake` y termina con `audio_end`, cuando el detector de actividad de voz decide que terminaste.

En ambos casos el audio del micrófono viaja como cuadros binarios: PCM mono de 16 bits a 16 kHz, sin envoltorio.

Un turno necesita al menos 8000 bytes de audio, un cuarto de segundo. Cualquier cosa más corta recibe un "no llegué a escucharte" en vez de un viaje al transcriptor.

Alrededor de la captura, el dispositivo también envía:

- Eventos `gesture`, cuyo significado vive en el servidor: un toque alterna el dashboard, los deslizamientos rotan el modo de habla.
- Una instantánea de `telemetry` cada 60 segundos: batería, carga, volumen, señal, versión de firmware.
- `abort`, cuando interrumpes a Apollo a mitad de una oración.

## El ciclo del agente

El servidor transcribe el audio con Whisper Large V3 a través de OpenRouter y le entrega el texto al modelo junto con el prompt de personalidad, el contexto de la sesión, las memorias recuperadas, la hora del reloj y la telemetría más reciente mientras sigue fresca.

El modelo responde directamente o pide herramientas. Las `safe` se ejecutan de inmediato; las `unsafe` pasan por la confirmación de arriba.

Un turno corre como máximo tres rondas de herramientas antes de tener que responder con lo que tiene, así el escritorio nunca desaparece en `thinking` indefinidamente. El trabajo que no entra en ese presupuesto, como la investigación profunda, abandona el turno y vuelve más tarde como un `background_result`.

## La respuesta hablada

ElevenLabs sintetiza la respuesta y la transmite al dispositivo como PCM mono crudo a 24 kHz, así el ESP32 no necesita decodificador. Antes de sintetizar, `sanitizeTextForSpeech` quita cualquier markdown que haya producido el modelo: nunca se lee "asterisco asterisco" en voz alta.

Las respuestas largas se dicen en segmentos del tamaño de una oración. El turno solo espera el primero; cada segmento siguiente se sintetiza mientras suena el anterior. El modelo incluso transmite su respuesta mientras la escribe, así la primera oración puede sintetizarse de forma especulativa antes de que termine el razonamiento.

Cada síntesis en producción pasa por un caché en R2 con clave de voz, modelo y texto. Las frases repetidas no cuestan créditos.

Si interrumpes, el `abort` del dispositivo corta el stream dentro de un mismo fragmento y el servidor responde `tts_aborted`; el resto de la respuesta nunca se sintetiza.

Por último, `turn_end` indica si Apollo espera una respuesta. Si te preguntó algo, el dispositivo reabre el micrófono después de la reproducción en vez de volver a dormirse.
