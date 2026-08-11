export type GithubRepositoryReference = {
  readonly owner: string;
  readonly repository: string;
};

const GITHUB_NAME_PATTERN = /^[A-Za-z0-9._-]+$/;

function isUsableGithubName(candidateName: string): boolean {
  return (
    candidateName.length > 0 &&
    candidateName.length <= 100 &&
    GITHUB_NAME_PATTERN.test(candidateName)
  );
}

export function parseGithubRepositoryReference(
  rawReference: string,
): GithubRepositoryReference {
  const trimmedReference = rawReference.trim();
  if (trimmedReference.length === 0) {
    throw new Error('Falta el repositorio');
  }

  const withoutScheme = trimmedReference
    .replace(/^git@github\.com:/i, '')
    .replace(/^https?:\/\//i, '')
    .replace(/^(www\.)?github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');

  const segmentList = withoutScheme.split('/');
  if (segmentList.length !== 2) {
    throw new Error(`No pude interpretar el repositorio "${rawReference}"`);
  }

  const [owner, repository] = segmentList;
  if (!isUsableGithubName(owner) || !isUsableGithubName(repository)) {
    throw new Error(`No pude interpretar el repositorio "${rawReference}"`);
  }

  return { owner, repository };
}

export function formatGithubRepositoryReference(
  reference: GithubRepositoryReference,
): string {
  return `${reference.owner}/${reference.repository}`;
}

export type SpokenRepositoryResolution =
  | { readonly kind: 'match'; readonly fullName: string }
  | { readonly kind: 'ambiguous'; readonly candidateFullNameList: readonly string[] }
  | { readonly kind: 'none' };

// A spoken repo name arrives however the transcriber heard it: "apollo
// firmware", "Apollo-Firmware", "el repo apollo". Separators and case carry
// no information at that point, so matching drops them entirely.
function normalizeRepositoryNameForSpeech(text: string): string {
  return text.toLowerCase().replaceAll(/[\s./_-]+/g, '');
}

export function resolveSpokenRepositoryReference(
  spokenReference: string,
  installedFullNameList: readonly string[],
): SpokenRepositoryResolution {
  const normalizedSpoken = normalizeRepositoryNameForSpeech(spokenReference);
  if (normalizedSpoken.length === 0) {
    return { kind: 'none' };
  }

  const selectMatches = (
    isMatch: (normalizedCandidate: string) => boolean,
  ): readonly string[] =>
    installedFullNameList.filter((fullName) => {
      const shortName = fullName.split('/')[1] ?? '';
      return (
        isMatch(normalizeRepositoryNameForSpeech(shortName)) ||
        isMatch(normalizeRepositoryNameForSpeech(fullName))
      );
    });

  const exactMatchList = selectMatches(
    (normalizedCandidate) => normalizedCandidate === normalizedSpoken,
  );
  const matchList =
    exactMatchList.length > 0
      ? exactMatchList
      : selectMatches((normalizedCandidate) =>
          normalizedCandidate.includes(normalizedSpoken),
        );

  const [firstMatch] = matchList;
  if (firstMatch !== undefined && matchList.length === 1) {
    return { kind: 'match', fullName: firstMatch };
  }
  if (matchList.length > 1) {
    return { kind: 'ambiguous', candidateFullNameList: matchList };
  }
  return { kind: 'none' };
}

// Last line of defence: a command can still echo a token it was handed, so
// anything bound for a log, a document, an email or TTS passes through here.
export function redactSecretsFromText(
  text: string,
  secretList: readonly (string | undefined)[] = [],
): string {
  let redactedText = text;
  for (const secret of secretList) {
    if (secret === undefined || secret.length < 8) {
      continue;
    }
    redactedText = redactedText.replaceAll(secret, '***');
  }
  return redactedText.replaceAll(/gh[pousr]_[A-Za-z0-9]{16,}/g, '***');
}
