import picocolors from 'picocolors';

const COMPACT_COLUMN_THRESHOLD = 48;
const FACE_COLUMN_WIDTH = 25;
const BLINK_CLOSE_DELAY_MILLISECONDS = 450;
const BLINK_REOPEN_DELAY_MILLISECONDS = 140;
const OPEN_EYE_GLYPH_PAIR = '●  ●';
const CLOSED_EYE_GLYPH_PAIR = '▬  ▬';

const GOLD_COLOR_CODE_LIST = [223, 222, 220, 214, 208, 172] as const;

function paintGold(text: string, rowIndex: number): string {
  if (!picocolors.isColorSupported) {
    return text;
  }
  const colorCode = GOLD_COLOR_CODE_LIST[rowIndex] ?? GOLD_COLOR_CODE_LIST[0];
  return `\u001B[38;5;${colorCode}m${text}\u001B[39m`;
}

function paintFaceDetail(text: string): string {
  return picocolors.bold(picocolors.white(text));
}

type BannerRow = {
  readonly plainFace: string;
  readonly paintedFace: string;
  readonly sideText: string;
};

function composeEyeRow(eyeGlyphPair: string): BannerRow {
  return {
    plainFace: `    ██    ${eyeGlyphPair}    ██`,
    paintedFace:
      paintGold('    ██    ', 2) + paintFaceDetail(eyeGlyphPair) + paintGold('    ██', 2),
    sideText: picocolors.bold(picocolors.yellow('A P O L L O')),
  };
}

function composeDeviceFaceRowList(
  eyeGlyphPair: string,
  taglineLabel: string,
): readonly BannerRow[] {
  return [
    {
      plainFace: '       ▄▄██████▄▄',
      paintedFace: paintGold('       ▄▄██████▄▄', 0),
      sideText: '',
    },
    {
      plainFace: '     ▄██▀      ▀██▄',
      paintedFace: paintGold('     ▄██▀      ▀██▄', 1),
      sideText: '',
    },
    composeEyeRow(eyeGlyphPair),
    {
      plainFace: '    ██     ──     ██',
      paintedFace:
        paintGold('    ██     ', 3) + paintFaceDetail('──') + paintGold('     ██', 3),
      sideText: picocolors.dim('Your desk, listening.'),
    },
    {
      plainFace: '     ▀██▄      ▄██▀',
      paintedFace: paintGold('     ▀██▄      ▄██▀', 4),
      sideText: picocolors.dim(taglineLabel),
    },
    {
      plainFace: '       ▀▀██████▀▀',
      paintedFace: paintGold('       ▀▀██████▀▀', 5),
      sideText: '',
    },
  ];
}

function renderBannerRow(row: BannerRow): string {
  if (row.sideText === '') {
    return row.paintedFace;
  }
  const paddingWidth = Math.max(1, FACE_COLUMN_WIDTH - row.plainFace.length);
  return `${row.paintedFace}${' '.repeat(paddingWidth)}${row.sideText}`;
}

function composeCompactBanner(taglineLabel: string): string {
  return [
    `   ${picocolors.bold(picocolors.yellow(OPEN_EYE_GLYPH_PAIR))}`,
    `   ${picocolors.yellow('‾‾‾‾')}   ${picocolors.bold('apollo')} ${picocolors.dim('— your desk, listening')}`,
    `          ${picocolors.dim(taglineLabel)}`,
  ].join('\n');
}

async function blinkOnce(): Promise<void> {
  const rewriteEyeRow = (eyeGlyphPair: string): void => {
    const eyeRowLine = renderBannerRow(composeEyeRow(eyeGlyphPair));
    // The banner prints six rows plus a blank line, leaving the cursor five
    // lines below the eye row; move up, repaint that single row, move back.
    process.stdout.write(`\u001B[5A\r\u001B[2K${eyeRowLine}\u001B[5B\r`);
  };
  await Bun.sleep(BLINK_CLOSE_DELAY_MILLISECONDS);
  rewriteEyeRow(CLOSED_EYE_GLYPH_PAIR);
  await Bun.sleep(BLINK_REOPEN_DELAY_MILLISECONDS);
  rewriteEyeRow(OPEN_EYE_GLYPH_PAIR);
}

export async function playOpeningBanner(input: {
  readonly taglineLabel: string;
  readonly isReturningRun: boolean;
}): Promise<void> {
  const columnCount = process.stdout.columns ?? 80;
  if (input.isReturningRun || columnCount < COMPACT_COLUMN_THRESHOLD) {
    process.stdout.write(`\n${composeCompactBanner(input.taglineLabel)}\n\n`);
    return;
  }
  const bannerRowList = composeDeviceFaceRowList(OPEN_EYE_GLYPH_PAIR, input.taglineLabel);
  process.stdout.write(`\n${bannerRowList.map(renderBannerRow).join('\n')}\n\n`);
  if (process.stdout.isTTY) {
    await blinkOnce();
  }
}
