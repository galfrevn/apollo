let didWarmConsoleChunk = false;

export function warmConsoleChunk(): void {
  if (didWarmConsoleChunk) {
    return;
  }
  didWarmConsoleChunk = true;
  void import('@/app');
}

let didWarmDocsChunk = false;

export function warmDocsChunk(): void {
  if (didWarmDocsChunk) {
    return;
  }
  didWarmDocsChunk = true;
  void import('@/docs/page');
}
