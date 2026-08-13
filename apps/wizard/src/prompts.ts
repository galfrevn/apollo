import {
  cancel,
  confirm,
  isCancel,
  password,
  select,
  spinner,
  text,
} from '@clack/prompts';
import picocolors from 'picocolors';

import { searchCityCandidateList, type CityCandidate } from '@/geocode';
import { renderMutedLine, renderSuccessLine } from '@/theme';
import type { KeyValidationResult } from '@/keys';

const KEY_ATTEMPT_LIMIT = 3;

export function requireAnswer<AnswerType>(answer: AnswerType | symbol): AnswerType {
  if (isCancel(answer)) {
    cancel('Setup cancelled — nothing was deployed.');
    process.exit(130);
  }
  // SAFETY: isCancel strips clack's cancel symbol and process.exit never
  // returns, but TypeScript cannot subtract `symbol` from a bare generic.
  return answer as AnswerType;
}

export async function collectValidatedKey(input: {
  readonly promptLabel: string;
  readonly hintText?: string;
  readonly failureHintText?: string;
  readonly validate: (apiKey: string) => Promise<KeyValidationResult>;
  readonly isSkippable: boolean;
}): Promise<string | undefined> {
  if (input.hintText !== undefined) {
    renderMutedLine(input.hintText);
  }
  for (let attemptIndex = 0; attemptIndex < KEY_ATTEMPT_LIMIT; attemptIndex += 1) {
    const enteredKey = requireAnswer(
      await password({ message: input.promptLabel, mask: '•' }),
    );
    const validationSpinner = spinner();
    validationSpinner.start('Validating key');
    const validationResult = await input.validate(enteredKey);
    if (validationResult.isValid) {
      const detailSuffix =
        validationResult.successDetail === undefined
          ? ''
          : ` ${picocolors.dim(`· ${validationResult.successDetail}`)}`;
      validationSpinner.stop(`${picocolors.green('Key valid')}${detailSuffix}`);
      return enteredKey;
    }
    validationSpinner.stop(
      picocolors.red(`Key rejected — ${validationResult.reason}`),
      2,
    );
    const remainingAttemptCount = KEY_ATTEMPT_LIMIT - attemptIndex - 1;
    if (remainingAttemptCount > 0) {
      renderMutedLine(
        [input.failureHintText, `${remainingAttemptCount} attempt(s) left`]
          .filter((hintPart) => hintPart !== undefined)
          .join(' · '),
      );
    }
    if (input.isSkippable) {
      const shouldRetry = requireAnswer(
        await confirm({ message: 'Try another key? ("No" skips this feature)' }),
      );
      if (!shouldRetry) {
        return undefined;
      }
    }
  }
  cancel(`Could not validate ${input.promptLabel} after ${KEY_ATTEMPT_LIMIT} attempts.`);
  process.exit(1);
}

export async function chooseCity(): Promise<CityCandidate | undefined> {
  const cityQuery = requireAnswer(
    await text({
      message: 'Which city is this desk in?',
      placeholder: 'e.g. Madrid — empty keeps Buenos Aires',
      defaultValue: '',
    }),
  );
  if (cityQuery.trim() === '') {
    return undefined;
  }
  const geocodeSpinner = spinner();
  geocodeSpinner.start('Looking up the city');
  let candidateList: readonly CityCandidate[];
  try {
    candidateList = await searchCityCandidateList(cityQuery.trim());
  } catch (error) {
    geocodeSpinner.stop(error instanceof Error ? error.message : 'geocoding failed', 2);
    return undefined;
  }
  if (candidateList.length === 0) {
    geocodeSpinner.stop(picocolors.red('No matches — keeping Buenos Aires'), 2);
    return undefined;
  }
  geocodeSpinner.stop(`${candidateList.length} match(es)`);
  const chosenCandidate = requireAnswer(
    await select({
      message: 'Which of these?',
      options: candidateList.map((candidate) => ({
        value: candidate,
        label: candidate.label,
        hint: candidate.timezone,
      })),
    }),
  );
  renderSuccessLine('Home set', `${chosenCandidate.label} · ${chosenCandidate.timezone}`);
  return chosenCandidate;
}

export { KEY_ATTEMPT_LIMIT };
