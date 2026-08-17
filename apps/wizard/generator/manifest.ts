export type ForbiddenPatternRule = {
  readonly pattern: string;
  readonly allowedPathPrefixList: readonly string[];
};

export const starterManifest = {
  starterName: 'apollo-starter',
  agentDirectory: 'apps/agent',
  agentCopyList: [
    'src',
    'Dockerfile',
    'docker',
    '.dockerignore',
    'bunfig.toml',
    '.dev.vars.example',
  ],
  rootCopyList: ['LICENSE'],
  skillsDirectory: 'documentation/skills',
  // The handbook stays in the monorepo; skill references to it become links.
  skillsDocumentationLinkPrefix:
    'https://github.com/galfrevn/apollo/blob/main/documentation/',
  identityPlaceholderSwap: {
    relativePath: 'src/configuration/identity.ts',
    from: "export const APOLLO_TTS_VOICE = 'ByVRQtaK1WDOvTmP1PKO';",
    to: "export const APOLLO_TTS_VOICE = '';",
  },
  wranglerRemovedDurableObjectClassList: ['Sandbox'],
  forbiddenPatternList: [
    { pattern: 'galfre.vn', allowedPathPrefixList: [] },
    { pattern: 'ByVRQtaK1WDOvTmP1PKO', allowedPathPrefixList: [] },
    { pattern: 'agent.heyapollo.dev', allowedPathPrefixList: [] },
    {
      pattern: 'heyapollo',
      allowedPathPrefixList: [
        'README.md',
        'CLAUDE.md',
        'AGENTS.md',
        'package.json',
        '.claude/',
      ],
    },
    {
      pattern: 'galfrevn',
      allowedPathPrefixList: [
        'README.md',
        'CLAUDE.md',
        'AGENTS.md',
        'LICENSE',
        '.claude/',
      ],
    },
  ] satisfies readonly ForbiddenPatternRule[],
} as const;
