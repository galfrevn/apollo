export function extractPlainTextFromHtml(htmlDocument: string): string {
  if (htmlDocument.length === 0) {
    return '';
  }

  const withoutScriptsAndStyles = htmlDocument
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ');

  const withoutTags = withoutScriptsAndStyles.replace(/<[^>]+>/g, ' ');
  const withDecodedEntities = withoutTags
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

  return withDecodedEntities.replace(/\s+/g, ' ').trim();
}
