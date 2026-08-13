let didWarmConsoleChunk = false;

export function warmConsoleChunk(): void {
  if (didWarmConsoleChunk) {
    return;
  }
  didWarmConsoleChunk = true;
  void import('@/app');
}
