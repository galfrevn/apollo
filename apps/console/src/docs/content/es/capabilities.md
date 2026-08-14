Todo lo que Apollo puede hacer más allá de hablar pasa por un único catálogo tipado de herramientas. El modelo pide una herramienta por su nombre, el router valida los argumentos y el resultado vuelve como algo que Apollo puede decir. Extender el agente significa extender este catálogo, nunca hacer excepciones en el agente mismo.

![Instrumentos pequeños ordenados en una grilla estricta sobre una mesa de trabajo oscura](/handbook/capabilities.jpg)

## El catálogo

Las herramientas integradas, agrupadas por tema:

| Tema | Herramientas |
| --- | --- |
| Clima | `weather_now`, `set_weather_location` |
| Memoria | `remember_fact`, `recall_memory` |
| Conversaciones | `recall_conversation`, `resume_conversation` |
| Foco | `set_focus`, `clear_focus` |
| Búsqueda e investigación | `web_search`, `start_research` |
| Idioma | `translate` |
| Recordatorios | `set_reminder`, `list_reminders`, `cancel_reminder` |
| Temporizadores | `set_timer`, `start_pomodoro` |
| Listas | `add_to_list`, `read_list`, `remove_from_list` |
| Finanzas | `dollar_rate` |
| Correo | `send_email` |
| Dispositivo | `set_volume`, `set_brightness`, `device_status` |
| Sandbox | `sandbox_run_code`, `sandbox_exec` |
| Código | `start_coding_task`, `list_coding_repositories` |

Algunas se comportan de maneras que el nombre no revela:

- **Los temporizadores usan el planificador de recordatorios.** Un pomodoro además activa el modo foco, y `cancel_reminder` también cancela temporizadores.
- **Las listas son duraderas.** Viven en el SQLite propio del escritorio, con una lista por defecto llamada "super".
- **El par de conversación alcanza el pasado.** Recupera lo que se dijo, o retoma un hilo donde quedó.
- **`dollar_rate`** cotiza el dólar argentino desde una API pública sin clave.
- **La búsqueda se divide por latencia.** `web_search` responde en un turno; `start_research` abandona el turno por completo y vuelve más tarde como resultado en segundo plano, con el informe completo también enviado por correo.
- **El trío de dispositivo usa el puente MCP** de [Protocolo](/docs/protocol) hacia el firmware mismo, así el agente puede ajustar el volumen, bajar el brillo o leer el estado del hardware del cuerpo en el que vive.
- **Sandbox y código son opcionales.** Clonar un repositorio, hacer un cambio, correr los tests, abrir un pull request — todo por voz, una vez que aprovisionas ese nivel extra.

## Preguntar primero

Cada herramienta declara `safety: 'safe'` o `'unsafe'`, y ese campo es lo único que dispara una confirmación.

Cuando el modelo pide una herramienta insegura, el router devuelve el pedido en vez de ejecutarlo, el servidor envía `confirm_request` y el dispositivo reemplaza la cara por un resumen con botones Sí/No. El efecto se ejecuta solo con un `confirm` aprobado dentro de 30 segundos. Sin importar cómo termine la ventana —botón, consola, expiración— el dispositivo siempre recibe `confirm_close`, así nunca se queda con un pedido viejo en pantalla.

En el catálogo que viene de fábrica, las herramientas inseguras son el par de sandbox y `start_coding_task`.

Las herramientas que parecen riesgosas pero son `safe` se lo ganan por estructura, no por revisión:

- `send_email` no puede elegir destinatario; está fijada a tu propia dirección.
- `set_weather_location` solo persiste después de un pedido explícito.
- `remove_from_list` necesita coincidencia de ítem o un borrado total explícito.

La doctrina: la seguridad se construye en la forma de la herramienta, nunca se delega a instrucciones del prompt.

## Extender con MCP

El catálogo es la mitad compilada. La otra puerta es el Model Context Protocol: desde la consola conectas un servidor MCP externo en tiempo de ejecución —sin desplegar, sin reflashear— y sus herramientas se fusionan en el mismo mapa en cada turno.

Las herramientas instaladas son estrictamente opcionales. Un servidor recién conectado no aporta nada hasta que habilitas sus herramientas una por una. Un modelo que elige entre setenta herramientas elige peor que uno que elige entre treinta, y todo el valor del escritorio es una respuesta hablada rápida y correcta.

Cada herramienta instalada arranca como `unsafe` —la misma barrera Sí/No que el sandbox— salvo que el servidor la marque como de solo lectura. Puedes cambiarlo herramienta por herramienta cuando un servidor se gana tu confianza. Los servidores detrás de OAuth te dan una URL de login al instalarlos; el agente guarda y renueva los tokens por su cuenta, no hay nada que pegar.

> Esto es código de terceros invocado por voz. Instala servidores a los que le darías una shell.
