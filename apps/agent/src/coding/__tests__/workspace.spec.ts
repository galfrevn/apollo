import { describe, expect, it } from 'bun:test';

import { resolveWorkspaceFilePath } from '@/coding/workspace';

const workspacePath = '/workspace/repo';

describe('resolveWorkspaceFilePath', () => {
  it('resolves relative and absolute paths inside the repository', () => {
    expect(
      resolveWorkspaceFilePath({ workspacePath, requestedPath: 'src/index.ts' }),
    ).toBe('/workspace/repo/src/index.ts');
    expect(
      resolveWorkspaceFilePath({ workspacePath, requestedPath: './src/../src/app.ts' }),
    ).toBe('/workspace/repo/src/app.ts');
    expect(
      resolveWorkspaceFilePath({
        workspacePath,
        requestedPath: '/workspace/repo/README.md',
      }),
    ).toBe('/workspace/repo/README.md');
    expect(resolveWorkspaceFilePath({ workspacePath, requestedPath: '.' })).toBe(
      workspacePath,
    );
  });

  it('refuses to escape the repository', () => {
    for (const requestedPath of [
      '../secrets.txt',
      '../../etc/passwd',
      'src/../../outside.ts',
      '/etc/passwd',
      '/workspace/other/file.ts',
    ]) {
      expect(() => resolveWorkspaceFilePath({ workspacePath, requestedPath })).toThrow(
        /fuera del repositorio/,
      );
    }
  });

  it('refuses to touch git internals', () => {
    for (const requestedPath of [
      '.git/config',
      'src/../.git/HEAD',
      '/workspace/repo/.git/hooks/pre-commit',
    ]) {
      expect(() => resolveWorkspaceFilePath({ workspacePath, requestedPath })).toThrow(
        /\.git/,
      );
    }
  });

  it('rejects an empty path', () => {
    expect(() =>
      resolveWorkspaceFilePath({ workspacePath, requestedPath: '  ' }),
    ).toThrow();
  });
});
