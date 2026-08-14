import { flushSync } from 'react-dom';

type DocumentWithViewTransition = Document & {
  readonly startViewTransition?: (updateCallback: () => void) => unknown;
};

export function runNavigationWithViewTransition(applyNavigation: () => void): void {
  const documentWithViewTransition = document as DocumentWithViewTransition;
  const shouldSkipTransition =
    documentWithViewTransition.startViewTransition === undefined ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (shouldSkipTransition) {
    applyNavigation();
    return;
  }
  documentWithViewTransition.startViewTransition(() => {
    flushSync(applyNavigation);
  });
}
