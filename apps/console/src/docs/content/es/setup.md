Apollo se despliega con un solo comando. Genera el starter —el cerebro sin los valores personales del autor—, inicializa git, instala dependencias y te entrega a un asistente interactivo que termina en un worker vivo y un handshake de dispositivo verificado.

Todavía no tener claves es una respuesta de primera clase: el modo de prueba despliega un cerebro completamente correcto a nivel protocolo, con cero gasto externo.

![Un cursor de terminal enviando una línea de luz hacia infraestructura lejana](/handbook/setup.jpg)

## Qué necesitas

- [Bun](https://bun.sh), el runtime y gestor de paquetes.
- Una cuenta de Cloudflare. El plan gratuito alcanza, aunque R2 pide una tarjeta registrada incluso con costo cero.
- Una clave de API de [OpenRouter](https://openrouter.ai) para razonamiento, transcripción y embeddings.
- Una clave de API de [ElevenLabs](https://elevenlabs.io) y una voz para la síntesis de habla.
- Opcional: [Tavily](https://tavily.com) para búsqueda web, [Resend](https://resend.com) para reportes por correo, y Workers Paid más Docker para el sandbox de código.

¿Todavía sin claves? Despliega en modo de prueba (`MOCK_VOICE=1`, ya preparado en `.dev.vars.example`): voz simulada, todo lo demás real, cero gasto.

## Un comando

```sh
bun create heyapollo
```

```sh
npm create heyapollo
```

La plantilla viene embebida en el paquete: no hay clonado ni descarga. Pasa un nombre de directorio para generar el proyecto en otro lado que no sea `apollo/`, y omite cualquier paso con `--no-install`, `--no-setup` o `--no-git`. El asistente se puede volver a correr en cualquier momento desde la raíz del proyecto con `bun run setup`.

## El asistente, fase por fase

1. **Cuenta de Cloudflare.** Te loguea con `wrangler` si hace falta, después muestra exactamente qué cuenta va a tocar y pregunta antes de aprovisionar sobre ella. También verifica que R2 esté habilitado.
2. **Claves de API.** Eliges claves reales o modo de prueba. Las claves reales se validan en vivo antes de escribir nada, y la voz de Apollo se elige de tu propia biblioteca de ElevenLabs. Las claves quedan en `.dev.vars`; los secretos compartidos se generan por ti.
3. **Personalidad y ubicación.** Tu ciudad define la zona horaria y el clima por defecto en `src/configuration/identity.ts`. El starter habla español rioplatense por defecto; cambiar idioma, voz o región es una tarea guiada en `.claude/skills/apollo-persona`.
4. **Despliegue.** Aprovisiona R2, Vectorize y la cola, sube los secretos, despliega el worker y verifica con un handshake real de dispositivo. Termina imprimiendo la URL de tu worker, la dirección WebSocket del dispositivo y el puntero a la consola.

## O pídeselo a tu agente

Abre la carpeta generada con [Claude Code](https://claude.com/claude-code) o cualquier agente que lea `AGENTS.md` y dile:

> set this up for me

La skill `apollo-setup` guía al agente por todo el recorrido. Las claves las pegas tú en `.dev.vars`; nunca entran al chat.

## A mano

Cada paso del asistente tiene su equivalente en script:

```sh
bun install
bunx wrangler login
cp .dev.vars.example .dev.vars     # completa tus claves, o deja MOCK_VOICE=1
bun run bootstrap preflight        # confirma en qué cuenta de Cloudflare estás
bun run bootstrap provision        # buckets de R2, índice de Vectorize, cola
bun run bootstrap secrets          # genera los secretos compartidos y los sube al worker
bun run bootstrap deploy           # wrangler deploy
bun run bootstrap verify           # /health más una sonda real de handshake
```

## Primer turno hablado

No hace falta hardware: el script de sonda sostiene un WebSocket de grado dispositivo desde tu terminal.

```sh
bun run probe -- --url wss://apollo.<tu-cuenta>.workers.dev/agents/apollo/desk \
  --token <DEVICE_SHARED_SECRET de .dev.vars> --text "hola"
```

Un dispositivo físico apunta a `wss://<tu-worker>/agents/apollo/desk?token=<DEVICE_SHARED_SECRET>`; el contrato de comunicación está en [Protocolo](/docs/protocol).

Para administrar el despliegue desde el navegador, la consola alojada en [heyapollo.dev/console](https://heyapollo.dev/console) se conecta directo a tu worker con tres valores: la URL del worker, el nombre de instancia `desk` y tu `DASHBOARD_SHARED_SECRET`. Los tres se quedan en el almacenamiento local de tu navegador.
