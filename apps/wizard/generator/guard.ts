import type { ForbiddenPatternRule } from '@/manifest';

export type ForbiddenPatternViolation = {
  readonly relativePath: string;
  readonly pattern: string;
};

export function findForbiddenPatternViolationList(input: {
  readonly fileContentByRelativePath: ReadonlyMap<string, string>;
  readonly ruleList: readonly ForbiddenPatternRule[];
}): readonly ForbiddenPatternViolation[] {
  const violationList: ForbiddenPatternViolation[] = [];
  for (const [relativePath, fileContent] of input.fileContentByRelativePath) {
    const lowercaseContent = fileContent.toLowerCase();
    for (const rule of input.ruleList) {
      const isPatternPresent =
        lowercaseContent.includes(rule.pattern.toLowerCase()) ||
        fileContent.includes(rule.pattern);
      if (!isPatternPresent) {
        continue;
      }
      const isPathAllowed = rule.allowedPathPrefixList.some((allowedPrefix) =>
        relativePath.startsWith(allowedPrefix),
      );
      if (!isPathAllowed) {
        violationList.push({ relativePath, pattern: rule.pattern });
      }
    }
  }
  return violationList;
}
