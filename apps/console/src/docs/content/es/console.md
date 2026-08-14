La consola en [heyapollo.dev/console](https://heyapollo.dev/console) es el tablero de instrumentos alrededor del escritorio: una vista en el navegador de lo que tu agente sabe, ve y planea. Se conecta directo desde tu navegador a tu propio worker. La página alojada es estática, no guarda nada del lado del servidor y nunca ve tus datos.

## Conectarse

Tres valores identifican un escritorio:

- **URL del worker** — dónde vive tu cerebro: `https://apollo.<tu-cuenta>.workers.dev`, o tu dominio propio.
- **Nombre de instancia** — la identidad del escritorio, `desk` salvo que hayas elegido otro. Tiene que coincidir exactamente; un nombre distinto es un Apollo distinto y vacío.
- **Secreto del dashboard** — el `DASHBOARD_SHARED_SECRET` que bootstrap generó en `.dev.vars`.

Los tres se quedan en el almacenamiento local de tu navegador. La consola abre un WebSocket directo a tu worker, se autentica con el secreto y todo lo que muestra llega en vivo desde ahí. Perder el navegador no pierde nada más que una conexión guardada.

![La pantalla de conexión pidiendo la URL del worker, el nombre del dispositivo y el secreto del dashboard](/handbook/console/connect.jpg)

## Qué puedes hacer

La consola es solo lectura y RPC. Explica el estado interno del agente y emite comandos explícitos, pero nunca puede ocupar el lugar del dispositivo en el protocolo.

![El resumen de estado saludando al escritorio, con tarjetas de telemetría de dispositivo, agente, batería, señal, recordatorios y firmware](/handbook/console/status.jpg)

- **Estado en vivo.** El modo de interfaz actual, si el dispositivo está conectado y la última instantánea de telemetría —batería, carga, volumen, señal, versión de firmware— mostrada con su antigüedad real, ya que la telemetría solo fluye mientras el dispositivo está en línea.
- **Memoria.** Recorre lo que Apollo recuerda: memorias en crudo, el bloque consolidado de memoria del dueño y las listas habladas. Confía en lo que sabe en vez de adivinar.
- **Agenda.** Mira y cancela recordatorios y temporizadores pendientes.
- **Servidores MCP.** Instala y quita servidores, completa sus flujos de OAuth y habilita herramientas una por una con su nivel de seguridad: la mitad administrativa de [Capacidades](/docs/capabilities).
- **Transmisión.** Habla a través del escritorio desde donde estés: escribe una frase para que Apollo la diga con su propia voz, o graba audio que se reproduce tal cual. Las transmisiones quedan en cola mientras el dispositivo está desconectado y se entregan al reconectar.

![El panel de MCP mostrando un servidor instalado y una lista de conectores de un clic](/handbook/console/mcp.jpg)

## Dos secretos por diseño

La consola se autentica con el secreto del dashboard, nunca con el del dispositivo, y la división es deliberada. La credencial del dispositivo se compila dentro del firmware, así que rotarla implica reflashear o una OTA para cada cuerpo que tengas. La credencial del dashboard vive en una pestaña del navegador y rota libremente con un `wrangler secret put`. Compartir un solo secreto significaría que una pestaña filtrada compromete toda la flota de dispositivos.

Los roles se diferencian en naturaleza, no solo en privilegio. Las conexiones de dashboard nunca reciben audio, no pueden inyectar cuadros de micrófono y quedan excluidas por completo del camino de mensajes del dispositivo, así una pestaña abierta nunca puede desincronizar el escritorio. Los RPC sensibles vuelven a verificar el secreto dentro de su propio payload en vez de confiar solo en la conexión.
