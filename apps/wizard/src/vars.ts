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

// Preserves comments and unknown lines: only the named entry is replaced, or
// appended above the first comment block when absent.
export function upsertDevelopmentVariable(
  fileContent: string,
  variableName: string,
  variableValue: string,
): string {
  const assignmentLine = `${variableName}=${variableValue}`;
  const existingAssignmentPattern = new RegExp(`^${variableName}=.*$`, 'm');
  if (existingAssignmentPattern.test(fileContent)) {
    return fileContent.replace(existingAssignmentPattern, assignmentLine);
  }
  const lineList = fileContent.split('\n');
  const firstCommentIndex = lineList.findIndex((line) => line.startsWith('#'));
  if (firstCommentIndex === -1) {
    return `${fileContent.trimEnd()}\n${assignmentLine}\n`;
  }
  return [
    ...lineList.slice(0, firstCommentIndex),
    assignmentLine,
    ...lineList.slice(firstCommentIndex),
  ].join('\n');
}
