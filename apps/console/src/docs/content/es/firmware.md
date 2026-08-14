El cuerpo es la mitad que puedes sostener: firmware para un dispositivo chico, siempre encendido, que captura tu voz, dibuja una cara y reproduce las respuestas de Apollo. La implementación de referencia vive en [github.com/galfrevn/apollo-firmware](https://github.com/galfrevn/apollo-firmware).

Primero la doctrina: **el firmware se adapta a Apollo, nunca al revés.** El contrato de comunicación del cerebro es fijo, y cualquier hardware que hable el subconjunto de [Protocolo](/docs/protocol) es un cuerpo legítimo, con pantalla o sin ella.

![Vista despiezada del dispositivo redondo: vidrio, pantalla, placa, malla del parlante y carcasa](/handbook/firmware.jpg)

## El cuerpo de referencia

La placa de referencia es la Waveshare ESP32-S3-Touch-LCD-1.85C V2: una pantalla táctil redonda de 360×360 del tamaño de un posavasos, con micrófono, parlante y soporte de batería.

El firmware es un proyecto C++ de ESP-IDF —FreeRTOS por debajo, Opus para la captura, reproducción en PCM crudo— derivado del proyecto xiaozhi-esp32 y recortado a esta única placa. Dibuja la cara, detecta la palabra de activación en el propio dispositivo, transmite audio en ambas direcciones y reporta telemetría.

También lleva su propio handbook dentro del repositorio, que cubre el toolchain, el camino del audio, el táctil, los sonidos y el aprovisionamiento con el mismo estilo de capítulos que este. Lo que sigue es la versión corta.

## Compilar

El toolchain es ESP-IDF v6 con Python 3.10 o superior. Con el entorno de IDF exportado, la compilación es un solo script — el prefijo del fabricante es obligatorio:

```sh
python scripts/build.py waveshare/esp32-s3-touch-lcd-1.85c
```

La salida queda en `build/`: la imagen de la app `xiaozhi.bin`, los recursos de expresiones, el bootloader, la tabla de particiones y un `merged-binary.bin` que combina todo.

> El script de compilación termina con código 0 incluso cuando la compilación falla. Revisa la salida buscando líneas `[ERROR]` o `FAILED:` antes de flashear, o vas a flashear el binario anterior y depurar un fantasma.

## Flashear

Conecta la placa por USB —en macOS aparece como `/dev/cu.usbmodem*`— y flashea desde el directorio `build/`:

```sh
python -m esptool --chip esp32s3 -b 460800 --before default-reset \
  --after hard-reset write-flash "@flash_args"
```

> Nunca cambies manualmente las líneas serie DTR/RTS. Dejan el chip en modo de descarga de ROM en silencio, donde parece muerto pero solo está esperando. Al capturar logs por serie, desactiva ambas líneas antes de abrir el puerto.

## Apuntarlo a tu cerebro

Un cuerpo necesita tres valores: dónde vive el cerebro, la credencial y su nombre. Hay dos formas de dárselos.

**En tiempo de compilación** — el camino cómodo. Define esto en la configuración del firmware antes de compilar:

| Ajuste | Valor |
| --- | --- |
| `CONFIG_APOLLO_URL` | Tu worker, `wss://apollo.<tu-cuenta>.workers.dev` |
| `CONFIG_APOLLO_TOKEN` | El `DEVICE_SHARED_SECRET` de tu `.dev.vars` |
| `CONFIG_APOLLO_DEVICE_ID` | El nombre de instancia, `desk`; vacío usa la dirección MAC |

**Por dispositivo** — el namespace de NVS `apollo`, con las claves `url`, `token` y `device_id`, tiene prioridad sobre los valores de compilación. Un mismo binario puede servir a varios escritorios, y un dispositivo puede reapuntarse sin recompilar.

El WiFi no necesita ningún secreto de compilación. En el primer arranque, o cuando sus credenciales dejan de funcionar, el dispositivo abre su propio punto de acceso y sirve una página de configuración donde eliges la red. Una vez en línea se conecta al worker, y en el mismo instante en que su `hello` llega al cerebro, el panel de estado de la consola y un `bun run bootstrap verify` lo van a ver.

## Mantenerlo al día

Las actualizaciones pasan por el cerebro. Publica una versión subiendo primero la imagen de la app y después el manifiesto —el binario primero, así ningún dispositivo lee un manifiesto que apunta a un archivo inexistente:

```sh
bunx wrangler r2 object put apollo-media/firmware/apollo-2.5.0.bin \
  --file build/xiaozhi.bin --content-type application/octet-stream --remote
bunx wrangler r2 object put apollo-media/firmware/latest.json \
  --file latest.json --content-type application/json --remote
```

El manifiesto nombra la versión y la clave del objeto, con un changelog opcional. Sube `xiaozhi.bin`, nunca `merged-binary.bin`: la OTA reemplaza solo la partición de la app.

Los dispositivos revisan una vez al arrancar, y el cerebro también empuja la actualización por el puente MCP cuando la telemetría muestra un dispositivo inactivo, enchufado y desactualizado. La skill `apollo-operate` automatiza toda la secuencia.
