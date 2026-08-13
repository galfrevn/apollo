import { describe, expect, it } from 'bun:test';

import { mcpCallToolResultSchema, summarizeMcpCallToolResult } from '@/mcp/result';

describe('mcp call tool result summary', () => {
  it('joins every text entry of a successful call', () => {
    expect(
      summarizeMcpCallToolResult(
        mcpCallToolResultSchema.safeParse({
          content: [
            { type: 'text', text: 'first' },
            { type: 'text', text: 'second' },
          ],
        }),
        'Listo.',
        'Falló.',
      ),
    ).toEqual({ ok: true, summary: 'first\nsecond' });
  });

  it('ignores content entries that carry no text', () => {
    expect(
      summarizeMcpCallToolResult(
        mcpCallToolResultSchema.safeParse({
          content: [{ type: 'image' }, { type: 'text', text: 'only this' }],
        }),
        'Listo.',
        'Falló.',
      ),
    ).toEqual({ ok: true, summary: 'only this' });
  });

  it('treats isError as a failure and keeps the server text', () => {
    expect(
      summarizeMcpCallToolResult(
        mcpCallToolResultSchema.safeParse({
          content: [{ type: 'text', text: 'rate limited' }],
          isError: true,
        }),
        'Listo.',
        'Falló.',
      ),
    ).toEqual({ ok: false, summary: 'rate limited' });
  });

  it('uses the error summary when a failure carries no text', () => {
    expect(
      summarizeMcpCallToolResult(
        mcpCallToolResultSchema.safeParse({ content: [], isError: true }),
        'Listo.',
        'Falló.',
      ),
    ).toEqual({ ok: false, summary: 'Falló.' });
  });

  it('uses the fallback summary for an empty or unrecognized result', () => {
    expect(
      summarizeMcpCallToolResult(
        mcpCallToolResultSchema.safeParse({}),
        'Listo.',
        'Falló.',
      ),
    ).toEqual({
      ok: true,
      summary: 'Listo.',
    });
    expect(
      summarizeMcpCallToolResult(
        mcpCallToolResultSchema.safeParse(42),
        'Listo.',
        'Falló.',
      ),
    ).toEqual({
      ok: true,
      summary: 'Listo.',
    });
    expect(
      summarizeMcpCallToolResult(
        mcpCallToolResultSchema.safeParse(null),
        'Listo.',
        'Falló.',
      ),
    ).toEqual({
      ok: true,
      summary: 'Listo.',
    });
  });
});
