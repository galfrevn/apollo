import { existsSync } from 'node:fs';
import { z } from 'zod';

const R2_BUCKET_NAME = 'apollo-media';
const R2_PREVIEW_BUCKET_NAME = 'apollo-media-preview';
const VECTORIZE_INDEX_NAME = 'apollo-memory';
// Pinned to OPENROUTER_EMBEDDING_MODEL (openai/text-embedding-3-small): a
// wrong-dims index rejects every upsert silently and Apollo never remembers.
const VECTORIZE_DIMENSION_COUNT = 1536;
const VECTORIZE_METRIC = 'cosine';
const QUEUE_NAME = 'apollo-jobs';
const DEVICE_INSTANCE_NAME = 'desk';
const DEVELOPMENT_VARIABLES_FILE = '.dev.vars';
const DEPLOYMENT_STATE_FILE = '.apollo.json';
const GENERATED_SECRET_NAME_LIST = [
  'DEVICE_SHARED_SECRET',
  'DASHBOARD_SHARED_SECRET',
] as const;
const SECRET_PUSH_EXCLUDED_NAME_LIST = ['MOCK_VOICE'] as const;
const PROBE_TIMEOUT_MILLISECONDS = 10_000;

const healthResponseSchema = z.object({
  ok: z.literal(true),
  name: z.string(),
  features: z.array(z.string()),
});

const deploymentStateSchema = z.object({ workerUrl: z.string().url() });

const serverMessageSchema = z.object({ type: z.string() });

type CommandResult = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
};

function runWrangler(
  argumentList: readonly string[],
  standardInputText?: string,
): CommandResult {
  const spawnResult = Bun.spawnSync(['bunx', 'wrangler', ...argumentList], {
    stdin:
      standardInputText === undefined
        ? 'ignore'
        : new TextEncoder().encode(standardInputText),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  return {
    exitCode: spawnResult.exitCode,
    stdout: spawnResult.stdout.toString(),
    stderr: spawnResult.stderr.toString(),
  };
}

function reportStep(stepLabel: string, isOk: boolean, detail?: string): void {
  const marker = isOk ? 'ok' : 'FAIL';
  console.log(`[${marker}] ${stepLabel}${detail ? ` — ${detail}` : ''}`);
  if (!isOk) {
    process.exitCode = 1;
  }
}

async function readDevelopmentVariableMap(): Promise<Map<string, string>> {
  const variableMap = new Map<string, string>();
  if (!existsSync(DEVELOPMENT_VARIABLES_FILE)) {
    return variableMap;
  }
  const fileContent = await Bun.file(DEVELOPMENT_VARIABLES_FILE).text();
  for (const line of fileContent.split('\n')) {
    const separatorIndex = line.indexOf('=');
    if (line.startsWith('#') || separatorIndex <= 0) {
      continue;
    }
    const variableName = line.slice(0, separatorIndex).trim();
    let variableValue = line.slice(separatorIndex + 1).trim();
    if (variableValue.startsWith('"') && variableValue.endsWith('"')) {
      variableValue = variableValue.slice(1, -1).replaceAll('\\n', '\n');
    }
    variableMap.set(variableName, variableValue);
  }
  return variableMap;
}

function generateSharedSecret(): string {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  return Buffer.from(randomBytes).toString('base64url');
}

async function runPreflight(): Promise<void> {
  const whoamiResult = runWrangler(['whoami']);
  reportStep(
    'wrangler auth',
    whoamiResult.exitCode === 0,
    whoamiResult.exitCode === 0
      ? whoamiResult.stdout.trim().split('\n').slice(-3).join(' | ')
      : 'run `bunx wrangler login` first',
  );
  const hasDevelopmentVariables = existsSync(DEVELOPMENT_VARIABLES_FILE);
  reportStep(
    DEVELOPMENT_VARIABLES_FILE,
    hasDevelopmentVariables,
    hasDevelopmentVariables
      ? undefined
      : 'run `cp .dev.vars.example .dev.vars` and fill it',
  );
  const variableMap = await readDevelopmentVariableMap();
  const identityContent = await Bun.file('src/configuration/identity.ts').text();
  const isVoicePlaceholderEmpty = identityContent.includes(
    "export const APOLLO_TTS_VOICE = '';",
  );
  if (isVoicePlaceholderEmpty && variableMap.get('MOCK_VOICE') !== '1') {
    console.log(
      '[warn] APOLLO_TTS_VOICE in src/configuration/identity.ts is still empty — real TTS will fail. Fill it, or set MOCK_VOICE=1 for trial mode.',
    );
  }
}

function ensureResourceExists(input: {
  readonly resourceLabel: string;
  readonly createArgumentList: readonly string[];
  readonly verifyArgumentList: readonly string[];
}): void {
  const createResult = runWrangler(input.createArgumentList);
  if (createResult.exitCode === 0) {
    reportStep(input.resourceLabel, true, 'created');
    return;
  }
  const verifyResult = runWrangler(input.verifyArgumentList);
  reportStep(
    input.resourceLabel,
    verifyResult.exitCode === 0,
    verifyResult.exitCode === 0
      ? 'already exists'
      : createResult.stderr.trim().split('\n').at(-1),
  );
}

function runProvision(): void {
  ensureResourceExists({
    resourceLabel: `r2 bucket ${R2_BUCKET_NAME}`,
    createArgumentList: ['r2', 'bucket', 'create', R2_BUCKET_NAME],
    verifyArgumentList: ['r2', 'bucket', 'info', R2_BUCKET_NAME],
  });
  ensureResourceExists({
    resourceLabel: `r2 bucket ${R2_PREVIEW_BUCKET_NAME}`,
    createArgumentList: ['r2', 'bucket', 'create', R2_PREVIEW_BUCKET_NAME],
    verifyArgumentList: ['r2', 'bucket', 'info', R2_PREVIEW_BUCKET_NAME],
  });
  ensureResourceExists({
    resourceLabel: `vectorize index ${VECTORIZE_INDEX_NAME}`,
    createArgumentList: [
      'vectorize',
      'create',
      VECTORIZE_INDEX_NAME,
      `--dimensions=${VECTORIZE_DIMENSION_COUNT}`,
      `--metric=${VECTORIZE_METRIC}`,
    ],
    verifyArgumentList: ['vectorize', 'get', VECTORIZE_INDEX_NAME],
  });
  const vectorizeDetails = runWrangler(['vectorize', 'get', VECTORIZE_INDEX_NAME]);
  if (
    vectorizeDetails.exitCode === 0 &&
    !vectorizeDetails.stdout.includes(String(VECTORIZE_DIMENSION_COUNT))
  ) {
    reportStep(
      'vectorize dimensions',
      false,
      `index does not report ${VECTORIZE_DIMENSION_COUNT} dimensions — delete it (\`bunx wrangler vectorize delete ${VECTORIZE_INDEX_NAME}\`) and re-run provision`,
    );
  }
  ensureResourceExists({
    resourceLabel: `queue ${QUEUE_NAME}`,
    createArgumentList: ['queues', 'create', QUEUE_NAME],
    verifyArgumentList: ['queues', 'info', QUEUE_NAME],
  });
}

async function runSecrets(): Promise<void> {
  if (!existsSync(DEVELOPMENT_VARIABLES_FILE)) {
    reportStep(
      DEVELOPMENT_VARIABLES_FILE,
      false,
      'missing — copy .dev.vars.example first',
    );
    return;
  }
  let fileContent = await Bun.file(DEVELOPMENT_VARIABLES_FILE).text();
  const variableMap = await readDevelopmentVariableMap();
  for (const secretName of GENERATED_SECRET_NAME_LIST) {
    const currentValue = variableMap.get(secretName) ?? '';
    if (currentValue !== '' && !currentValue.startsWith('dev-')) {
      continue;
    }
    const generatedValue = generateSharedSecret();
    variableMap.set(secretName, generatedValue);
    fileContent = fileContent.match(new RegExp(`^${secretName}=`, 'm'))
      ? fileContent.replace(
          new RegExp(`^${secretName}=.*$`, 'm'),
          `${secretName}=${generatedValue}`,
        )
      : `${fileContent.trimEnd()}\n${secretName}=${generatedValue}\n`;
    reportStep(`generate ${secretName}`, true);
  }
  await Bun.write(DEVELOPMENT_VARIABLES_FILE, fileContent);
  const excludedNameSet = new Set<string>(SECRET_PUSH_EXCLUDED_NAME_LIST);
  for (const [variableName, variableValue] of variableMap) {
    if (variableValue === '' || excludedNameSet.has(variableName)) {
      continue;
    }
    const putResult = runWrangler(['secret', 'put', variableName], variableValue);
    reportStep(
      `secret ${variableName}`,
      putResult.exitCode === 0,
      putResult.exitCode === 0 ? undefined : putResult.stderr.trim().split('\n').at(-1),
    );
  }
}

async function runDeploy(): Promise<void> {
  const deployResult = runWrangler(['deploy']);
  console.log(deployResult.stdout);
  if (deployResult.exitCode !== 0) {
    reportStep('wrangler deploy', false, deployResult.stderr.trim().split('\n').at(-1));
    return;
  }
  const deployedUrlMatch = deployResult.stdout.match(/https:\/\/\S+\.workers\.dev/);
  if (deployedUrlMatch === null) {
    reportStep(
      'wrangler deploy',
      true,
      'deployed, but no workers.dev URL found in output',
    );
    return;
  }
  let previousStateRecord: Record<string, unknown> = {};
  if (existsSync(DEPLOYMENT_STATE_FILE)) {
    const parsedState = z
      .record(z.unknown())
      .safeParse(JSON.parse(await Bun.file(DEPLOYMENT_STATE_FILE).text()));
    if (parsedState.success) {
      previousStateRecord = parsedState.data;
    }
  }
  await Bun.write(
    DEPLOYMENT_STATE_FILE,
    `${JSON.stringify({ ...previousStateRecord, workerUrl: deployedUrlMatch[0] }, null, 2)}\n`,
  );
  reportStep('wrangler deploy', true, deployedUrlMatch[0]);
}

async function resolveWorkerUrl(urlFlagValue: string | undefined): Promise<string> {
  if (urlFlagValue !== undefined) {
    return urlFlagValue;
  }
  if (!existsSync(DEPLOYMENT_STATE_FILE)) {
    throw new Error(
      `no ${DEPLOYMENT_STATE_FILE} yet — run \`bun run bootstrap deploy\` first or pass --url`,
    );
  }
  const deploymentState = deploymentStateSchema.parse(
    JSON.parse(await Bun.file(DEPLOYMENT_STATE_FILE).text()),
  );
  return deploymentState.workerUrl;
}

async function probeDeviceHandshake(
  workerUrl: string,
  deviceSharedSecret: string,
): Promise<string> {
  const webSocketUrl = `${workerUrl.replace(/^https/, 'wss')}/agents/apollo/${DEVICE_INSTANCE_NAME}?token=${encodeURIComponent(deviceSharedSecret)}`;
  return new Promise((resolve, reject) => {
    const webSocket = new WebSocket(webSocketUrl);
    const timeoutHandle = setTimeout(() => {
      webSocket.close();
      reject(new Error(`no ui_state within ${PROBE_TIMEOUT_MILLISECONDS}ms`));
    }, PROBE_TIMEOUT_MILLISECONDS);
    webSocket.addEventListener('open', () => {
      webSocket.send(
        JSON.stringify({ type: 'hello', deviceId: 'bootstrap-verify', ts: Date.now() }),
      );
    });
    webSocket.addEventListener('message', (messageEvent) => {
      if (typeof messageEvent.data !== 'string') {
        return;
      }
      let parsedMessage: unknown;
      try {
        parsedMessage = JSON.parse(messageEvent.data);
      } catch {
        return;
      }
      const serverMessage = serverMessageSchema.safeParse(parsedMessage);
      if (serverMessage.success && serverMessage.data.type === 'ui_state') {
        clearTimeout(timeoutHandle);
        webSocket.close();
        resolve('hello → ui_state');
      }
    });
    webSocket.addEventListener('close', (closeEvent) => {
      if (closeEvent.code === 1006) {
        clearTimeout(timeoutHandle);
        reject(new Error('connection rejected — check DEVICE_SHARED_SECRET (401?)'));
      }
    });
    webSocket.addEventListener('error', () => {
      clearTimeout(timeoutHandle);
      reject(new Error('websocket error — check the URL and DEVICE_SHARED_SECRET'));
    });
  });
}

async function runVerify(urlFlagValue: string | undefined): Promise<void> {
  const workerUrl = await resolveWorkerUrl(urlFlagValue);
  try {
    const healthResponse = await fetch(`${workerUrl}/health`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MILLISECONDS),
    });
    const healthPayload = healthResponseSchema.parse(await healthResponse.json());
    reportStep('/health', true, `features: ${healthPayload.features.join(', ')}`);
  } catch (error) {
    reportStep('/health', false, error instanceof Error ? error.message : String(error));
    return;
  }
  const variableMap = await readDevelopmentVariableMap();
  const deviceSharedSecret = variableMap.get('DEVICE_SHARED_SECRET') ?? '';
  if (deviceSharedSecret === '') {
    reportStep('device probe', false, 'DEVICE_SHARED_SECRET missing in .dev.vars');
    return;
  }
  try {
    const probeSummary = await probeDeviceHandshake(workerUrl, deviceSharedSecret);
    reportStep('device probe', true, probeSummary);
  } catch (error) {
    reportStep(
      'device probe',
      false,
      error instanceof Error ? error.message : String(error),
    );
  }
}

function readFlagValue(
  argumentList: readonly string[],
  flagName: string,
): string | undefined {
  const flagIndex = argumentList.indexOf(flagName);
  return flagIndex >= 0 ? argumentList[flagIndex + 1] : undefined;
}

const subcommand = Bun.argv[2];
const urlFlagValue = readFlagValue(Bun.argv, '--url');
switch (subcommand) {
  case 'preflight':
    await runPreflight();
    break;
  case 'provision':
    runProvision();
    break;
  case 'secrets':
    await runSecrets();
    break;
  case 'deploy':
    await runDeploy();
    break;
  case 'verify':
    await runVerify(urlFlagValue);
    break;
  case 'all':
    await runPreflight();
    runProvision();
    await runSecrets();
    await runDeploy();
    await runVerify(urlFlagValue);
    break;
  default:
    console.log(
      'usage: bun run bootstrap <preflight|provision|secrets|deploy|verify|all> [--url https://...]',
    );
    process.exitCode = 1;
}
