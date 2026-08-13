import { z } from 'zod';

const DEFAULT_PROBE_TIMEOUT_MILLISECONDS = 15_000;

const serverMessageSchema = z.object({ type: z.string() }).passthrough();

function readFlagValue(
  argumentList: readonly string[],
  flagName: string,
): string | undefined {
  const flagIndex = argumentList.indexOf(flagName);
  return flagIndex >= 0 ? argumentList[flagIndex + 1] : undefined;
}

function formatBinaryFrameForLog(frameBytes: Uint8Array): string {
  const decodedText = new TextDecoder().decode(frameBytes);
  const printableCharacterCount = [...decodedText].filter(
    (character) => character >= ' ' && character <= '~',
  ).length;
  const isMostlyPrintable =
    decodedText.length > 0 && printableCharacterCount / decodedText.length > 0.9;
  return isMostlyPrintable
    ? `binary ${frameBytes.byteLength} bytes (utf-8: "${decodedText.slice(0, 120)}")`
    : `binary ${frameBytes.byteLength} bytes`;
}

function runProbe(input: {
  readonly url: string;
  readonly token: string;
  readonly text: string | undefined;
  readonly timeoutMilliseconds: number;
}): void {
  const connectUrl = input.url.includes('?')
    ? `${input.url}&token=${encodeURIComponent(input.token)}`
    : `${input.url}?token=${encodeURIComponent(input.token)}`;
  const webSocket = new WebSocket(connectUrl);
  webSocket.binaryType = 'arraybuffer';
  let didSendTextTurn = false;

  const timeoutHandle = setTimeout(() => {
    console.log(`(timeout after ${input.timeoutMilliseconds}ms — closing)`);
    webSocket.close();
    process.exit(input.text === undefined ? 0 : 1);
  }, input.timeoutMilliseconds);

  webSocket.addEventListener('open', () => {
    console.log(`→ connected ${input.url}`);
    webSocket.send(JSON.stringify({ type: 'hello', deviceId: 'probe', ts: Date.now() }));
    console.log('→ hello');
  });

  webSocket.addEventListener('message', (messageEvent) => {
    if (typeof messageEvent.data !== 'string') {
      const frameBytes =
        messageEvent.data instanceof ArrayBuffer
          ? new Uint8Array(messageEvent.data)
          : new Uint8Array(0);
      console.log(`← ${formatBinaryFrameForLog(frameBytes)}`);
      return;
    }
    let parsedMessage: unknown;
    try {
      parsedMessage = JSON.parse(messageEvent.data);
    } catch {
      console.log(`← unparseable text frame: ${messageEvent.data.slice(0, 200)}`);
      return;
    }
    const serverMessage = serverMessageSchema.safeParse(parsedMessage);
    if (!serverMessage.success) {
      console.log(`← non-message frame: ${messageEvent.data.slice(0, 200)}`);
      return;
    }
    console.log(`← ${messageEvent.data.slice(0, 400)}`);
    if (
      serverMessage.data.type === 'ui_state' &&
      input.text !== undefined &&
      !didSendTextTurn
    ) {
      didSendTextTurn = true;
      webSocket.send(
        JSON.stringify({ type: 'text_input', text: input.text, ts: Date.now() }),
      );
      console.log(`→ text_input "${input.text}"`);
    }
    if (serverMessage.data.type === 'turn_end' && didSendTextTurn) {
      clearTimeout(timeoutHandle);
      console.log('(turn complete — closing)');
      webSocket.close();
      process.exit(0);
    }
  });

  webSocket.addEventListener('close', (closeEvent) => {
    console.log(`(closed: code ${closeEvent.code})`);
  });

  webSocket.addEventListener('error', () => {
    console.log('(websocket error — check the URL and token)');
    process.exit(1);
  });
}

const probeUrl = readFlagValue(Bun.argv, '--url');
const probeToken = readFlagValue(Bun.argv, '--token');
if (probeUrl === undefined || probeToken === undefined) {
  console.log(
    'usage: bun run probe -- --url wss://<host>/agents/apollo/desk --token <DEVICE_SHARED_SECRET> [--text "hola"] [--timeout 15000]',
  );
  process.exitCode = 1;
} else {
  runProbe({
    url: probeUrl,
    token: probeToken,
    text: readFlagValue(Bun.argv, '--text'),
    timeoutMilliseconds: Number(
      readFlagValue(Bun.argv, '--timeout') ?? DEFAULT_PROBE_TIMEOUT_MILLISECONDS,
    ),
  });
}
