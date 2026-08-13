import { z } from 'zod';

export const serverMessageSchema = z.object({ type: z.string() }).passthrough();
