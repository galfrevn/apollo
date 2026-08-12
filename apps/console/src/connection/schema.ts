import { z } from 'zod';

export const consoleConnectionSchema = z.object({
  workerUrl: z
    .string()
    .url()
    .refine(
      (candidateUrl) =>
        candidateUrl.startsWith('https://') || candidateUrl.startsWith('http://'),
      { message: 'Worker URL must be http(s)' },
    )
    .transform((workerUrl) => workerUrl.replace(/\/+$/, '')),
  deviceName: z.string().min(1).max(64),
  secret: z.string().min(1),
});

export type ConsoleConnection = z.infer<typeof consoleConnectionSchema>;
