# Apollo — Roadmap

Estado al 2026-08-08. Los ítems de "Confirmado" son cosas que Valentín ya decidió
que quiere. El detalle de cada uno indica qué lado toca (server, firmware o ambos).

## Confirmado

### 1. Modo focus visible en pantalla
El server ya maneja el estado `focus` y manda `focusRemainingSec` en cada
`ui_state`, pero el device solo muestra la cara "sleepy" (vía emotion) y no hay
countdown visible.

- **Firmware**: renderizar el tiempo restante (candidato: arco de progreso sobre
  el accent ring, o el label central del motor de emotes). Parsear
  `focusRemainingSec` en `HandleUiState` (`apollo_protocol.cc`).
- **Server**: ya está — solo verificar la cadencia de refresh del campo.

### 2. Background result completo: aviso hablado + QR del documento
Hoy `background_result` llega como alert genérico con el summary. Falta:

- **Aviso por voz**: que el agente diga "terminé <tarea>" cuando el job de
  background completa (server: `src/workflows/background.ts` → TTS por el canal
  de notificaciones, respetando el estado del device — no interrumpir un turno).
- **QR en pantalla**: si hay `documentKey`, mostrar un QR con la URL del
  documento. El motor gfx ya tiene widget de QR (`emote_set_qrcode_data` en
  `emote_op.c`), así que el firmware solo necesita rutear un mensaje nuevo
  (p.ej. `"type": "qr"`) hasta ese widget, con timeout de auto-cierre.

### 3. Telemetría device → server + reacciones del agente
El protocolo no tiene ningún mensaje device→server de estado. El board ya mide
batería (`adc_battery_estimation`, y existe `low_battery.ogg` local).

- **Firmware**: mensaje periódico `{"type":"telemetry", battery, charging, volume, ...}`
  (y push inmediato en cambios bruscos). Incluir también **estado de mute**
  (el doble tap hoy es silencioso e invisible para el server — ya causó un bug),
  señal WiFi y versión de firmware.
- **Server**: guardar el último snapshot en el estado del agente; darle acceso
  al agente en el system prompt del turno; reacciones proactivas ("estás con
  15% de batería, enchufame") vía el canal de notificaciones.
- **Schema**: agregar el mensaje a `deviceToServerMessageSchema` en
  `src/protocol/schema.ts`.

### 4. `audio_end` semántico
El schema ya distingue `hold_end` (soltar el dedo) de `audio_end` (fin por VAD
tras wake word), pero el firmware manda siempre `hold_end`
(`SendStopListening` en `apollo_protocol.cc`). Cambio chico: recordar el modo
con el que arrancó la escucha y mandar el evento que corresponde. Le da al
server la señal para adaptar el comportamiento (p.ej. timeouts distintos).

### 5. MCP device-side: el agente con manos sobre el hardware
La pieza más potente. `application.cc` ya tiene `McpServer` (herencia xiaozhi)
con tools de volumen, brillo, etc., pero:

- `apollo_protocol.cc` nunca rutea mensajes `"mcp"` (el branch existe en
  `application.cc` y está muerto).
- Del lado server, el tráfico `cf_agent_mcp_servers` del agents SDK se ignora a
  propósito.

Conectar ambos extremos para que el agente pueda ejecutar por voz: "bajá el
brillo", "subí el volumen", "apagá la pantalla", "poné cara de contento".
Definir el puente entre el formato de tools del agents SDK y el MCP embebido.

### 6. Bug: búsqueda por internet — ✅ resuelto y deployado (2026-08-08)
La búsqueda quedó migrada a **Tavily** (`src/search/tavily.ts`, secret
`TAVILY_API_KEY` ya seteado) y la investigación profunda a Perplexity
`sonar-deep-research` vía OpenRouter (`src/search/deepresearch.ts`). En prod;
solo queda validación de uso diario desde el device.

### 7. Timer por voz con progreso en el ring — mitad server ✅ (2026-08-08)
"Poné 10 minutos" → el agente crea el timer y el ring se convierte en barra de
progreso circular: arranca completo en el color del modo y se va consumiendo
(o llenando) hasta el final, con sonido al terminar.

- **Server**: ✅ tools `set_timer` y `start_pomodoro` en prod (montadas sobre el
  scheduler de reminders; el pomodoro además activa focus). Falta solo el
  mensaje al device con duración/restante para dibujar el arco.
- **Firmware**: el overlay del accent ring ya se dibuja por chunk en
  `emote_display.cc`; generalizarlo a "arco parcial" (ángulo en función del
  progreso). Misma UI sirve para el countdown del modo focus (ítem 1).

### 8. Captions en vivo (y que se borren al terminar)
Mostrar en pantalla lo que el usuario va diciendo mientras habla, con STT
parcial en streaming, y limpiar el texto apenas termina el turno — la pantalla
vuelve a quedar solo con la cara.

- **Server**: hoy la transcripción es post-hold (`src/voice/stt.ts`); requiere
  STT en streaming sobre los chunks que ya llegan por websocket y un mensaje
  incremental de caption.
- **Firmware**: renderizar caption parcial (el path de `sentence_start` ya
  existe) + borrado explícito al recibir el fin de turno.

### 9. Continuidad de conversación
Ventana de ~10 s después de una respuesta donde se puede repreguntar sin wake
word ni hold: el mic se re-abre solo y el ring pulsa para indicarlo.

- **Firmware**: tras `speech_done`, re-entrar a listening con VAD y timeout
  corto; animación de "pulso" del ring como indicador de mic abierto.
- **Server**: aceptar un turno que llega sin `hold_start`/`wake` previo dentro
  de la ventana; cerrar la ventana en silencio o en "gracias/listo".

### 10. Reacciones táctiles a la cara
Tocarle los ojos u otras zonas de la cara → reacción inmediata (parpadeo,
sorpresa, enojo si se insiste). Puro firmware, sin server: mapear zonas del
touch (`esp_lcd_touch_cst9217`) a emotes del catálogo con un pequeño cooldown
y escalada si se repite.

### 11. Estados de ánimo de fondo
Que la cara idle no sea siempre neutral: variación sutil según hora del día y
última interacción (más dormido a la noche, más despierto a la mañana,
"contento" un rato después de una charla larga).

- **Firmware**: puede resolverse solo local (reloj + último turno), o
- **Server**: mandando la emoción idle en `ui_state` para que el agente también
  influya (p.ej. quedó "curioso" tras una pregunta abierta).

## Propuesto 2026-08-08: más interacción server ↔ firmware

Principio rector: el firmware solo gana **vocabulario** (eventos y comandos
nuevos en el protocolo); la semántica vive siempre en el server, que se deploya
en segundos. Primer round sugerido: 12 + 13 (+ telemetría del ítem 3) — los
tres entran en un solo flasheo y cada uno destraba features server-side
inmediatas. Segundo round: 15 (OTA), para que ese sea el último flasheo por
cable.

### 12. Gestos como eventos crudos
El firmware manda `{"type":"gesture", "name":"tap"|"long_press"|...}` y el
server decide qué significa cada uno. Primeros mapeos: tap simple = cortar el
habla (barge-in táctil, sin AEC de por medio), long press = pomodoro o
briefing. Cambiar el mapeo pasa a ser deploy del worker, no flasheo.

- **Firmware**: emitir los eventos desde el touch (`esp_lcd_touch_cst9217`)
  sin semántica local (el doble tap de mute puede quedar local o migrar).
- **Server**: `deviceToServerMessageSchema` + mapa gesto→acción en el agente.

### 13. Earcons disparados por el server (`play_effect`)
Mensaje `{"type":"play_effect", "name":"ding"|...}` que reproduce efectos ya
grabados en la flash (el pipeline de ogg/opus con variantes de pitch ya
existe). Feedback instantáneo y gratis: el timer suena al toque mientras el
TTS del anuncio todavía se sintetiza; chime de confirmación; error sin gastar
créditos de ElevenLabs.

### 14. `set_volume` desde el server
Comando trivial para "bajá el volumen" por voz. Solapa con el MCP device-side
(ítem 5, que ya expone volumen/brillo): si el ítem 5 avanza pronto, esto sale
gratis por ahí; si no, es un mensaje simple como puente.

### 15. OTA desde R2
El server hostea el binario del firmware en el bucket `MEDIA`, el device
chequea versión al bootear (HTTP + `esp_ota`) y se actualiza solo. Dado el
riesgo del flasheo por cable en esta placa (nunca tocar DTR/RTS), se paga
solo: un último flasheo manual y de ahí en más el firmware también se
"deploya". Promovido desde "Por evaluar" (era "OTA por wifi").

### 16. `tts_end` + acks de reproducción (streaming real)
Las dos piezas que hoy bloquean el streaming de punta a punta:

- **`tts_end`**: elimina la exigencia de conocer `bytes` totales en el
  `tts_start` — el server podría empezar a mandar audio de ElevenLabs mientras
  se sintetiza. (La segmentación por oraciones ya da el 80% del beneficio,
  esto captura el resto.)
- **Acks**: mensaje periódico "llevo reproducidos X ms" → el pacing del server
  (`src/voice/stream.ts`) deja de estimar el backlog con un modelo abierto y
  pasa a usar el estado real de la cola del device. Robusto ante cualquier
  WiFi; reemplaza el tope fijo de 4 s.

### 17. Cards tipadas en pantalla (`ui_card`)
Más allá de cara + caption: countdown circular del timer (se une con el ítem
7), clima con ícono, cotización del dólar, la lista del super mientras la lee.
Tipadas y acotadas (timer/clima/lista/cotización/QR — el QR ya está en el
ítem 2), nada de layouts arbitrarios. El dashboard descartado ("dashboard has
no UI yet") entraría por acá.

## Por evaluar (ideas, sin compromiso)

- **Dashboard reloj + clima al tap**: el server ya arma y manda el payload
  completo; el firmware lo descarta ("dashboard has no UI yet"). Hoy el tap en
  idle no muestra nada. (Si avanza el ítem 17, entra como una card más.)
- **Barge-in por voz**: interrumpir al asistente hablándole por encima.
  Pendiente de probar; el path del mic crudo no tiene AEC (ver memoria del
  wake word). El tap del ítem 12 es el atajo táctil mientras tanto.
- **Briefing matutino**: a hora fija, clima + recordatorios del día por voz
  (orquestación sobre el cron de reminders ya existente).
- **Modo noche**: brillo mínimo, efectos más bajos y notificaciones silenciadas
  en un rango horario (natural encima de MCP + telemetría).
- **Console web de sesiones**: página servida por el worker con transcripciones,
  tool calls y errores, para debuggear sin serial.
- **Multi-device**: el protocolo ya rutea por `device_id`; formalizar un
  segundo Apollo con memoria y recordatorios compartidos.

## Notas de contexto

- El ring de accent color por modo, las variantes de pitch de los efectos y el
  fix del decode PCM/Opus se completaron el 2026-08-08 (ver git log del
  firmware y del server de ese día).
