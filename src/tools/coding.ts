import { z } from 'zod';

import { listGithubAppRepositoryFullNameList } from '@/github/app';
import {
  formatGithubRepositoryReference,
  parseGithubRepositoryReference,
  resolveSpokenRepositoryReference,
} from '@/github/repository';
import type { ToolDefinition, ToolExecutionContext } from '@/tools/types';

const startCodingTaskArgsSchema = z.object({
  repository: z.string().min(1).max(200),
  task: z.string().min(1).max(4000),
});

async function listInstalledRepositoryFullNameList(
  context: ToolExecutionContext,
): Promise<readonly string[]> {
  return listGithubAppRepositoryFullNameList({
    appId: context.environment.GITHUB_APP_ID,
    privateKeyPem: context.environment.GITHUB_APP_PRIVATE_KEY,
    nowMilliseconds: context.nowMilliseconds,
  });
}

export const listCodingRepositoriesTool: ToolDefinition = {
  name: 'list_coding_repositories',
  safety: 'safe',
  description:
    'Lista los repositorios de GitHub donde Apollo puede programar (los que tienen el App instalado)',
  parameters: {
    type: 'object',
    properties: {},
    additionalProperties: false,
  },
  async handler(_args, context) {
    let fullNameList: readonly string[];
    try {
      fullNameList = await listInstalledRepositoryFullNameList(context);
    } catch (error) {
      return {
        ok: false,
        summary:
          error instanceof Error
            ? error.message
            : 'No pude listar los repositorios disponibles',
      };
    }
    if (fullNameList.length === 0) {
      return {
        ok: true,
        summary: 'El GitHub App todavía no está instalado en ningún repositorio',
      };
    }
    return {
      ok: true,
      summary: `Puedo programar en: ${fullNameList.join(', ')}`,
      data: { repositoryList: fullNameList },
    };
  },
};

// One confirmation authorizes the whole task: the agent runs many commands and
// confirming each by voice is unusable. Blast radius is one disposable sandbox.
export const startCodingTaskTool: ToolDefinition = {
  name: 'start_coding_task',
  safety: 'unsafe',
  description:
    'Clona un repositorio de GitHub en un sandbox, hace los cambios pedidos y abre un pull request (requiere confirmación). ' +
    'Alcanza con el nombre del repo tal como lo dice el usuario (ej: "apollo"): se resuelve contra los repos instalados. ' +
    'Nunca le pidas al usuario una URL ni el formato owner/repo; ante la duda usá list_coding_repositories.',
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
    let repositoryLabel: string | undefined;
    try {
      repositoryLabel = formatGithubRepositoryReference(
        parseGithubRepositoryReference(parsedArgs.repository),
      );
    } catch {
      // Not an owner/repo or URL: a spoken name, resolved against the
      // installation list below.
    }

    if (repositoryLabel === undefined) {
      let installedFullNameList: readonly string[];
      try {
        installedFullNameList = await listInstalledRepositoryFullNameList(context);
      } catch (error) {
        return {
          ok: false,
          summary:
            error instanceof Error
              ? error.message
              : 'No pude listar los repositorios disponibles',
        };
      }
      const resolution = resolveSpokenRepositoryReference(
        parsedArgs.repository,
        installedFullNameList,
      );
      if (resolution.kind === 'ambiguous') {
        return {
          ok: false,
          summary: `Hay varios repos que suenan a "${parsedArgs.repository}": ${resolution.candidateFullNameList.join(', ')}. ¿Cuál de esos?`,
        };
      }
      if (resolution.kind === 'none') {
        return {
          ok: false,
          summary:
            installedFullNameList.length === 0
              ? 'El GitHub App todavía no está instalado en ningún repositorio'
              : `No encontré un repo que suene a "${parsedArgs.repository}". Puedo programar en: ${installedFullNameList.join(', ')}`,
        };
      }
      repositoryLabel = resolution.fullName;
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
