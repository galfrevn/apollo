export function readFlagValue(
  argumentList: readonly string[],
  flagName: string,
): string | undefined {
  const flagIndex = argumentList.indexOf(flagName);
  return flagIndex >= 0 ? argumentList[flagIndex + 1] : undefined;
}
