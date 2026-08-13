import {
  cancel,
  confirm,
  intro,
  note,
  outro,
  password,
  select,
  spinner,
  text,
} from '@clack/prompts';
import { existsSync } from 'node:fs';
import { z } from 'zod';

import {
  readCurrentTtsVoiceId,
  rewriteTimeZone,
  rewriteTtsVoiceId,
  rewriteWeatherLocation,
} from '@/identity';
import {
  listElevenLabsVoiceChoiceList,
  validateOpenRouterApiKey,
  validateResendApiKey,
  validateTavilyApiKey,
} from '@/keys';
import {
  inspectWranglerAuthState,
  isR2Enabled,
  runBootstrapSubcommand,
  runInteractiveWranglerLogin,
} from '@/preflight';
import {
  chooseCity,
  collectValidatedKey,
  KEY_ATTEMPT_LIMIT,
  requireAnswer,
} from '@/prompts';
import { parseDevelopmentVariableMap, upsertDevelopmentVariable } from '@/vars';

const DEVELOPMENT_VARIABLES_FILE = '.dev.vars';
const IDENTITY_FILE = 'src/configuration/identity.ts';

const deploymentStateSchema = z.object({ workerUrl: z.string().url() }).partial();

async function runWizard(): Promise<void> {
  intro('Apollo setup — from nothing to a talking worker');

  if (!existsSync(DEVELOPMENT_VARIABLES_FILE)) {
    await Bun.write(
      DEVELOPMENT_VARIABLES_FILE,
      await Bun.file('.dev.vars.example').text(),
    );
  }

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

  let developmentVariablesContent = await Bun.file(DEVELOPMENT_VARIABLES_FILE).text();
  let identityContent = await Bun.file(IDENTITY_FILE).text();

  const setupMode = requireAnswer(
    await select({
      message: 'Do you have your API keys ready?',
      options: [
        { value: 'real', label: 'Yes — OpenRouter + ElevenLabs (full voice agent)' },
        {
          value: 'trial',
          label: 'Not yet — trial mode (MOCK_VOICE=1, zero external spend)',
        },
      ],
    }),
  );

  if (setupMode === 'real') {
    const openRouterKey = await collectValidatedKey({
      promptLabel: 'OpenRouter API key (openrouter.ai/settings/keys)',
      validate: validateOpenRouterApiKey,
      isSkippable: false,
    });
    if (openRouterKey !== undefined) {
      developmentVariablesContent = upsertDevelopmentVariable(
        developmentVariablesContent,
        'OPENROUTER_API_KEY',
        openRouterKey,
      );
    }

    for (let attemptIndex = 0; attemptIndex < KEY_ATTEMPT_LIMIT; attemptIndex += 1) {
      const elevenLabsKey = requireAnswer(
        await password({
          message: 'ElevenLabs API key (elevenlabs.io → Profile)',
          mask: '•',
        }),
      );
      const voicesSpinner = spinner();
      voicesSpinner.start('Fetching your voice library');
      try {
        const voiceChoiceList = await listElevenLabsVoiceChoiceList(elevenLabsKey);
        voicesSpinner.stop(`${voiceChoiceList.length} voices available`);
        developmentVariablesContent = upsertDevelopmentVariable(
          developmentVariablesContent,
          'ELEVENLABS_API_KEY',
          elevenLabsKey,
        );
        const currentVoiceId = readCurrentTtsVoiceId(identityContent) ?? '';
        const chosenVoiceId = requireAnswer(
          await select({
            message: 'Pick the voice Apollo speaks with',
            options: [
              ...(currentVoiceId !== ''
                ? [{ value: currentVoiceId, label: `Keep current (${currentVoiceId})` }]
                : []),
              ...voiceChoiceList.map((choice) => ({
                value: choice.voiceId,
                label: choice.displayLabel,
              })),
            ],
          }),
        );
        identityContent = rewriteTtsVoiceId(identityContent, chosenVoiceId);
        break;
      } catch (error) {
        voicesSpinner.stop(error instanceof Error ? error.message : 'key rejected');
        if (attemptIndex === KEY_ATTEMPT_LIMIT - 1) {
          cancel('Could not validate the ElevenLabs key.');
          process.exit(1);
        }
      }
    }

    const wantsWebSearch = requireAnswer(
      await confirm({ message: 'Enable web search? (Tavily key, free tier available)' }),
    );
    if (wantsWebSearch) {
      const tavilyKey = await collectValidatedKey({
        promptLabel: 'Tavily API key (app.tavily.com)',
        validate: validateTavilyApiKey,
        isSkippable: true,
      });
      if (tavilyKey !== undefined) {
        developmentVariablesContent = upsertDevelopmentVariable(
          developmentVariablesContent,
          'TAVILY_API_KEY',
          tavilyKey,
        );
      }
    }

    const wantsEmail = requireAnswer(
      await confirm({ message: 'Enable email reports to yourself? (Resend key)' }),
    );
    if (wantsEmail) {
      const resendKey = await collectValidatedKey({
        promptLabel: 'Resend API key (resend.com/api-keys)',
        validate: async (apiKey) => {
          const validationResult = await validateResendApiKey(apiKey);
          // Sending-only Resend keys cannot list domains; accept with a warning.
          return validationResult.isValid
            ? validationResult
            : { isValid: true, reason: undefined };
        },
        isSkippable: true,
      });
      if (resendKey !== undefined) {
        const ownerEmail = requireAnswer(
          await text({
            message:
              'Your email (must be the address you signed up to Resend with, unless you verified a domain)',
            validate: (enteredValue) =>
              z.string().email().safeParse(enteredValue).success
                ? undefined
                : 'That does not look like an email address',
          }),
        );
        developmentVariablesContent = upsertDevelopmentVariable(
          developmentVariablesContent,
          'RESEND_API_KEY',
          resendKey,
        );
        developmentVariablesContent = upsertDevelopmentVariable(
          developmentVariablesContent,
          'APOLLO_OWNER_EMAIL',
          ownerEmail,
        );
      }
    }

    developmentVariablesContent = upsertDevelopmentVariable(
      developmentVariablesContent,
      'MOCK_VOICE',
      '',
    );
  } else {
    developmentVariablesContent = upsertDevelopmentVariable(
      developmentVariablesContent,
      'MOCK_VOICE',
      '1',
    );
  }

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
    [
      'Apollo is live.',
      `  Worker:  ${workerUrl}`,
      `  Device:  ${deviceWebSocketUrl}`,
      '  Secrets: DEVICE_SHARED_SECRET and DASHBOARD_SHARED_SECRET are in .dev.vars',
      '  Console: https://heyapollo.dev/console → your worker URL + instance `desk` + DASHBOARD_SHARED_SECRET',
      variableMap.get('MOCK_VOICE') === '1'
        ? '  Trial mode: replies are mocked — re-run `bun run setup` when you have keys.'
        : `  Try it:  bun run probe -- --url ${workerUrl.replace(/^https/, 'wss')}/agents/apollo/desk --token <DEVICE_SHARED_SECRET> --text "hola"`,
    ].join('\n'),
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
