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
  (y push inmediato en cambios bruscos).
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

### 6. Bug: búsqueda por internet
Hay un error en la búsqueda web (síntoma exacto a caracterizar: reproducir y
anotar acá). Entry points para investigar:

- `src/tools/web.ts` (tool `web_search`, binding `WEBSEARCH` + síntesis con
  OpenRouter).
- `src/search/pipeline.ts` (`collectFetchedSourceList`) y
  `src/search/synthesize.ts`.
- El handler ya atrapa excepciones y devuelve `ok: false` con el mensaje — ver
  qué está reportando en los logs de wrangler.

### 7. Timer por voz con progreso en el ring
"Poné 10 minutos" → el agente crea el timer y el ring se convierte en barra de
progreso circular: arranca completo en el color del modo y se va consumiendo
(o llenando) hasta el final, con sonido al terminar.

- **Server**: tool de timer (pariente simple del reminder ya existente) +
  mensaje al device con duración/restante.
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

## Por evaluar (ideas, sin compromiso)

- **Dashboard reloj + clima al tap**: el server ya arma y manda el payload
  completo; el firmware lo descarta ("dashboard has no UI yet"). Hoy el tap en
  idle no muestra nada.
- **OTA por wifi**: con protocolo Apollo el OTA está deshabilitado; updates
  solo por cable.
- **Barge-in**: interrumpir al asistente hablándole por encima. Pendiente de
  probar; el path del mic crudo no tiene AEC (ver memoria del wake word).
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
