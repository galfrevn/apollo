Apollo es un agente personal de escritorio. El cerebro es un Cloudflare Worker que corre en tu propia cuenta; el cuerpo es un dispositivo pequeño apoyado en tu escritorio. Le hablas y la respuesta vuelve en voz alta.

![El dispositivo de escritorio apoyado en una mesa, con su cara redonda iluminada por dos ojos en forma de cápsula](/handbook/purpose.jpg)

## Qué es Apollo

**Primero la voz.** Las respuestas están escritas para decirse en voz alta: oraciones cortas y naturales, no ensayos en markdown. Todo el recorrido, de la transcripción a la síntesis, está afinado para responder en un par de segundos.

**Un cerebro en tu propia cuenta.** El agente es un Worker con una sesión de Durable Object por escritorio. Esa sesión es el escritorio: memoria de la conversación, preferencias, confirmaciones pendientes, el temporizador de foco. Tus claves, tus datos, tu infraestructura. No hay intermediario alojado.

**Un agente que usa herramientas.** Además de hablar, Apollo actúa a través de un catálogo tipado de herramientas: clima, memoria, recordatorios y temporizadores, listas, búsqueda web e investigación profunda, traducción, reportes por correo y un sandbox de código opcional. [Capacidades](/docs/capabilities) recorre todo.

**Un servidor de protocolo para un dispositivo chico.** El contrato de comunicación asume un cliente limitado: mensajes de control en JSON compacto y audio PCM crudo, sin decodificador. Cualquier cosa que lo hable es un cuerpo válido: el firmware ESP32 de referencia, un parlante sin pantalla, un script en tu terminal.

## Qué no es Apollo

**No es una app de chat.** No hay un hilo de mensajes para recorrer. La consola existe, pero es el tablero de instrumentos alrededor del dispositivo, no el producto.

**No es un servicio alojado.** heyapollo.dev sirve este handbook y una consola sin estado; tu worker nunca le reporta nada. Apollo tiene licencia MIT y el cerebro se despliega con un comando en una cuenta que controlas tú.

**No es el firmware.** El cuerpo vive en su propio repositorio, con su propio handbook. El cerebro fija el contrato de comunicación y cada cuerpo se adapta a él: el firmware se adapta a Apollo, nunca al revés.

## Para quién es

Para alguien que quiere ser dueño de todo el stack. Despliegas el worker con tu propia cuenta de Cloudflare y tus claves, flasheas o construyes el dispositivo, y cada dato que el agente conoce vive en infraestructura que puedes inspeccionar y borrar.

El starter viene hablando español rioplatense para un escritorio en Buenos Aires. Cambiar el idioma, la voz o la ciudad es una edición guiada, no un fork.

¿Prefieres delegar? El proyecto generado lleva su propio manual como skills de agente, así un agente de código puede instalarlo, operarlo y extenderlo por ti. [Skills](/docs/skills) explica cómo.
