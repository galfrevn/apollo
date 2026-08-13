import { cancel, confirm, password, select, spinner, text } from '@clack/prompts';
import picocolors from 'picocolors';
import { z } from 'zod';

import { readCurrentTtsVoiceId, rewriteTtsVoiceId } from '@/identity';
import {
  listElevenLabsVoiceChoiceList,
  validateOpenRouterApiKey,
  validateResendApiKey,
  validateTavilyApiKey,
} from '@/keys';
import { collectValidatedKey, KEY_ATTEMPT_LIMIT, requireAnswer } from '@/prompts';
import { renderMutedLine, renderPhaseHeader, TOTAL_PHASE_COUNT } from '@/theme';
import { upsertDevelopmentVariable } from '@/vars';

async function chooseVoice(identityContent: string): Promise<{
  readonly elevenLabsKey: string;
  readonly identityContent: string;
  readonly voiceLabel: string;
}> {
  renderMutedLine('elevenlabs.io → Profile');
  for (let attemptIndex = 0; attemptIndex < KEY_ATTEMPT_LIMIT; attemptIndex += 1) {
    const elevenLabsKey = requireAnswer(
      await password({ message: 'ElevenLabs API key', mask: '•' }),
    );
    const voicesSpinner = spinner();
    voicesSpinner.start('Fetching your voice library');
    try {
      const voiceChoiceList = await listElevenLabsVoiceChoiceList(elevenLabsKey);
      voicesSpinner.stop(
        picocolors.green(`${voiceChoiceList.length} voices in your library`),
      );
      const currentVoiceId = readCurrentTtsVoiceId(identityContent) ?? '';
      const chosenVoiceId = requireAnswer(
        await select({
          message: 'Pick the voice Apollo speaks with',
          options: [
            ...(currentVoiceId !== ''
              ? [{ value: currentVoiceId, label: 'Keep current', hint: currentVoiceId }]
              : []),
            ...voiceChoiceList.map((choice) => ({
              value: choice.voiceId,
              label: choice.displayLabel,
              hint: choice.detailHint,
            })),
          ],
        }),
      );
      const chosenVoice = voiceChoiceList.find(
        (choice) => choice.voiceId === chosenVoiceId,
      );
      return {
        elevenLabsKey,
        identityContent: rewriteTtsVoiceId(identityContent, chosenVoiceId),
        voiceLabel: chosenVoice?.displayLabel ?? `Keep current (${chosenVoiceId})`,
      };
    } catch (error) {
      voicesSpinner.stop(
        picocolors.red(error instanceof Error ? error.message : 'key rejected'),
        2,
      );
      const remainingAttemptCount = KEY_ATTEMPT_LIMIT - attemptIndex - 1;
      if (remainingAttemptCount > 0) {
        renderMutedLine(`${remainingAttemptCount} attempt(s) left`);
      }
    }
  }
  cancel('Could not validate the ElevenLabs key.');
  process.exit(1);
}

export type RealModeConfiguration = {
  readonly developmentVariablesContent: string;
  readonly identityContent: string;
  readonly voiceLabel: string;
  readonly webSearchLabel: string;
  readonly emailLabel: string;
};

export async function collectRealModeConfiguration(input: {
  readonly developmentVariablesContent: string;
  readonly identityContent: string;
}): Promise<RealModeConfiguration> {
  let developmentVariablesContent = input.developmentVariablesContent;

  renderPhaseHeader({
    stepNumber: 2,
    totalStepCount: TOTAL_PHASE_COUNT,
    title: 'Intelligence',
  });
  const openRouterKey = await collectValidatedKey({
    promptLabel: 'OpenRouter API key',
    hintText: 'openrouter.ai/settings/keys · stays in .dev.vars, never committed',
    failureHintText: 'keys start with sk-or-… · check for a trailing space',
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

  renderPhaseHeader({
    stepNumber: 3,
    totalStepCount: TOTAL_PHASE_COUNT,
    title: 'Voice',
  });
  const voiceSetup = await chooseVoice(input.identityContent);
  developmentVariablesContent = upsertDevelopmentVariable(
    developmentVariablesContent,
    'ELEVENLABS_API_KEY',
    voiceSetup.elevenLabsKey,
  );

  renderPhaseHeader({
    stepNumber: 4,
    totalStepCount: TOTAL_PHASE_COUNT,
    title: 'Extras',
  });
  let webSearchLabel = picocolors.dim('skipped');
  const wantsWebSearch = requireAnswer(
    await confirm({ message: 'Enable web search? (Tavily key, free tier available)' }),
  );
  if (wantsWebSearch) {
    const tavilyKey = await collectValidatedKey({
      promptLabel: 'Tavily API key',
      hintText: 'app.tavily.com · the free tier is enough',
      validate: validateTavilyApiKey,
      isSkippable: true,
    });
    if (tavilyKey !== undefined) {
      developmentVariablesContent = upsertDevelopmentVariable(
        developmentVariablesContent,
        'TAVILY_API_KEY',
        tavilyKey,
      );
      webSearchLabel = `${picocolors.green('on')} ${picocolors.dim('· Tavily')}`;
    }
  }

  let emailLabel = picocolors.dim('skipped');
  const wantsEmail = requireAnswer(
    await confirm({ message: 'Enable email reports to yourself? (Resend key)' }),
  );
  if (wantsEmail) {
    const resendKey = await collectValidatedKey({
      promptLabel: 'Resend API key',
      hintText: 'resend.com/api-keys',
      validate: async (apiKey) => {
        const validationResult = await validateResendApiKey(apiKey);
        // Sending-only Resend keys cannot list domains; accept with a warning.
        return validationResult.isValid ? validationResult : { isValid: true };
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
      emailLabel = `${picocolors.green('on')} ${picocolors.dim(`· reports to ${ownerEmail}`)}`;
    }
  }

  developmentVariablesContent = upsertDevelopmentVariable(
    developmentVariablesContent,
    'MOCK_VOICE',
    '',
  );
  return {
    developmentVariablesContent,
    identityContent: voiceSetup.identityContent,
    voiceLabel: voiceSetup.voiceLabel,
    webSearchLabel,
    emailLabel,
  };
}
