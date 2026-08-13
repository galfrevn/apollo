// Must stay behavior-identical to setup/vars.ts (the wizard's copy): the
// wizard writes .dev.vars with one parser and bootstrap reads it with this
// one. A parity test in the monorepo pins the two together.
export function parseDevelopmentVariableMap(fileContent: string): Map<string, string> {
  const variableMap = new Map<string, string>();
  for (const line of fileContent.split('\n')) {
    const separatorIndex = line.indexOf('=');
    if (line.startsWith('#') || separatorIndex <= 0) {
      continue;
    }
    const variableName = line.slice(0, separatorIndex).trim();
    let variableValue = line.slice(separatorIndex + 1).trim();
    if (variableValue.startsWith('"') && variableValue.endsWith('"')) {
      variableValue = variableValue.slice(1, -1).replaceAll('\\n', '\n');
    }
    variableMap.set(variableName, variableValue);
  }
  return variableMap;
}

export function generateSharedSecret(): string {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  return Buffer.from(randomBytes).toString('base64url');
}
