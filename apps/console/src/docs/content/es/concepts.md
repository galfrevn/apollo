Cuatro palabras sostienen el resto del handbook: escritorio, turno, sesión y herramienta. Los capítulos siguientes las dan por sabidas, así que se definen una sola vez, acá.

![Una esfera brillante rodeada por siete estados más pequeños en órbitas finas](/handbook/concepts.jpg)

## El escritorio

Un **escritorio** es una instancia del agente: un Durable Object nombrado por la ruta de conexión. Un dispositivo que se conecta a `/agents/apollo/desk` habla con la instancia llamada `desk`.

Ese nombre es la identidad. Cada instancia guarda su propia memoria, sus preferencias y su trabajo pendiente, así que dos nombres son dos Apollos distintos. `desk` es la convención que asume el tooling; solo inventas más nombres cuando corres más de un escritorio.

El escritorio también es una máquina de estados chica. En cada momento está en exactamente un modo:

`idle` · `listening` · `thinking` · `confirm` · `speaking` · `focus` · `dashboard`

El servidor le empuja cada transición al dispositivo como un mensaje `ui_state`, junto con el subtítulo, la emoción de la cara y el tiempo de foco restante. El cuerpo nunca adivina qué dibujar: se lo dicen.

## Turnos y sesiones

Un **turno** es una intervención procesada de punta a punta: despiertas el dispositivo o mantienes presionado para hablar, el audio viaja al worker y la respuesta vuelve como voz. Dentro del turno el servidor transcribe cuando hace falta, deja que el modelo razone y llame herramientas, y sintetiza la respuesta. [Ciclo](/docs/loop) recorre cada paso.

Los turnos se acumulan en una **sesión**: el hilo de conversación que guarda el Durable Object, con su propio ciclo de corte y recuperación. Los turnos consecutivos comparten contexto sin que el hilo crezca para siempre.

El trabajo demasiado lento para un intercambio hablado —investigación profunda, una tarea de código— abandona el turno interactivo por completo y vuelve más tarde como un `background_result`. Mientras tanto, el escritorio sigue respondiendo.

## Herramientas

Una **herramienta** es una acción tipada que el modelo puede pedir en vez de responder de memoria: consultar el clima, crear un recordatorio, recordar un dato, arrancar una investigación.

Cada herramienta declara su nivel de seguridad, y ese campo por sí solo decide qué pasa después:

| Seguridad | Qué ocurre |
| --- | --- |
| `safe` | La herramienta se ejecuta de inmediato |
| `unsafe` | El dispositivo muestra un resumen con botones Sí/No y espera tu respuesta antes de ejecutar el efecto |

El catálogo integrado se compila dentro del worker. Los servidores que conectas por MCP se fusionan en el mismo mapa en tiempo de ejecución. [Capacidades](/docs/capabilities) cubre ambos, y la doctrina detrás de la división.
