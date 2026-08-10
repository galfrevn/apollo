import { describe, expect, it } from 'bun:test';

import {
  deliverReminderPayloadSchema,
  expireConfirmPayloadSchema,
  notifyBackgroundResultInputSchema,
} from '@/agents/rpc';

describe('notifyBackgroundResultInputSchema', () => {
  it('accepts a well-formed payload', () => {
    const parsed = notifyBackgroundResultInputSchema.parse({
      prompt: 'resumí las noticias',
      summary: 'Todo tranquilo hoy.',
    });
    expect(parsed).toEqual({
      prompt: 'resumí las noticias',
      summary: 'Todo tranquilo hoy.',
    });
  });

  it('accepts an optional documentKey', () => {
    const parsed = notifyBackgroundResultInputSchema.parse({
      prompt: 'investigá X',
      summary: 'Listo.',
      documentKey: 'research/abc123',
    });
    expect(parsed).toEqual({
      prompt: 'investigá X',
      summary: 'Listo.',
      documentKey: 'research/abc123',
    });
  });

  it('rejects a payload missing required fields', () => {
    expect(() =>
      notifyBackgroundResultInputSchema.parse({ prompt: 'solo prompt' }),
    ).toThrow();
  });

  it('rejects a payload with empty strings', () => {
    expect(() =>
      notifyBackgroundResultInputSchema.parse({ prompt: '', summary: '' }),
    ).toThrow();
  });

  it('rejects a completely malformed payload', () => {
    expect(() => notifyBackgroundResultInputSchema.parse('not an object')).toThrow();
    expect(() => notifyBackgroundResultInputSchema.parse(null)).toThrow();
    expect(() => notifyBackgroundResultInputSchema.parse(undefined)).toThrow();
  });
});

describe('deliverReminderPayloadSchema', () => {
  it('accepts a well-formed payload', () => {
    const parsed = deliverReminderPayloadSchema.parse({
      message: 'Tomá agua',
    });
    expect(parsed).toEqual({ message: 'Tomá agua' });
  });

  it('rejects a payload missing the message field', () => {
    expect(() => deliverReminderPayloadSchema.parse({})).toThrow();
  });

  it('rejects a payload with an empty message', () => {
    expect(() => deliverReminderPayloadSchema.parse({ message: '' })).toThrow();
  });

  it('rejects a completely malformed payload', () => {
    expect(() => deliverReminderPayloadSchema.parse('reminder')).toThrow();
    expect(() => deliverReminderPayloadSchema.parse(null)).toThrow();
  });
});

describe('expireConfirmPayloadSchema', () => {
  it('carries the id of the confirmation the timer was scheduled for', () => {
    expect(expireConfirmPayloadSchema.parse({ confirmationId: 'confirm-1' })).toEqual({
      confirmationId: 'confirm-1',
    });
  });

  it('rejects a payload with no usable confirmation id', () => {
    expect(() => expireConfirmPayloadSchema.parse({})).toThrow();
    expect(() => expireConfirmPayloadSchema.parse({ confirmationId: '' })).toThrow();
    expect(() => expireConfirmPayloadSchema.parse(undefined)).toThrow();
  });
});
