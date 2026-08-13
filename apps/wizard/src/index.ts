import { cancel, confirm, intro, log, note, outro, select } from '@clack/prompts';
import { existsSync } from 'node:fs';
import picocolors from 'picocolors';
import { z } from 'zod';

import { playOpeningBanner } from '@/banner';
import { collectRealModeConfiguration } from '@/configure';
import { rewriteTimeZone, rewriteWeatherLocation } from '@/identity';
import {
  inspectWranglerAuthState,
  isR2Enabled,
  runBootstrapSubcommand,
  runInteractiveWranglerLogin,
} from '@/preflight';
import { chooseCity, requireAnswer } from '@/prompts';
import { buildOutroMessage, buildRecapLineList } from '@/summary';
import {
  renderMutedLine,
  renderPhaseHeader,
  renderSuccessLine,
  TOTAL_PHASE_COUNT,
} from '@/theme';
import { parseDevelopmentVariableMap, upsertDevelopmentVariable } from '@/vars';

const DEVELOPMENT_VARIABLES_FILE = '.dev.vars';
const IDENTITY_FILE = 'src/configuration/identity.ts';

const deploymentStateSchema = z.object({ workerUrl: z.string().url() }).partial();
const packageManifestSchema = z.object({ version: z.string().optional() });

async function readSetupTaglineLabel(): Promise<string> {
  try {
    const packageManifest = packageManifestSchema.parse(
      JSON.parse(await Bun.file('package.json').text()),
    );
    return packageManifest.version === undefined
      ? 'setup'
      : `setup · v${packageManifest.version}`;
  } catch {
    return 'setup';
  }
}

async function confirmCloudflareAccount(): Promise<void> {
  renderPhaseHeader({
    stepNumber: 1,
    totalStepCount: TOTAL_PHASE_COUNT,
    title: 'Cloudflare',
  });
  let authState = inspectWranglerAuthState();
  if (!authState.isLoggedIn) {
    const shouldLogin = requireAnswer(
      await confirm({
        message: 'Not logged into Cloudflare yet. Open the browser login?',
      }),
    );
    if (!shouldLogin || !runInteractiveWranglerLogin()) {
      cancel('Cloudflare login is required. Run `bunx wrangler login` and retry.');
      process.exit(1);
    }
    authState = inspectWranglerAuthState();
  }
  note(authState.accountSummary, 'Cloudflare account');
  const isAccountConfirmed = requireAnswer(
    await confirm({ message: 'Provision into THIS account?' }),
  );
  if (!isAccountConfirmed) {
    cancel(
      'Switch accounts with `bunx wrangler logout && bunx wrangler login`, then retry.',
    );
    process.exit(1);
  }
  while (!isR2Enabled()) {
    note(
      'R2 is not enabled on this account (it needs a payment card on file, even for free usage).\nEnable it at https://dash.cloudflare.com → R2, then continue.',
      'Action needed',
    );
    const shouldRecheck = requireAnswer(await confirm({ message: 'Check again?' }));
    if (!shouldRecheck) {
      cancel('R2 is required for media, TTS cache, and OTA. Retry after enabling it.');
      process.exit(1);
    }
  }
  renderSuccessLine('Cloudflare ready', 'account confirmed · R2 enabled');
}

async function runWizard(): Promise<void> {
  await playOpeningBanner({
    taglineLabel: await readSetupTaglineLabel(),
    isReturningRun: existsSync('.apollo.json'),
  });
  intro(picocolors.bold("Let's set up your desk agent"));

  if (!existsSync(DEVELOPMENT_VARIABLES_FILE)) {
    await Bun.write(
      DEVELOPMENT_VARIABLES_FILE,
      await Bun.file('.dev.vars.example').text(),
    );
  }

  await confirmCloudflareAccount();

  let developmentVariablesContent = await Bun.file(DEVELOPMENT_VARIABLES_FILE).text();
  let identityContent = await Bun.file(IDENTITY_FILE).text();

  const setupMode = requireAnswer(
    await select({
      message: 'Do you have your API keys ready?',
      options: [
        {
          value: 'real',
          label: 'Yes — OpenRouter + ElevenLabs',
          hint: 'full voice agent',
        },
        {
          value: 'trial',
          label: 'Not yet — trial mode',
          hint: 'MOCK_VOICE=1, zero external spend',
        },
      ],
    }),
  );

  let voiceLabel: string | undefined;
  let webSearchLabel: string | undefined;
  let emailLabel: string | undefined;
  if (setupMode === 'real') {
    const realModeConfiguration = await collectRealModeConfiguration({
      developmentVariablesContent,
      identityContent,
    });
    developmentVariablesContent = realModeConfiguration.developmentVariablesContent;
    identityContent = realModeConfiguration.identityContent;
    voiceLabel = realModeConfiguration.voiceLabel;
    webSearchLabel = realModeConfiguration.webSearchLabel;
    emailLabel = realModeConfiguration.emailLabel;
  } else {
    renderMutedLine('Trial mode — skipping Intelligence, Voice, and Extras (2–4).');
    developmentVariablesContent = upsertDevelopmentVariable(
      developmentVariablesContent,
      'MOCK_VOICE',
      '1',
    );
  }

  renderPhaseHeader({
    stepNumber: 5,
    totalStepCount: TOTAL_PHASE_COUNT,
    title: 'Home',
  });
  const chosenCity = await chooseCity();
  if (chosenCity !== undefined) {
    const cityName = chosenCity.label.split(',')[0];
    identityContent = rewriteTimeZone(
      identityContent,
      chosenCity.timezone,
      `hora de ${cityName}`,
    );
    identityContent = rewriteWeatherLocation(identityContent, {
      latitude: chosenCity.latitude,
      longitude: chosenCity.longitude,
      locationLabel: cityName,
      timezone: chosenCity.timezone,
    });
  }
  note(
    'Apollo ships speaking Rioplatense Spanish. Keeping it costs nothing;\nswapping language or voice later is a guided task — see .claude/skills/apollo-persona.',
    'Persona',
  );

  await Bun.write(DEVELOPMENT_VARIABLES_FILE, developmentVariablesContent);
  await Bun.write(IDENTITY_FILE, identityContent);

  renderPhaseHeader({ title: 'Ready to launch' });
  const recapLineList = buildRecapLineList({
    modeLabel:
      setupMode === 'real' ? 'Full voice agent' : 'Trial — replies mocked, zero spend',
    voiceLabel,
    homeLabel:
      chosenCity !== undefined
        ? `${chosenCity.label.split(',')[0]} · ${chosenCity.timezone}`
        : `Buenos Aires ${picocolors.dim('· default')}`,
    webSearchLabel,
    emailLabel,
  });
  for (const recapLine of recapLineList) {
    log.message(recapLine);
  }

  const shouldDeploy = requireAnswer(
    await confirm({
      message: 'Provision the Cloudflare resources and deploy now? (bootstrap all)',
    }),
  );
  if (!shouldDeploy) {
    outro('Saved your answers. Deploy any time with `bun run bootstrap all`.');
    return;
  }
  const didBootstrapSucceed = runBootstrapSubcommand('all');
  if (!didBootstrapSucceed) {
    outro(
      'Bootstrap reported failures — the steps above say which. Fix and re-run `bun run bootstrap all`; it is idempotent.',
    );
    process.exitCode = 1;
    return;
  }

  const variableMap = parseDevelopmentVariableMap(developmentVariablesContent);
  let workerUrl = 'https://<your-worker>.workers.dev';
  if (existsSync('.apollo.json')) {
    const deploymentState = deploymentStateSchema.safeParse(
      JSON.parse(await Bun.file('.apollo.json').text()),
    );
    if (deploymentState.success && deploymentState.data.workerUrl !== undefined) {
      workerUrl = deploymentState.data.workerUrl;
    }
  }
  const deviceWebSocketUrl = `${workerUrl.replace(/^https/, 'wss')}/agents/apollo/desk?token=<DEVICE_SHARED_SECRET>`;
  outro(
    buildOutroMessage({
      workerUrl,
      deviceWebSocketUrl,
      isTrialMode: variableMap.get('MOCK_VOICE') === '1',
    }),
  );
}

if (!process.stdout.isTTY) {
  console.log(
    'No interactive terminal detected — use `bun run bootstrap all` (see .claude/skills/apollo-setup).',
  );
  process.exitCode = 1;
} else {
  await runWizard();
}
