import { describe, expect, it } from 'bun:test';

import {
  formatGithubRepositoryReference,
  parseGithubRepositoryReference,
  redactSecretsFromText,
  resolveSpokenRepositoryReference,
} from '@/github/repository';

describe('resolveSpokenRepositoryReference', () => {
  const installedList = [
    'galfrevn/apollo',
    'galfrevn/apollo-firmware',
    'galfrevn/dotfiles',
  ];

  it('matches a bare spoken name regardless of case and separators', () => {
    expect(resolveSpokenRepositoryReference('dotfiles', installedList)).toEqual({
      kind: 'match',
      fullName: 'galfrevn/dotfiles',
    });
    expect(resolveSpokenRepositoryReference('Apollo Firmware', installedList)).toEqual({
      kind: 'match',
      fullName: 'galfrevn/apollo-firmware',
    });
    expect(resolveSpokenRepositoryReference('apollo_firmware', installedList)).toEqual({
      kind: 'match',
      fullName: 'galfrevn/apollo-firmware',
    });
  });

  it('prefers an exact name over a partial containment', () => {
    expect(resolveSpokenRepositoryReference('apollo', installedList)).toEqual({
      kind: 'match',
      fullName: 'galfrevn/apollo',
    });
  });

  it('matches a spoken full name with the owner attached', () => {
    expect(
      resolveSpokenRepositoryReference('galfrevn apollo firmware', installedList),
    ).toEqual({ kind: 'match', fullName: 'galfrevn/apollo-firmware' });
  });

  it('ignores surrounding words in any language without a stopword list', () => {
    expect(resolveSpokenRepositoryReference('el repo apollo', installedList)).toEqual({
      kind: 'match',
      fullName: 'galfrevn/apollo',
    });
    expect(
      resolveSpokenRepositoryReference('the apollo firmware repository', installedList),
    ).toEqual({ kind: 'match', fullName: 'galfrevn/apollo-firmware' });
    expect(
      resolveSpokenRepositoryReference('mis dotfiles de siempre', installedList),
    ).toEqual({ kind: 'match', fullName: 'galfrevn/dotfiles' });
  });

  it('prefers the widest window over its inner names', () => {
    expect(resolveSpokenRepositoryReference('apollo firmware', installedList)).toEqual({
      kind: 'match',
      fullName: 'galfrevn/apollo-firmware',
    });
  });

  it('reports ambiguity instead of guessing', () => {
    const resolution = resolveSpokenRepositoryReference('apol', installedList);
    expect(resolution.kind).toBe('ambiguous');
    if (resolution.kind === 'ambiguous') {
      expect(resolution.candidateFullNameList).toEqual([
        'galfrevn/apollo',
        'galfrevn/apollo-firmware',
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
    const expected = { owner: 'galfrevn', repository: 'apollo' };
    for (const rawReference of [
      'galfrevn/apollo',
      '  galfrevn/apollo  ',
      'github.com/galfrevn/apollo',
      'https://github.com/galfrevn/apollo',
      'https://www.github.com/galfrevn/apollo.git',
      'git@github.com:galfrevn/apollo.git',
      'https://github.com/galfrevn/apollo/',
    ]) {
      expect(parseGithubRepositoryReference(rawReference)).toEqual(expected);
    }
  });

  it('rejects anything that is not a single owner/repository pair', () => {
    for (const rawReference of [
      '',
      '   ',
      'apollo',
      'galfrevn/apollo/tree/main',
      'galfrevn//apollo',
      'gal frevn/apollo',
      'galfrevn/apo llo',
      '../../etc/passwd',
    ]) {
      expect(() => parseGithubRepositoryReference(rawReference)).toThrow();
    }
  });

  it('round-trips through the display format', () => {
    expect(
      formatGithubRepositoryReference(parseGithubRepositoryReference('galfrevn/apollo')),
    ).toBe('galfrevn/apollo');
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
