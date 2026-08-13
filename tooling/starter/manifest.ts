export type TextRewriteRule = {
  readonly from: string;
  readonly to: string;
};

export type ForbiddenPatternRule = {
  readonly pattern: string;
  readonly allowedPathPrefixList: readonly string[];
};

export const starterManifest = {
  starterName: 'apollo-starter',
  agentDirectory: 'apps/agent',
  agentCopyList: ['src', 'Dockerfile', 'bunfig.toml', '.dev.vars.example'],
  rootCopyList: ['LICENSE'],
  documentationDirectory: 'documentation',
  // Skills are emitted to .claude/skills, not copied as handbook chapters; the
  // console design/landing chapters and the roadmap are owner-specific.
  documentationExcludeList: [
    'skills',
    'console/design.md',
    'console/landing.md',
    'reference/roadmap.md',
  ],
  documentationRewriteList: [
    { from: 'apps/agent/src/', to: 'src/' },
    { from: 'apps/agent/', to: '' },
    {
      from: 'apps/firmware/apollo-firmware',
      to: 'https://github.com/galfrevn/apollo-firmware',
    },
    {
      from: ' Discovery infrastructure — prerendered bilingual landing documents, robots/sitemap/llms.txt, structured data, real 404s — is documented in [Landing](landing.md).',
      to: '',
    },
    { from: ' (see [Landing](landing.md))', to: '' },
    {
      from: 'Prev: [Testing](../operations/testing.md) · Next: [Design](design.md)',
      to: 'Prev: [Testing](../operations/testing.md)',
    },
    { from: '[Roadmap](../reference/roadmap.md) item 6.', to: 'a roadmap item.' },
  ] satisfies readonly TextRewriteRule[],
  // Any line still referencing an excluded chapter after rewrites is dropped
  // (index entries and nav links whose whole line points at excluded pages).
  documentationDroppedLineMarkerList: [
    'console/design.md',
    'console/landing.md',
    'reference/roadmap.md',
  ],
  skillsDirectory: 'documentation/skills',
  identityPlaceholderSwap: {
    relativePath: 'src/configuration/identity.ts',
    from: "export const APOLLO_TTS_VOICE = 'ByVRQtaK1WDOvTmP1PKO';",
    to: "export const APOLLO_TTS_VOICE = '';",
  },
  wranglerRemovedDurableObjectClassList: ['Sandbox'],
  forbiddenPatternList: [
    { pattern: 'galfre.vn', allowedPathPrefixList: [] },
    { pattern: 'ByVRQtaK1WDOvTmP1PKO', allowedPathPrefixList: [] },
    {
      pattern: 'agent.heyapollo.dev',
      allowedPathPrefixList: ['documentation/'],
    },
    {
      pattern: 'heyapollo',
      allowedPathPrefixList: [
        'README.md',
        'CLAUDE.md',
        'AGENTS.md',
        '.claude/',
        'documentation/',
      ],
    },
    {
      pattern: 'galfrevn',
      allowedPathPrefixList: ['README.md', 'LICENSE', '.claude/', 'documentation/'],
    },
  ] satisfies readonly ForbiddenPatternRule[],
} as const;
