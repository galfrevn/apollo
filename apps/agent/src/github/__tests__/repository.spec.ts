import { describe, expect, it } from 'bun:test';

import {
  formatGithubRepositoryReference,
  parseGithubRepositoryReference,
  redactSecretsFromText,
  resolveSpokenRepositoryReference,
} from '@/github/repository';

describe('resolveSpokenRepositoryReference', () => {
  const installedList = ['example/apollo', 'example/apollo-firmware', 'example/dotfiles'];

  it('matches a bare spoken name regardless of case and separators', () => {
    expect(resolveSpokenRepositoryReference('dotfiles', installedList)).toEqual({
      kind: 'match',
      fullName: 'example/dotfiles',
    });
    expect(resolveSpokenRepositoryReference('Apollo Firmware', installedList)).toEqual({
      kind: 'match',
      fullName: 'example/apollo-firmware',
    });
    expect(resolveSpokenRepositoryReference('apollo_firmware', installedList)).toEqual({
      kind: 'match',
      fullName: 'example/apollo-firmware',
    });
  });

  it('prefers an exact name over a partial containment', () => {
    expect(resolveSpokenRepositoryReference('apollo', installedList)).toEqual({
      kind: 'match',
      fullName: 'example/apollo',
    });
  });

  it('matches a spoken full name with the owner attached', () => {
    expect(
      resolveSpokenRepositoryReference('example apollo firmware', installedList),
    ).toEqual({ kind: 'match', fullName: 'example/apollo-firmware' });
  });

  it('ignores surrounding words in any language without a stopword list', () => {
    expect(resolveSpokenRepositoryReference('el repo apollo', installedList)).toEqual({
      kind: 'match',
      fullName: 'example/apollo',
    });
    expect(
      resolveSpokenRepositoryReference('the apollo firmware repository', installedList),
    ).toEqual({ kind: 'match', fullName: 'example/apollo-firmware' });
    expect(
      resolveSpokenRepositoryReference('mis dotfiles de siempre', installedList),
    ).toEqual({ kind: 'match', fullName: 'example/dotfiles' });
  });

  it('prefers the widest window over its inner names', () => {
    expect(resolveSpokenRepositoryReference('apollo firmware', installedList)).toEqual({
      kind: 'match',
      fullName: 'example/apollo-firmware',
    });
  });

  it('prefers the longer match when a generically named repository also matches', () => {
    const listWithGenericName = ['example/repo', 'example/apollo'];
    expect(
      resolveSpokenRepositoryReference('el repo apollo', listWithGenericName),
    ).toEqual({ kind: 'match', fullName: 'example/apollo' });
    expect(resolveSpokenRepositoryReference('el repo', listWithGenericName)).toEqual({
      kind: 'match',
      fullName: 'example/repo',
    });
  });

  it('reports ambiguity instead of guessing', () => {
    const resolution = resolveSpokenRepositoryReference('apol', installedList);
    expect(resolution.kind).toBe('ambiguous');
    if (resolution.kind === 'ambiguous') {
      expect(resolution.candidateFullNameList).toEqual([
        'example/apollo',
        'example/apollo-firmware',
      ]);
    }
  });

  it('reports none for an unknown name or empty input', () => {
    expect(resolveSpokenRepositoryReference('inexistente', installedList)).toEqual({
      kind: 'none',
    });
    expect(resolveSpokenRepositoryReference('   ', installedList)).toEqual({
      kind: 'none',
    });
  });
});

describe('parseGithubRepositoryReference', () => {
  it('accepts the shapes a user might say or paste', () => {
    const expected = { owner: 'example', repository: 'apollo' };
    for (const rawReference of [
      'example/apollo',
      '  example/apollo  ',
      'github.com/example/apollo',
      'https://github.com/example/apollo',
      'https://www.github.com/example/apollo.git',
      'git@github.com:example/apollo.git',
      'https://github.com/example/apollo/',
    ]) {
      expect(parseGithubRepositoryReference(rawReference)).toEqual(expected);
    }
  });

  it('rejects anything that is not a single owner/repository pair', () => {
    for (const rawReference of [
      '',
      '   ',
      'apollo',
      'example/apollo/tree/main',
      'example//apollo',
      'gal frevn/apollo',
      'example/apo llo',
      '../../etc/passwd',
    ]) {
      expect(() => parseGithubRepositoryReference(rawReference)).toThrow();
    }
  });

  it('round-trips through the display format', () => {
    expect(
      formatGithubRepositoryReference(parseGithubRepositoryReference('example/apollo')),
    ).toBe('example/apollo');
  });
});

describe('redactSecretsFromText', () => {
  it('removes a known secret from command output', () => {
    const redacted = redactSecretsFromText(
      'remote: https://x-access-token:supersecrettoken@github.com/o/r',
      ['supersecrettoken'],
    );
    expect(redacted).not.toContain('supersecrettoken');
    expect(redacted).toContain('***');
  });

  it('removes github token shapes even when the value was never passed in', () => {
    const redacted = redactSecretsFromText(
      'fatal: auth failed for ghs_abcdefghijklmnopqrstuvwxyz0123456789',
      [],
    );
    expect(redacted).not.toContain('ghs_abcdefghijklmnopqrstuvwxyz0123456789');
  });

  it('leaves ordinary output alone and ignores short or missing secrets', () => {
    expect(redactSecretsFromText('todo bien', ['ab', undefined])).toBe('todo bien');
  });
});
