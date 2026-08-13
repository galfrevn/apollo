import { describe, expect, it } from 'bun:test';

import { copyTextUsingWriter } from '@/components/clipboard';

describe('copyTextUsingWriter', () => {
  it('resolves true and forwards the text when the writer succeeds', async () => {
    const writtenTextList: string[] = [];
    const didCopy = await copyTextUsingWriter(async (text) => {
      writtenTextList.push(text);
    }, 'bun create heyapollo');

    expect(didCopy).toBe(true);
    expect(writtenTextList).toEqual(['bun create heyapollo']);
  });

  it('resolves false when the writer rejects', async () => {
    const didCopy = await copyTextUsingWriter(
      () => Promise.reject(new Error('clipboard denied')),
      'bun create heyapollo',
    );

    expect(didCopy).toBe(false);
  });

  it('resolves false when the writer throws synchronously', async () => {
    const didCopy = await copyTextUsingWriter(() => {
      throw new Error('no clipboard in this context');
    }, 'npm create heyapollo');

    expect(didCopy).toBe(false);
  });
});
