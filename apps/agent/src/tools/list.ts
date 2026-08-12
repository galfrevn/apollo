import { z } from 'zod';

import type { ListItemRecord } from '@/lists/store';
import type { ToolDefinition } from '@/tools/types';

const DEFAULT_LIST_NAME = 'super';

const addToListArgsSchema = z.object({
  item: z.string().min(1).max(300),
  listName: z.string().min(1).max(100).optional(),
});

const readListArgsSchema = z.object({
  listName: z.string().min(1).max(100).optional(),
});

const removeFromListArgsSchema = z
  .object({
    item: z.string().min(1).max(300).optional(),
    listName: z.string().min(1).max(100).optional(),
    clearAll: z.boolean().optional(),
  })
  .superRefine((value, context) => {
    if (
      value.clearAll !== true &&
      (value.item === undefined || value.item.trim() === '')
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'item or clearAll required',
      });
    }
  });

function formatListForSpeech(itemList: readonly ListItemRecord[]): string {
  const listNameSet = [...new Set(itemList.map((item) => item.listName))];
  if (listNameSet.length === 1) {
    const contentList = itemList.map((item) => item.content);
    return `Lista ${listNameSet[0]}: ${contentList.join(', ')}.`;
  }
  return listNameSet
    .map((listName) => {
      const contentList = itemList
        .filter((item) => item.listName === listName)
        .map((item) => item.content);
      return `Lista ${listName}: ${contentList.join(', ')}.`;
    })
    .join(' ');
}

export const addToListTool: ToolDefinition = {
  name: 'add_to_list',
  safety: 'safe',
  description:
    'Agrega un ítem a una lista (por defecto "super"); usá listName para otras listas',
  parameters: {
    type: 'object',
    properties: {
      item: { type: 'string' },
      listName: { type: 'string' },
    },
    required: ['item'],
    additionalProperties: false,
  },
  async handler(args, context) {
    if (!context.effects) {
      return { ok: false, summary: 'Effects no disponibles' };
    }
    const parsedArgs = addToListArgsSchema.parse(args);
    const listName = parsedArgs.listName ?? DEFAULT_LIST_NAME;
    await context.effects.addListItem({ listName, content: parsedArgs.item });
    return {
      ok: true,
      summary: `Anotado en la lista ${listName}: ${parsedArgs.item}`,
    };
  },
};

export const readListTool: ToolDefinition = {
  name: 'read_list',
  safety: 'safe',
  description: 'Lee una lista por nombre, o todas las listas si no se indica',
  parameters: {
    type: 'object',
    properties: { listName: { type: 'string' } },
    additionalProperties: false,
  },
  async handler(args, context) {
    if (!context.effects) {
      return { ok: false, summary: 'Effects no disponibles' };
    }
    const parsedArgs = readListArgsSchema.parse(args);
    const itemList = await context.effects.listListItems(parsedArgs.listName);
    if (itemList.length === 0) {
      return {
        ok: true,
        summary:
          parsedArgs.listName === undefined
            ? 'No hay listas con ítems.'
            : `La lista ${parsedArgs.listName} está vacía.`,
      };
    }
    return {
      ok: true,
      summary: formatListForSpeech(itemList),
      data: itemList,
    };
  },
};

export const removeFromListTool: ToolDefinition = {
  name: 'remove_from_list',
  safety: 'safe',
  description: 'Saca un ítem de una lista (match parcial) o la vacía entera con clearAll',
  parameters: {
    type: 'object',
    properties: {
      item: { type: 'string' },
      listName: { type: 'string' },
      clearAll: { type: 'boolean' },
    },
    additionalProperties: false,
  },
  async handler(args, context) {
    if (!context.effects) {
      return { ok: false, summary: 'Effects no disponibles' };
    }
    const parsedArgsResult = removeFromListArgsSchema.safeParse(args);
    if (!parsedArgsResult.success) {
      return { ok: false, summary: 'Indicá un ítem o clearAll' };
    }
    const parsedArgs = parsedArgsResult.data;
    const listName = parsedArgs.listName ?? DEFAULT_LIST_NAME;
    const removal = await context.effects.removeListItems({
      listName,
      ...(parsedArgs.item !== undefined ? { contentQuery: parsedArgs.item } : {}),
      clearAll: parsedArgs.clearAll === true,
    });
    if (removal.removedCount === 0) {
      return {
        ok: false,
        summary: `No encontré eso en la lista ${listName}.`,
      };
    }
    return {
      ok: true,
      summary:
        parsedArgs.clearAll === true
          ? `Lista ${listName} vaciada (${removal.removedCount} ítems).`
          : `Saqué de la lista ${listName}: ${removal.removedContentList.join(', ')}.`,
      data: removal,
    };
  },
};
