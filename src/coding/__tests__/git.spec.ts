import { describe, expect, it } from 'bun:test';

import {
  buildBranchSlug,
  buildCloneCommand,
  buildCodingBranchName,
  buildConfigureIdentityCommand,
  buildCreateBranchCommand,
  buildPushBranchCommand,
  buildStageAndCommitCommand,
  CODING_TOKEN_ENVIRONMENT_NAME,
  hasStagedOrUnstagedChanges,
  quoteShellArgument,
} from '@/coding/git';
import { parseGithubRepositoryReference } from '@/github/repository';

const apolloRepository = parseGithubRepositoryReference('galfrevn/apollo');

describe('quoteShellArgument', () => {
  it('neutralizes quotes and shell metacharacters', () => {
    expect(quoteShellArgument('simple')).toBe("'simple'");
    expect(quoteShellArgument("it's")).toBe("'it'\\''s'");
    expect(quoteShellArgument('a; rm -rf /')).toBe("'a; rm -rf /'");
    expect(quoteShellArgument('$(whoami)')).toBe("'$(whoami)'");
  });
});

describe('buildBranchSlug', () => {
  it('strips Rioplatense accents and punctuation', () => {
    expect(buildBranchSlug('Arreglá el título del botón')).toBe(
      'arregla-el-titulo-del-boton',
    );
  });

  it('never produces a leading, trailing or empty slug', () => {
    expect(buildBranchSlug('  ¿¡...!?  ')).toBe('tarea');
    expect(buildBranchSlug('---hola---')).toBe('hola');
    expect(buildBranchSlug('a'.repeat(80)).length).toBeLessThanOrEqual(40);
    expect(buildBranchSlug('a'.repeat(80)).endsWith('-')).toBe(false);
  });
});

describe('buildCodingBranchName', () => {
  it('namespaces the branch under apollo/ with a unique suffix', () => {
    expect(buildCodingBranchName('arreglar typo', () => 'a1b2c3d4')).toBe(
      'apollo/arreglar-typo-a1b2c3d4',
    );
  });
});

describe('git command builders', () => {
  it('clones the base branch shallowly without putting the token in the command', () => {
    const command = buildCloneCommand({
      repository: apolloRepository,
      baseBranch: 'main',
    });

    expect(command).toContain('--depth 1');
    expect(command).toContain("--branch 'main'");
    expect(command).toContain("'https://github.com/galfrevn/apollo.git'");
    // The credential helper reads the token from the environment at run time,
    // so no secret is ever present in argv.
    expect(command).toContain(`$${CODING_TOKEN_ENVIRONMENT_NAME}`);
    expect(command).toContain('x-access-token');
    expect(command).not.toContain('ghs_');
  });

  it('configures the bot identity for the commit', () => {
    const command = buildConfigureIdentityCommand({
      name: 'apollo[bot]',
      email: '1+apollo[bot]@users.noreply.github.com',
    });
    expect(command).toContain("git config user.name 'apollo[bot]'");
    expect(command).toContain(
      "git config user.email '1+apollo[bot]@users.noreply.github.com'",
    );
  });

  it('quotes a branch name and a commit message that contain quotes', () => {
    expect(buildCreateBranchCommand("apollo/it's-fine")).toBe(
      "git checkout -b 'apollo/it'\\''s-fine'",
    );
    expect(buildStageAndCommitCommand("arreglar el bug de 'foo'")).toContain(
      "git commit -m 'arreglar el bug de '\\''foo'\\'''",
    );
  });

  it('pushes only the named branch and refuses an empty one', () => {
    const command = buildPushBranchCommand('apollo/x-1');
    expect(command).toContain("push origin 'apollo/x-1'");
    expect(command).not.toContain('--force');
    expect(() => buildPushBranchCommand('   ')).toThrow();
  });
});

describe('hasStagedOrUnstagedChanges', () => {
  it('distinguishes a dirty tree from a clean one', () => {
    expect(hasStagedOrUnstagedChanges(' M src/index.ts\n')).toBe(true);
    expect(hasStagedOrUnstagedChanges('')).toBe(false);
    expect(hasStagedOrUnstagedChanges('   \n  ')).toBe(false);
  });
});
