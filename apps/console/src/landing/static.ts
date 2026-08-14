import { LANDING_MESSAGES } from '@/landing/copy/text';
import { LANDING_COMMAND_MAP, LANDING_LINK_MAP } from '@/landing/metadata';

import type { LandingMessages } from '@/landing/copy/messages';

export const LANDING_STATIC_OPEN_MARKER = '<!-- landing-static -->';
export const LANDING_STATIC_CLOSE_MARKER = '<!-- /landing-static -->';

export const LANDING_SOCIAL_DESCRIPTION =
  'The open source brain for physical agents. It listens, remembers, and acts out loud. You bring the body it speaks through.';

export const LANDING_SOCIAL_IMAGE_ALT =
  'The Apollo face: two capsule eyes on a dark screen.';

function escapeHtmlText(rawText: string): string {
  return rawText
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function renderEmphasizedParagraph(paragraph: {
  readonly lead: string;
  readonly emphasis: string;
  readonly trail: string;
}): string {
  const leadText = escapeHtmlText(paragraph.lead);
  const emphasisText = escapeHtmlText(paragraph.emphasis);
  const trailText = escapeHtmlText(paragraph.trail);
  return `<p class="mt-4 leading-relaxed text-muted-foreground">${leadText}<em class="not-italic text-foreground">${emphasisText}</em>${trailText}</p>`;
}

function renderCapabilityList(landingMessages: LandingMessages): string {
  const capabilityItemList = landingMessages.capabilities.capabilityRowList.map(
    (capabilityRow) =>
      `<li><h3 class="text-base">${escapeHtmlText(capabilityRow.name)}</h3><p class="mt-1 text-sm text-muted-foreground">${escapeHtmlText(capabilityRow.description)}</p></li>`,
  );
  return `<ul class="mt-6 space-y-5">${capabilityItemList.join('')}</ul>`;
}

function renderOwnershipList(landingMessages: LandingMessages): string {
  const ownershipItemList = landingMessages.yours.ownershipCardList.map(
    (ownershipCard) =>
      `<li><h3 class="text-base">${escapeHtmlText(ownershipCard.label)}</h3><p class="mt-1 text-sm text-muted-foreground">${escapeHtmlText(ownershipCard.description)}</p></li>`,
  );
  const docsItem = `<li><h3 class="text-base">${escapeHtmlText(landingMessages.yours.docsCardLabel)}</h3><p class="mt-1 text-sm text-muted-foreground">${escapeHtmlText(landingMessages.yours.docsCardDescription)}</p><p class="mt-1 text-sm"><a class="underline underline-offset-4" href="${LANDING_LINK_MAP.documentation}">${escapeHtmlText(landingMessages.yours.docsCardAction)}</a></p></li>`;
  const consoleItem = `<li><h3 class="text-base">${escapeHtmlText(landingMessages.yours.consoleCardLabel)}</h3><p class="mt-1 text-sm text-muted-foreground">${escapeHtmlText(landingMessages.yours.consoleCardDescription)}</p><p class="mt-1 text-sm"><a class="underline underline-offset-4" href="${LANDING_LINK_MAP.console}">${escapeHtmlText(landingMessages.yours.consoleCardAction)}</a></p></li>`;
  return `<ul class="mt-6 space-y-5">${ownershipItemList.join('')}${docsItem}${consoleItem}</ul>`;
}

function renderStartBlock(landingMessages: LandingMessages): string {
  const startMessages = landingMessages.start;
  return `<h3 class="mt-6 text-base">${escapeHtmlText(startMessages.title)}</h3><p class="mt-1 font-mono text-sm">$ ${LANDING_COMMAND_MAP.bun} · $ ${LANDING_COMMAND_MAP.npm}</p><p class="mt-1 text-sm text-muted-foreground">${escapeHtmlText(startMessages.terminalCaption)}</p><p class="mt-2 text-sm text-muted-foreground">${escapeHtmlText(startMessages.agentPromptLabel)}: ${escapeHtmlText(startMessages.agentPrompt)}</p><p class="mt-1 text-sm text-muted-foreground">${escapeHtmlText(startMessages.agentCaption)}</p>`;
}

export function renderLandingStaticBlock(): string {
  const landingMessages = LANDING_MESSAGES;
  const heroHeading = `${escapeHtmlText(landingMessages.hero.lineOne)} ${escapeHtmlText(landingMessages.hero.lineTwo)}`;
  const navigation = `<nav aria-label="Apollo" class="flex flex-wrap gap-6 text-sm text-muted-foreground"><a class="underline underline-offset-4" href="${LANDING_LINK_MAP.github}">${escapeHtmlText(landingMessages.nav.githubLabel)}</a> <a class="underline underline-offset-4" href="${LANDING_LINK_MAP.documentation}">${escapeHtmlText(landingMessages.nav.docsLabel)}</a> <a class="underline underline-offset-4" href="${LANDING_LINK_MAP.console}">${escapeHtmlText(landingMessages.nav.openConsoleLabel)}</a></nav>`;
  const hero = `<header class="mt-14"><h1 class="font-serif text-5xl leading-[1.05] tracking-[-0.02em]">${heroHeading}</h1><p class="mt-6 max-w-[44ch] text-sm text-muted-foreground">${escapeHtmlText(landingMessages.hero.subhead)}</p><p class="mt-4 font-mono text-sm">$ ${LANDING_COMMAND_MAP.bun}</p></header>`;
  const showcaseSection = `<section class="mt-16 border-t pt-8"><h2 class="font-serif text-2xl">${escapeHtmlText(landingMessages.showcase.actTitle)}</h2>${renderEmphasizedParagraph(landingMessages.showcase.intro)}</section>`;
  const architectureSection = `<section class="mt-16 border-t pt-8"><h2 class="font-serif text-2xl">${escapeHtmlText(landingMessages.architecture.actTitle)}</h2>${renderEmphasizedParagraph(landingMessages.architecture.intro)}<p class="mt-4 leading-relaxed text-muted-foreground">${escapeHtmlText(landingMessages.architecture.bodyNodeHeadline)} ${escapeHtmlText(landingMessages.architecture.brainNodeHeadline)}</p></section>`;
  const capabilitiesSection = `<section class="mt-16 border-t pt-8"><h2 class="font-serif text-2xl">${escapeHtmlText(landingMessages.capabilities.actTitle)}</h2>${renderEmphasizedParagraph(landingMessages.capabilities.intro)}${renderCapabilityList(landingMessages)}</section>`;
  const yoursSection = `<section class="mt-16 border-t pt-8"><h2 class="font-serif text-2xl">${escapeHtmlText(landingMessages.yours.actTitle)}</h2><p class="mt-4 leading-relaxed text-muted-foreground">${escapeHtmlText(landingMessages.yours.introLead)}<em class="not-italic text-foreground">${escapeHtmlText(landingMessages.yours.introEmphasis)}</em></p>${renderStartBlock(landingMessages)}${renderOwnershipList(landingMessages)}</section>`;
  const footer = `<footer class="mt-20 border-t pt-8 text-sm text-muted-foreground"><p>${escapeHtmlText(landingMessages.footer.echoWordList.join(' '))}. ${escapeHtmlText(landingMessages.footer.wakePhrase)}</p><p class="mt-2">${escapeHtmlText(landingMessages.footer.builtByPrefix)}<a class="underline underline-offset-4" href="https://github.com/galfrevn">Valentín Galfre</a></p></footer>`;
  return `<div data-landing-static class="mx-auto max-w-3xl px-6 py-16">${navigation}<main>${hero}${showcaseSection}${architectureSection}${capabilitiesSection}${yoursSection}</main>${footer}</div>`;
}

export function replaceExactlyOnce(
  documentHtml: string,
  searchValue: string,
  replacementValue: string,
): string {
  const firstIndex = documentHtml.indexOf(searchValue);
  if (firstIndex === -1) {
    throw new Error(`Discovery template drift: missing "${searchValue}"`);
  }
  if (documentHtml.indexOf(searchValue, firstIndex + searchValue.length) !== -1) {
    throw new Error(`Discovery template drift: "${searchValue}" appears more than once`);
  }
  return documentHtml.replace(searchValue, replacementValue);
}

function injectLandingStaticBlock(documentHtml: string): string {
  const openIndex = documentHtml.indexOf(LANDING_STATIC_OPEN_MARKER);
  const closeIndex = documentHtml.indexOf(LANDING_STATIC_CLOSE_MARKER);
  if (openIndex === -1 || closeIndex === -1 || closeIndex < openIndex) {
    throw new Error('Discovery template drift: landing-static markers missing');
  }
  const beforeBlock = documentHtml.slice(
    0,
    openIndex + LANDING_STATIC_OPEN_MARKER.length,
  );
  const afterBlock = documentHtml.slice(closeIndex);
  return `${beforeBlock}${renderLandingStaticBlock()}${afterBlock}`;
}

export function stripLandingStaticBlock(documentHtml: string): string {
  const openIndex = documentHtml.indexOf(LANDING_STATIC_OPEN_MARKER);
  const closeIndex = documentHtml.indexOf(LANDING_STATIC_CLOSE_MARKER);
  if (openIndex === -1 || closeIndex === -1 || closeIndex < openIndex) {
    throw new Error('Discovery template drift: landing-static markers missing');
  }
  const afterBlock = documentHtml.slice(closeIndex + LANDING_STATIC_CLOSE_MARKER.length);
  return `${documentHtml.slice(0, openIndex)}${afterBlock}`;
}

export function buildLandingDocument(templateHtml: string): string {
  return injectLandingStaticBlock(templateHtml);
}

export function buildConsoleDocument(templateHtml: string): string {
  const strippedDocument = stripLandingStaticBlock(templateHtml);
  return replaceExactlyOnce(
    strippedDocument,
    '<meta name="robots" content="index, follow" />',
    '<meta name="robots" content="noindex" />',
  );
}
