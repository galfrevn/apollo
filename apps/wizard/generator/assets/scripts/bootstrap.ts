import { existsSync } from 'node:fs';
import { z } from 'zod';

import { readFlagValue } from './flags';
import { serverMessageSchema } from './messages';
import { runProvision } from './provision';
import { reportStep, runDocker, runWrangler } from './shell';
import { generateSharedSecret, parseDevelopmentVariableMap } from './vars';

const DEVELOPMENT_VARIABLES_FILE = '.dev.vars';
const DEPLOYMENT_STATE_FILE = '.apollo.json';
const DEVICE_INSTANCE_NAME = 'desk';
const GENERATED_SECRET_NAME_LIST = [
  'DEVICE_SHARED_SECRET',
  'DASHBOARD_SHARED_SECRET',
] as const;
const SECRET_PUSH_EXCLUDED_NAME_LIST = ['MOCK_VOICE'] as const;
const PROBE_TIMEOUT_MILLISECONDS = 10_000;
const DOCKER_COMPOSE_FILE = 'docker/compose.yaml';
const DOCKER_HOST_URL = 'http://localhost:8799';

const healthResponseSchema = z.object({
  ok: z.literal(true),
  name: z.string(),
  features: z.array(z.string()),
});

const deploymentStateSchema = z.object({ workerUrl: z.string().url() });

async function readDevelopmentVariableMap(): Promise<Map<string, string>> {
  if (!existsSync(DEVELOPMENT_VARIABLES_FILE)) {
    return new Map();
  }
  return parseDevelopmentVariableMap(await Bun.file(DEVELOPMENT_VARIABLES_FILE).text());
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
  await reportSharedPreflight();
}

async function runDockerPreflight(): Promise<void> {
  const composeVersionResult = runDocker(['compose', 'version']);
  reportStep(
    'docker compose',
    composeVersionResult.exitCode === 0,
    composeVersionResult.exitCode === 0
      ? composeVersionResult.stdout.trim()
      : 'install Docker (with the compose plugin) and start the daemon first',
  );
  await reportSharedPreflight();
}

async function reportSharedPreflight(): Promise<void> {
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

async function generateMissingSharedSecrets(): Promise<Map<string, string> | undefined> {
  if (!existsSync(DEVELOPMENT_VARIABLES_FILE)) {
    reportStep(
      DEVELOPMENT_VARIABLES_FILE,
      false,
      'missing — copy .dev.vars.example first',
    );
    return undefined;
  }
  let fileContent = await Bun.file(DEVELOPMENT_VARIABLES_FILE).text();
  const variableMap = parseDevelopmentVariableMap(fileContent);
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
  return variableMap;
}

async function runSecrets(): Promise<void> {
  const variableMap = await generateMissingSharedSecrets();
  if (variableMap === undefined) {
    return;
  }
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

// The docker host reads .dev.vars through compose's env_file, so generating
// the shared secrets locally is the whole job — nothing to push anywhere.
async function runDockerSecrets(): Promise<void> {
  await generateMissingSharedSecrets();
}

async function persistWorkerUrl(workerUrl: string): Promise<void> {
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
    `${JSON.stringify({ ...previousStateRecord, workerUrl }, null, 2)}\n`,
  );
}

async function runDockerDeploy(): Promise<void> {
  const upResult = runDocker([
    'compose',
    '-f',
    DOCKER_COMPOSE_FILE,
    'up',
    '-d',
    '--build',
  ]);
  if (upResult.exitCode !== 0) {
    reportStep('docker compose up', false, upResult.stderr.trim().split('\n').at(-1));
    return;
  }
  await persistWorkerUrl(DOCKER_HOST_URL);
  reportStep('docker compose up', true, DOCKER_HOST_URL);
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
  await persistWorkerUrl(deployedUrlMatch[0]);
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
  const webSocketUrl = `${workerUrl.replace(/^http/, 'ws')}/agents/apollo/${DEVICE_INSTANCE_NAME}?token=${encodeURIComponent(deviceSharedSecret)}`;
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

const subcommand = Bun.argv[2];
const urlFlagValue = readFlagValue(Bun.argv, '--url');
const targetFlagValue = readFlagValue(Bun.argv, '--target') ?? 'cloudflare';
const isDockerTarget = targetFlagValue === 'docker';

type BootstrapStage = {
  readonly stageName: string;
  readonly execute: () => Promise<void> | void;
};

// Two deploy targets, one pipeline shape. The docker target has no cloud
// resources to provision and no secret pushes — compose reads .dev.vars.
const stageListByTarget: Record<string, readonly BootstrapStage[]> = {
  cloudflare: [
    { stageName: 'preflight', execute: runPreflight },
    { stageName: 'provision', execute: runProvision },
    { stageName: 'secrets', execute: runSecrets },
    { stageName: 'deploy', execute: runDeploy },
    { stageName: 'verify', execute: () => runVerify(urlFlagValue) },
  ],
  docker: [
    { stageName: 'preflight', execute: runDockerPreflight },
    { stageName: 'secrets', execute: runDockerSecrets },
    { stageName: 'deploy', execute: runDockerDeploy },
    { stageName: 'verify', execute: () => runVerify(urlFlagValue) },
  ],
};
const bootstrapStageList = stageListByTarget[targetFlagValue];
if (bootstrapStageList === undefined) {
  console.log(`unknown --target ${targetFlagValue}; use cloudflare or docker`);
  process.exitCode = 1;
} else {
  switch (subcommand) {
    case 'preflight':
      await (isDockerTarget ? runDockerPreflight() : runPreflight());
      break;
    case 'provision':
      if (isDockerTarget) {
        console.log('nothing to provision for the docker target');
      } else {
        runProvision();
      }
      break;
    case 'secrets':
      await (isDockerTarget ? runDockerSecrets() : runSecrets());
      break;
    case 'deploy':
      await (isDockerTarget ? runDockerDeploy() : runDeploy());
      break;
    case 'verify':
      await runVerify(urlFlagValue);
      break;
    case 'all':
      for (const [stageIndex, stage] of bootstrapStageList.entries()) {
        console.log(
          `\n[${stageIndex + 1}/${bootstrapStageList.length}] ${stage.stageName}`,
        );
        await stage.execute();
      }
      break;
    default:
      console.log(
        'usage: bun run bootstrap <preflight|provision|secrets|deploy|verify|all> [--url https://...] [--target cloudflare|docker]',
      );
      process.exitCode = 1;
  }
}
