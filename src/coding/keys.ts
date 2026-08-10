export function buildCodingDocumentObjectKey(
  deviceId: string,
  instanceId: string,
): string {
  return `coding/${deviceId}/${instanceId}.md`;
}

export function buildCodingSandboxId(instanceId: string): string {
  // Derived from the instance, not random, so a retried step re-attaches to the
  // same container instead of cloning into a fresh one.
  return `apollo-coding-${instanceId}`;
}
