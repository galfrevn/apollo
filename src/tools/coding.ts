import { z } from 'zod';

import { parseGithubRepositoryReference } from '@/github/repository';
import type { ToolDefinition } from '@/tools/types';

const startCodingTaskArgsSchema = z.object({
  repository: z.string().min(1).max(200),
  task: z.string().min(1).max(4000),
});

// One confirmation authorizes the whole task: the agent runs many commands and
// confirming each by voice is unusable. Blast radius is one disposable sandbox.
export const startCodingTaskTool: ToolDefinition = {
  name: 'start_coding_task',
  safety: 'unsafe',
  description:
    'Clona un repositorio de GitHub en un sandbox, hace los cambios pedidos y abre un pull request (requiere confirmación)',
  parameters: {
    type: 'object',
    properties: {
      repository: { type: 'string' },
      task: { type: 'string' },
    },
    required: ['repository', 'task'],
    additionalProperties: false,
  },
  buildConfirmSummary(args) {
    const parsedArgs = startCodingTaskArgsSchema.parse(args);
    return `Programar en ${parsedArgs.repository}: ${parsedArgs.task.slice(0, 120)}`;
  },
  async handler(args, context) {
    if (!context.effects) {
      return { ok: false, summary: 'Effects no disponibles' };
    }

    const parsedArgs = startCodingTaskArgsSchema.parse(args);
    let repositoryLabel: string;
    try {
      const repository = parseGithubRepositoryReference(parsedArgs.repository);
      repositoryLabel = `${repository.owner}/${repository.repository}`;
    } catch (error) {
      return {
        ok: false,
        summary: error instanceof Error ? error.message : 'Repositorio inválido',
      };
    }

    await context.effects.enqueueCodingTask({
      repository: repositoryLabel,
      task: parsedArgs.task,
    });

    return {
      ok: true,
      summary: `Arranco a programar en ${repositoryLabel}. Te aviso cuando esté el pull request.`,
    };
  },
};
