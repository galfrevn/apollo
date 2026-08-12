import { z } from 'zod';

const workerHealthSchema = z.object({
  ok: z.literal(true),
  name: z.literal('apollo'),
});

export type WorkerProbeResult =
  | { readonly outcome: 'ok' }
  | { readonly outcome: 'unreachable' }
  | { readonly outcome: 'not-apollo' };

type FetchLike = (input: string) => Promise<Response>;

export async function probeWorkerHealth(
  workerUrl: string,
  fetchImplementation: FetchLike = fetch,
): Promise<WorkerProbeResult> {
  let response: Response;
  try {
    response = await fetchImplementation(`${workerUrl}/health`);
  } catch {
    return { outcome: 'unreachable' };
  }
  if (!response.ok) {
    return { outcome: 'not-apollo' };
  }
  try {
    const parsedBody = workerHealthSchema.safeParse(await response.json());
    return parsedBody.success ? { outcome: 'ok' } : { outcome: 'not-apollo' };
  } catch {
    return { outcome: 'not-apollo' };
  }
}
