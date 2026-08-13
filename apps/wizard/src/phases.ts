import { log } from '@clack/prompts';

export const WIZARD_PHASE_LIST = [
  'Cloudflare account',
  'API keys',
  'Persona & location',
  'Deploy',
] as const;

export type WizardPhaseName = (typeof WIZARD_PHASE_LIST)[number];

export function announceWizardPhase(phaseName: WizardPhaseName): void {
  const phasePosition = WIZARD_PHASE_LIST.indexOf(phaseName) + 1;
  log.step(`${phasePosition}/${WIZARD_PHASE_LIST.length} · ${phaseName}`);
}
