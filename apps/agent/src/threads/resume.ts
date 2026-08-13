export const THREAD_VECTOR_MEMORY_ID_PREFIX = 'thread-';

export type ThreadResumeCandidate = {
  readonly sessionId: string;
  readonly title: string;
  readonly summary: string | null;
};

export function mapVectorMemoryIdToThreadSessionId(
  vectorMemoryId: string,
): string | undefined {
  if (!vectorMemoryId.startsWith(THREAD_VECTOR_MEMORY_ID_PREFIX)) {
    return undefined;
  }
  const sessionId = vectorMemoryId.slice(THREAD_VECTOR_MEMORY_ID_PREFIX.length);
  return sessionId.length > 0 ? sessionId : undefined;
}

// Keyword fallback for when embeddings are unavailable (mock mode, Vectorize
// hiccups): scores each candidate by how many query words its title or summary
// contains. The candidate list is expected in recency order, so ties resolve
// to the most recent thread.
export function selectThreadForResume(
  candidateList: readonly ThreadResumeCandidate[],
  query: string,
): ThreadResumeCandidate | undefined {
  const queryWordList = query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 2);
  if (queryWordList.length === 0) {
    return undefined;
  }
  let bestCandidate: ThreadResumeCandidate | undefined;
  let bestScore = 0;
  for (const candidate of candidateList) {
    const haystack = `${candidate.title} ${candidate.summary ?? ''}`.toLowerCase();
    const score = queryWordList.filter((word) => haystack.includes(word)).length;
    if (score > bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
  }
  return bestCandidate;
}
