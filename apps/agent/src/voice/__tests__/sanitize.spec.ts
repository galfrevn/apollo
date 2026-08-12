import { describe, expect, it } from 'bun:test';

import { sanitizeTextForSpeech } from '@/voice/sanitize';

describe('sanitizeTextForSpeech', () => {
  it('leaves plain spoken text untouched', () => {
    const text = 'Mañana a las 9 llueve en Buenos Aires. ¿Te aviso de nuevo?';
    expect(sanitizeTextForSpeech(text)).toBe(text);
  });

  it('strips bold and italic markers', () => {
    expect(sanitizeTextForSpeech('Es **muy** importante y *urgente*.')).toBe(
      'Es muy importante y urgente.',
    );
    expect(sanitizeTextForSpeech('Es __muy__ importante y _urgente_.')).toBe(
      'Es muy importante y urgente.',
    );
  });

  it('keeps word-internal underscores', () => {
    expect(sanitizeTextForSpeech('La variable se llama set_weather_location.')).toBe(
      'La variable se llama set_weather_location.',
    );
  });

  it('strips inline code and fences but keeps content', () => {
    expect(sanitizeTextForSpeech('Usá `weather_now` para eso.')).toBe(
      'Usá weather_now para eso.',
    );
    expect(sanitizeTextForSpeech('```bash\nbun run dev\n```')).toBe('bun run dev');
  });

  it('strips headings, quotes, and list bullets', () => {
    expect(
      sanitizeTextForSpeech(
        '## Pendientes\n- comprar pan\n* pagar la luz\n1. llamar a mamá',
      ),
    ).toBe('Pendientes\ncomprar pan\npagar la luz\nllamar a mamá');
    expect(sanitizeTextForSpeech('> dijo que sí')).toBe('dijo que sí');
  });

  it('reduces links and images to their labels', () => {
    expect(
      sanitizeTextForSpeech(
        'Mirá [la nota](https://example.com) y ![el gráfico](https://example.com/img.png).',
      ),
    ).toBe('Mirá la nota y el gráfico.');
  });

  it('drops unpaired emphasis runs and extra blank lines', () => {
    expect(sanitizeTextForSpeech('Listo **\n\n\n\nChau')).toBe('Listo\n\nChau');
  });
});
