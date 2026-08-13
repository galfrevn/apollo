import { LANDING_MESSAGE_CATALOG } from '@/landing/copy/catalog';
import { LANDING_LINK_MAP } from '@/landing/metadata';
import { LANDING_PUBLIC_ORIGIN } from '@/landing/origin';

import type { LandingMessages } from '@/landing/copy/messages';
import type { Locale } from '@/locale/detect';

export const LANDING_STATIC_OPEN_MARKER = '<!-- landing-static -->';
export const LANDING_STATIC_CLOSE_MARKER = '<!-- /landing-static -->';

export const LANDING_LOCALE_PATH_MAP: Record<Locale, string> = {
  es: '/',
  en: '/en',
};

export const LANDING_SOCIAL_DESCRIPTION_MAP: Record<Locale, string> = {
  es: 'Tu agente personal de escritorio. Un cerebro en tu cuenta de Cloudflare, un cuerpo en tu escritorio, nada en el medio.',
  en: 'Your personal desk agent. A brain in your Cloudflare account, a body on your desk, nothing in between.',
};

export const LANDING_SOCIAL_IMAGE_ALT_MAP: Record<Locale, string> = {
  es: 'La cara de Apollo: dos ojos de cápsula sobre una pantalla oscura.',
  en: 'The Apollo face: two capsule eyes on a dark screen.',
};

export const LANDING_OPEN_GRAPH_LOCALE_MAP: Record<Locale, string> = {
  es: 'es_LA',
  en: 'en_US',
};

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
  return `<p>${leadText}<em>${emphasisText}</em>${trailText}</p>`;
}

function renderCapabilityList(landingMessages: LandingMessages): string {
  const capabilityItemList = landingMessages.capabilities.capabilityRowList.map(
    (capabilityRow) =>
      `<li><h3>${escapeHtmlText(capabilityRow.name)}</h3><p>${escapeHtmlText(capabilityRow.description)}</p></li>`,
  );
  return `<ul>${capabilityItemList.join('')}</ul>`;
}

function renderOwnershipList(landingMessages: LandingMessages): string {
  const ownershipItemList = landingMessages.yours.ownershipCardList.map(
    (ownershipCard) =>
      `<li><h3>${escapeHtmlText(ownershipCard.label)}</h3><p>${escapeHtmlText(ownershipCard.description)}</p></li>`,
  );
  const docsItem = `<li><h3>${escapeHtmlText(landingMessages.yours.docsCardLabel)}</h3><p>${escapeHtmlText(landingMessages.yours.docsCardDescription)}</p><p><a href="${LANDING_LINK_MAP.documentation}">${escapeHtmlText(landingMessages.yours.docsCardAction)}</a></p></li>`;
  const consoleItem = `<li><h3>${escapeHtmlText(landingMessages.yours.consoleCardLabel)}</h3><p>${escapeHtmlText(landingMessages.yours.consoleCardDescription)}</p><p><a href="${LANDING_LINK_MAP.console}">${escapeHtmlText(landingMessages.yours.consoleCardAction)}</a></p></li>`;
  return `<ul>${ownershipItemList.join('')}${docsItem}${consoleItem}</ul>`;
}

export function renderLandingStaticBlock(locale: Locale): string {
  const landingMessages = LANDING_MESSAGE_CATALOG[locale];
  const heroHeading = `${escapeHtmlText(landingMessages.hero.lineOne)} ${escapeHtmlText(landingMessages.hero.lineTwo)}`;
  const navigation = `<nav aria-label="Apollo"><a href="${LANDING_LINK_MAP.github}">${escapeHtmlText(landingMessages.nav.githubLabel)}</a> <a href="${LANDING_LINK_MAP.documentation}">${escapeHtmlText(landingMessages.nav.docsLabel)}</a> <a href="${LANDING_LINK_MAP.console}">${escapeHtmlText(landingMessages.nav.openConsoleLabel)}</a></nav>`;
  const hero = `<header><h1>${heroHeading}</h1><p>${escapeHtmlText(landingMessages.hero.subhead)}</p></header>`;
  const showcaseSection = `<section><h2>${escapeHtmlText(landingMessages.showcase.actTitle)}</h2>${renderEmphasizedParagraph(landingMessages.showcase.intro)}</section>`;
  const architectureSection = `<section><h2>${escapeHtmlText(landingMessages.architecture.actTitle)}</h2>${renderEmphasizedParagraph(landingMessages.architecture.intro)}<p>${escapeHtmlText(landingMessages.architecture.bodyNodeHeadline)} ${escapeHtmlText(landingMessages.architecture.brainNodeHeadline)}</p></section>`;
  const capabilitiesSection = `<section><h2>${escapeHtmlText(landingMessages.capabilities.actTitle)}</h2>${renderEmphasizedParagraph(landingMessages.capabilities.intro)}${renderCapabilityList(landingMessages)}</section>`;
  const yoursSection = `<section><h2>${escapeHtmlText(landingMessages.yours.actTitle)}</h2><p>${escapeHtmlText(landingMessages.yours.introLead)}<em>${escapeHtmlText(landingMessages.yours.introEmphasis)}</em></p>${renderOwnershipList(landingMessages)}</section>`;
  const footer = `<footer><p>${escapeHtmlText(landingMessages.footer.echoWordList.join(' '))}. ${escapeHtmlText(landingMessages.footer.wakePhrase)}</p><p>${escapeHtmlText(landingMessages.footer.builtByPrefix)}<a href="https://github.com/galfrevn">Valentín Galfre</a></p></footer>`;
  return `<div class="mx-auto max-w-3xl px-6 py-16">${navigation}<main>${hero}${showcaseSection}${architectureSection}${capabilitiesSection}${yoursSection}</main>${footer}</div>`;
}

function replaceExactlyOnce(
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

function injectLandingStaticBlock(documentHtml: string, locale: Locale): string {
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
  return `${beforeBlock}${renderLandingStaticBlock(locale)}${afterBlock}`;
}

function stripLandingStaticBlock(documentHtml: string): string {
  const openIndex = documentHtml.indexOf(LANDING_STATIC_OPEN_MARKER);
  const closeIndex = documentHtml.indexOf(LANDING_STATIC_CLOSE_MARKER);
  if (openIndex === -1 || closeIndex === -1 || closeIndex < openIndex) {
    throw new Error('Discovery template drift: landing-static markers missing');
  }
  const afterBlock = documentHtml.slice(closeIndex + LANDING_STATIC_CLOSE_MARKER.length);
  return `${documentHtml.slice(0, openIndex)}${afterBlock}`;
}

function localizeLandingDocument(documentHtml: string): string {
  const spanishMessages = LANDING_MESSAGE_CATALOG.es;
  const englishMessages = LANDING_MESSAGE_CATALOG.en;
  const spanishFeatureList = spanishMessages.capabilities.capabilityRowList
    .map((capabilityRow) => capabilityRow.name)
    .join(', ');
  const englishFeatureList = englishMessages.capabilities.capabilityRowList
    .map((capabilityRow) => capabilityRow.name)
    .join(', ');
  let localizedHtml = documentHtml;
  localizedHtml = replaceExactlyOnce(
    localizedHtml,
    '<html lang="es">',
    '<html lang="en">',
  );
  localizedHtml = replaceExactlyOnce(
    localizedHtml,
    `<title>${spanishMessages.metadata.documentTitle}</title>`,
    `<title>${englishMessages.metadata.documentTitle}</title>`,
  );
  localizedHtml = localizedHtml.replaceAll(
    spanishMessages.metadata.documentDescription,
    englishMessages.metadata.documentDescription,
  );
  localizedHtml = localizedHtml.replaceAll(
    `content="${spanishMessages.metadata.documentTitle}"`,
    `content="${englishMessages.metadata.documentTitle}"`,
  );
  localizedHtml = localizedHtml.replaceAll(
    LANDING_SOCIAL_DESCRIPTION_MAP.es,
    LANDING_SOCIAL_DESCRIPTION_MAP.en,
  );
  localizedHtml = localizedHtml.replaceAll(
    LANDING_SOCIAL_IMAGE_ALT_MAP.es,
    LANDING_SOCIAL_IMAGE_ALT_MAP.en,
  );
  localizedHtml = replaceExactlyOnce(
    localizedHtml,
    `property="og:locale" content="${LANDING_OPEN_GRAPH_LOCALE_MAP.es}"`,
    `property="og:locale" content="${LANDING_OPEN_GRAPH_LOCALE_MAP.en}"`,
  );
  localizedHtml = replaceExactlyOnce(
    localizedHtml,
    `property="og:locale:alternate" content="${LANDING_OPEN_GRAPH_LOCALE_MAP.en}"`,
    `property="og:locale:alternate" content="${LANDING_OPEN_GRAPH_LOCALE_MAP.es}"`,
  );
  localizedHtml = replaceExactlyOnce(
    localizedHtml,
    `<link rel="canonical" href="${LANDING_PUBLIC_ORIGIN}/" />`,
    `<link rel="canonical" href="${LANDING_PUBLIC_ORIGIN}/en" />`,
  );
  localizedHtml = replaceExactlyOnce(
    localizedHtml,
    `property="og:url" content="${LANDING_PUBLIC_ORIGIN}/"`,
    `property="og:url" content="${LANDING_PUBLIC_ORIGIN}/en"`,
  );
  localizedHtml = replaceExactlyOnce(
    localizedHtml,
    spanishFeatureList,
    englishFeatureList,
  );
  return localizedHtml;
}

export function buildLandingDocument(templateHtml: string, locale: Locale): string {
  const documentWithBlock = injectLandingStaticBlock(templateHtml, locale);
  if (locale === 'es') {
    return documentWithBlock;
  }
  return localizeLandingDocument(documentWithBlock);
}

export function buildConsoleDocument(templateHtml: string): string {
  const strippedDocument = stripLandingStaticBlock(templateHtml);
  return replaceExactlyOnce(
    strippedDocument,
    '<meta name="robots" content="index, follow" />',
    '<meta name="robots" content="noindex" />',
  );
}
