El dispositivo y el worker hablan un protocolo pequeño sobre WebSocket. Es el contrato entre el firmware y el cerebro, y la única interfaz en la que los dos repositorios están de acuerdo. Este capítulo es el contrato completo: alcanza para construir tu propio cuerpo sin leer el firmware de referencia.

![Cuadros viajando en ambas direcciones entre un dispositivo pequeño y un servidor](/handbook/protocol.jpg)

## Ciclo de conexión

Un cuerpo se conecta al agente con su secreto compartido en la query string:

```
wss://<worker-host>/agents/apollo/<instance-name>?token=<DEVICE_SHARED_SECRET>
```

El nombre de instancia es la identidad del escritorio, `desk` por convención. El token se compara con una verificación de tiempo constante **antes** del upgrade del WebSocket: un token inválido o ausente recibe un `401 Unauthorized` simple, nunca un socket a medio abrir.

Un navegador que presenta el `DASHBOARD_SHARED_SECRET` se marca como conexión de dashboard. Puede administrar el agente por RPC, pero nunca recibe audio y sus mensajes nunca llegan al camino del dispositivo. Los dos secretos están deliberadamente separados: la credencial del dispositivo se compila dentro del firmware, así que rotarla es una operación de flota, mientras que la del dashboard vive en una pestaña y rota sin costo.

Una vez conectado, el dispositivo envía `hello` con su `deviceId` y recibe el `ui_state` actual. Dos reglas mantienen honestos a los clientes en ambas direcciones:

- **Del dispositivo al servidor, estricto.** Cada mensaje se valida contra un esquema de Zod; los tipos desconocidos o los campos malformados reciben `{ "type": "error", "code": "invalid_message" }`. Todo mensaje del dispositivo lleva una marca de tiempo `ts`.
- **Del servidor al dispositivo, tolerante.** El cliente debe ignorar los tipos de mensaje que no reconoce y tratar cada campo opcional —subtítulo, emoción, color de acento, segundos de foco— como genuinamente opcional. El servidor puede ampliar el vocabulario en cualquier momento sin romper cuerpos viejos.

También hay un `GET /health` sin autenticación que responde `{ "ok": true, "name": "apollo", "features": [...] }`. El arreglo de features demuestra qué bindings resolvieron, lo que lo vuelve la primera parada para depurar un despliegue.

## Catálogo de mensajes

Del dispositivo al servidor:

| Tipo | Rol |
| --- | --- |
| `hello` | Identificar el dispositivo después de conectar |
| `hold_start` / `hold_end` | Límites de mantener para hablar |
| `wake` | Despertar sin gesto de mantener |
| `audio_end` | Fin de una frase por palabra de activación, detectado por VAD |
| `listen_cancel` | El usuario canceló una escucha abierta; se descarta el audio y no corre ningún turno |
| `gesture` | `tap`, `double_tap`, `swipe_left`, `swipe_right` |
| `confirm` | Aceptar o rechazar una confirmación pendiente |
| `text_input` | Entrada escrita como alternativa |
| `abort` | Cortar la voz que se está transmitiendo (interrupción) |
| `telemetry` | Batería, carga, volumen, señal WiFi, versión de firmware |
| `playback_ack` | Reporte de avance de un clip reproducido: su número de secuencia y milisegundos sonados |
| `mcp` | Respuesta JSON-RPC del servidor MCP embebido en el dispositivo |

Del servidor al dispositivo:

| Tipo | Rol |
| --- | --- |
| `ui_state` | Modo, modo de habla, subtítulo, foco restante, emoción de la cara, color de acento |
| `confirm_request` | Pedirle al usuario que apruebe el efecto de una herramienta |
| `confirm_close` | La ventana de confirmación terminó; hay que sacar la pantalla de confirmación |
| `tts_start` | Anunciar el próximo clip de voz — uno por segmento, no uno por respuesta |
| `tts_end` | El segmento de voz actual terminó; una respuesta puede tener más segmentos y solo termina en `turn_end` |
| `tts_aborted` | El clip anunciado se cortó y nunca se completará |
| `timer` | Mostrar el arco de cuenta regresiva con `endsAt` y `durationSeconds`; omitir ambos campos lo limpia |
| `turn_end` | La voz se envió completa; `expectsReply` indica si hay que reabrir el micrófono |
| `error` | Falla estructurada |
| `dashboard` | Instantánea de reloj y clima |
| `background_result` | Resumen de trabajo asincrónico terminado |
| `reminder` | Entrega de un recordatorio |
| `play_effect` | Reproducir un efecto de sonido grabado en la flash del dispositivo |
| `mcp` | Pedido JSON-RPC para el servidor MCP embebido en el dispositivo |

Cuatro entradas merecen un comentario:

- **`gesture`** — el significado vive en el servidor, no en el dispositivo. El firmware reporta qué pasó y el cerebro decide qué significa, así el comportamiento cambia sin reflashear.
- **`play_effect`** — lleva un nombre lógico (`ding`, `chime`, `error`, `low_battery`) que el firmware mapea a los recursos en flash. El sonido suena al instante mientras el TTS todavía sintetiza, y los nombres desconocidos se ignoran.
- **`mcp`** — conecta las herramientas del agente con el hardware mismo. El servidor manda llamadas JSON-RPC como `self.audio_speaker.set_volume` por el socket, el firmware las enruta a su servidor MCP embebido y la respuesta vuelve por el mismo camino. La correlación es por id entero de JSON-RPC, con un timeout de cinco segundos que degrada a un "no respondió" hablado.
- **`tts_aborted`** — existe porque el dispositivo cuenta los bytes recibidos contra el total anunciado en `tts_start`. Después de una interrupción ese total nunca llega, y sin el mensaje de aborto el dispositivo esperaría para siempre una voz cancelada.

> Un cuerpo mínimo no necesita todo esto. Un parlante sin pantalla sostiene una conversación completa con `hello`, un par de captura (`wake` + `audio_end`, o el par de mantener), audio binario, `tts_start`, `tts_end`, `tts_aborted` y `turn_end`. Todo lo demás suma capacidades que el hardware realmente tiene.

## Formato del audio

La regla es absoluta en ambas direcciones: **los cuadros de texto JSON son control, los cuadros binarios son audio.** Sin envoltorio, sin metadatos intercalados.

**Subida.** El audio del micrófono viaja como PCM mono de 16 bits little-endian a 16 kHz mientras haya una sesión de escucha abierta, y la sesión se cierra con el evento que corresponde a cómo empezó.

**Bajada.** Cada `tts_start` anuncia un clip con su `format` (`pcm` en producción), un total de bytes cuando se conoce, un número de secuencia opcional y parámetros de muestreo mono a 24 kHz. Los cuadros binarios que siguen pertenecen a ese clip, y `tts_end` lo cierra. Cada segmento hablado es su propio par `tts_start`/`tts_end`; solo `turn_end` dice que la respuesta terminó.

## Endpoints de OTA

Las actualizaciones de firmware usan el mismo modelo de confianza que el socket: dos rutas HTTP autenticadas con el mismo secreto `?token=`, sirviendo desde el bucket de R2 del worker.

- `GET|POST /ota/check` responde `{ "firmware": { "version", "url", "force" } }`, o `{}` cuando no hay nada publicado. Las versiones deben coincidir con `^\d+(\.\d+)*$`; el parser del dispositivo aborta con cualquier cosa más elaborada.
- `GET /ota/firmware.bin` transmite el binario que nombra el manifiesto publicado, con un `Content-Length` explícito, porque el dispositivo rechaza las descargas sin longitud.

El dispositivo revisa una vez al arrancar, justo después de sincronizar la hora, y una revisión fallida solo se registra y el arranque sigue normal. El cerebro también puede empujar una actualización por el puente MCP cuando la telemetría muestra un dispositivo inactivo, enchufado y desactualizado. Los pasos de publicación están en [Firmware](/docs/firmware).
