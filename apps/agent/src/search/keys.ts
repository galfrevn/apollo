export function buildResearchDocumentObjectKey(
  deviceId: string,
  instanceId: string,
): string {
  return `research/${deviceId}/${instanceId}.md`;
}
