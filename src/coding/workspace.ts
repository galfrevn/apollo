// Paths come from the model, so they are untrusted: writing into .git would let
// a "code change" rewrite history or repoint the remote.
export function resolveWorkspaceFilePath(input: {
  readonly workspacePath: string;
  readonly requestedPath: string;
}): string {
  const requestedPath = input.requestedPath.trim();
  if (requestedPath.length === 0) {
    throw new Error('Falta la ruta del archivo');
  }

  const workspacePath = input.workspacePath.replace(/\/+$/, '');
  const combinedPath = requestedPath.startsWith('/')
    ? requestedPath
    : `${workspacePath}/${requestedPath}`;

  const resolvedSegmentList: string[] = [];
  for (const segment of combinedPath.split('/')) {
    if (segment === '' || segment === '.') {
      continue;
    }
    if (segment === '..') {
      resolvedSegmentList.pop();
      continue;
    }
    resolvedSegmentList.push(segment);
  }
  const resolvedPath = `/${resolvedSegmentList.join('/')}`;

  if (resolvedPath !== workspacePath && !resolvedPath.startsWith(`${workspacePath}/`)) {
    throw new Error(`La ruta "${input.requestedPath}" queda fuera del repositorio`);
  }
  if (resolvedSegmentList.includes('.git')) {
    throw new Error('No se puede tocar el directorio .git');
  }

  return resolvedPath;
}
