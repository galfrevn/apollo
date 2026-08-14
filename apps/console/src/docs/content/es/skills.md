El proyecto generado lleva su propio manual como seis skills de agente en `.claude/skills/`: runbooks escritos para un agente de código, no para una persona. Abre la carpeta con [Claude Code](https://claude.com/claude-code) o cualquier agente que lea `AGENTS.md` y, en vez de leer documentación, delegas: el agente carga la skill correcta y opera Apollo por ti.

![Un handbook abierto que se deshace en hilos de luz recibidos por una mano robótica](/handbook/skills.jpg)

## Las seis skills

| Skill | Qué maneja |
| --- | --- |
| `apollo-setup` | El runbook de despliegue desde cero: aprovisionamiento, secretos, edición de identidad y un primer turno hablado verificado |
| `apollo-protocol` | El contrato de comunicación canónico: cada mensaje, el formato de audio, autenticación, el puente MCP, OTA |
| `apollo-firmware` | Construir un cuerpo para cualquier hardware: qué subconjunto del protocolo implementar, en qué orden y cómo validarlo contra el simulador antes de que exista el hardware |
| `apollo-persona` | Identidad, voz, idioma y región: cambiar la voz de ElevenLabs, dejar el español rioplatense, mover la zona horaria y la ciudad del clima, renombrar al asistente |
| `apollo-tooling` | Capacidades hacia adentro y hacia afuera: escribir una definición de herramienta, la doctrina safe/unsafe, conectar servidores MCP, habilitar el sandbox de código |
| `apollo-operate` | Operación diaria: depurar un worker en vivo, publicar firmware por OTA, leer telemetría, techos de costo, actualizar desde una copia upstream |

Cada skill codifica la doctrina junto con los pasos. `apollo-setup` sabe que los scripts de bootstrap son la única forma sancionada de tocar tu cuenta de Cloudflare. `apollo-tooling` sabe que una herramienta se gana el `safe` por construcción y nunca por texto del prompt. El agente hereda el criterio del proyecto, no solo sus comandos.

## Cómo funciona una sesión

La primera sesión canónica es una sola oración:

> set this up for me

El agente corre el mismo recorrido que el asistente de instalación —preflight, aprovisionamiento, secretos, despliegue, verificación— narrando a medida que avanza.

Una regla es innegociable y la skill la hace cumplir: **las claves nunca entran al chat.** Las claves de API las pegas directo en `.dev.vars`, que está en el gitignore, y el agente trabaja alrededor de ese archivo en vez de a través de él. Si intentas pegarle una clave al agente, te va a redirigir.

## Más allá de la instalación

El mismo patrón cubre todo el arco de tener Apollo:

- *"Haz que hable español mexicano"* → `apollo-persona` mapea cada archivo donde vive el idioma.
- *"Agrega una herramienta que revise el estado de mi servidor"* → `apollo-tooling` recorre la definición, el catálogo y la decisión de seguridad.
- *"Publica esta compilación de firmware"* → `apollo-operate` maneja la subida a R2 y el manifiesto en el orden correcto.

Las skills son la razón por la que el starter no necesita un README largo: el manual es ejecutable, y el que lo lee es el agente.
