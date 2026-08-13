// wrangler.jsonc carries comments, so JSON.parse cannot read it directly. This
// stripper walks characters instead of using a regex because comment markers
// can legally appear inside string values ("https://…").
export function stripJsoncComments(jsoncText: string): string {
  let strippedText = '';
  let isInsideString = false;
  let index = 0;
  while (index < jsoncText.length) {
    const currentCharacter = jsoncText[index];
    const nextCharacter = jsoncText[index + 1];
    if (isInsideString) {
      strippedText += currentCharacter;
      if (currentCharacter === '\\') {
        strippedText += nextCharacter ?? '';
        index += 2;
        continue;
      }
      if (currentCharacter === '"') {
        isInsideString = false;
      }
      index += 1;
      continue;
    }
    if (currentCharacter === '"') {
      isInsideString = true;
      strippedText += currentCharacter;
      index += 1;
      continue;
    }
    if (currentCharacter === '/' && nextCharacter === '/') {
      while (index < jsoncText.length && jsoncText[index] !== '\n') {
        index += 1;
      }
      continue;
    }
    if (currentCharacter === '/' && nextCharacter === '*') {
      index += 2;
      while (index < jsoncText.length) {
        if (jsoncText[index] === '*' && jsoncText[index + 1] === '/') {
          index += 2;
          break;
        }
        index += 1;
      }
      continue;
    }
    strippedText += currentCharacter;
    index += 1;
  }
  return strippedText;
}

// JSON.parse rejects the trailing commas wrangler's JSONC allows, so they are
// removed after comment stripping (outside strings only).
export function stripTrailingCommas(jsonText: string): string {
  let strippedText = '';
  let isInsideString = false;
  for (let index = 0; index < jsonText.length; index += 1) {
    const currentCharacter = jsonText[index];
    if (isInsideString) {
      strippedText += currentCharacter;
      if (currentCharacter === '\\') {
        strippedText += jsonText[index + 1] ?? '';
        index += 1;
        continue;
      }
      if (currentCharacter === '"') {
        isInsideString = false;
      }
      continue;
    }
    if (currentCharacter === '"') {
      isInsideString = true;
      strippedText += currentCharacter;
      continue;
    }
    if (currentCharacter === ',') {
      let lookaheadIndex = index + 1;
      while (lookaheadIndex < jsonText.length && /\s/.test(jsonText[lookaheadIndex])) {
        lookaheadIndex += 1;
      }
      const closingCharacter = jsonText[lookaheadIndex];
      if (closingCharacter === '}' || closingCharacter === ']') {
        continue;
      }
    }
    strippedText += currentCharacter;
  }
  return strippedText;
}

export function parseJsoncDocument(jsoncText: string): unknown {
  return JSON.parse(stripTrailingCommas(stripJsoncComments(jsoncText)));
}
