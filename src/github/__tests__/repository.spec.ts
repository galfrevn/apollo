import { describe, expect, it } from 'bun:test';

import {
  formatGithubRepositoryReference,
  parseGithubRepositoryReference,
  redactSecretsFromText,
} from '@/github/repository';

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
