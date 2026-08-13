import picocolors from 'picocolors';

const RECAP_LABEL_COLUMN_WIDTH = 13;

export type SetupRecap = {
  readonly modeLabel: string;
  readonly voiceLabel?: string;
  readonly homeLabel: string;
  readonly webSearchLabel?: string;
  readonly emailLabel?: string;
};

function composeRecapRow(rowLabel: string, rowValue: string): string {
  return `${picocolors.dim(rowLabel.padEnd(RECAP_LABEL_COLUMN_WIDTH))}${rowValue}`;
}

export function buildRecapLineList(recap: SetupRecap): readonly string[] {
  const recapRowList: string[] = [
    composeRecapRow('Mode', picocolors.bold(recap.modeLabel)),
  ];
  if (recap.voiceLabel !== undefined) {
    recapRowList.push(composeRecapRow('Voice', recap.voiceLabel));
  }
  recapRowList.push(composeRecapRow('Home', recap.homeLabel));
  if (recap.webSearchLabel !== undefined) {
    recapRowList.push(composeRecapRow('Web search', recap.webSearchLabel));
  }
  if (recap.emailLabel !== undefined) {
    recapRowList.push(composeRecapRow('Email', recap.emailLabel));
  }
  return recapRowList;
}

export function buildOutroMessage(input: {
  readonly workerUrl: string;
  readonly deviceWebSocketUrl: string;
  readonly isTrialMode: boolean;
}): string {
  const outroLineList = [
    picocolors.bold(picocolors.green('✦ Apollo is live')),
    '',
    `   ${picocolors.dim('Worker'.padEnd(10))}${picocolors.cyan(input.workerUrl)}`,
    `   ${picocolors.dim('Device'.padEnd(10))}${picocolors.cyan(input.deviceWebSocketUrl)}`,
    `   ${picocolors.dim('Console'.padEnd(10))}${picocolors.cyan('https://heyapollo.dev/console')} ${picocolors.dim('→ worker URL + instance `desk` + DASHBOARD_SHARED_SECRET')}`,
    `   ${picocolors.dim('Secrets'.padEnd(10))}DEVICE_SHARED_SECRET and DASHBOARD_SHARED_SECRET are in .dev.vars`,
    '',
  ];
  if (input.isTrialMode) {
    outroLineList.push(
      `   ${picocolors.dim('Trial mode: replies are mocked — re-run `bun run setup` when you have keys.')}`,
    );
  } else {
    outroLineList.push(
      `   ${picocolors.dim('Say hello:')}`,
      `   ${picocolors.yellow(`bun run probe -- --url ${input.deviceWebSocketUrl.split('?')[0]} --token <DEVICE_SHARED_SECRET> --text "hola"`)}`,
    );
  }
  return outroLineList.join('\n');
}
