import {
  cancel,
  confirm,
  isCancel,
  password,
  select,
  spinner,
  text,
} from '@clack/prompts';

import { searchCityCandidateList, type CityCandidate } from '@/geocode';

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
  readonly validate: (apiKey: string) => Promise<{ isValid: boolean; reason?: string }>;
  readonly isSkippable: boolean;
}): Promise<string | undefined> {
  for (let attemptIndex = 0; attemptIndex < KEY_ATTEMPT_LIMIT; attemptIndex += 1) {
    const enteredKey = requireAnswer(
      await password({ message: input.promptLabel, mask: '•' }),
    );
    const validationSpinner = spinner();
    validationSpinner.start('Validating key');
    const validationResult = await input.validate(enteredKey);
    if (validationResult.isValid) {
      validationSpinner.stop('Key is valid');
      return enteredKey;
    }
    validationSpinner.stop(`Key rejected: ${validationResult.reason ?? 'unknown'}`);
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
      message: 'Which city is this desk in? (empty keeps Buenos Aires)',
      placeholder: 'e.g. Madrid',
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
    geocodeSpinner.stop(error instanceof Error ? error.message : 'geocoding failed');
    return undefined;
  }
  geocodeSpinner.stop(`${candidateList.length} match(es)`);
  if (candidateList.length === 0) {
    return undefined;
  }
  return requireAnswer(
    await select({
      message: 'Which of these?',
      options: candidateList.map((candidate) => ({
        value: candidate,
        label: `${candidate.label} — ${candidate.timezone}`,
      })),
    }),
  );
}

export { KEY_ATTEMPT_LIMIT };
