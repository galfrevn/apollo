# Lists

Lists are durable, spoken-first collections: the grocery list, a packing list, anything
the user wants to add to by voice and hear back later.

## Tools

- `add_to_list` — `item` plus an optional `listName`
- `read_list` — optional `listName`; with no name it reads everything
- `remove_from_list` — `item` (fuzzy content match) or `clearAll: true`

Every list tool defaults to the list named `super` (`DEFAULT_LIST_NAME` in
`apps/agent/src/tools/list.ts`), because the grocery list is the one people actually use by voice.

## Storage

Rows live in the `list_items` SQL table on the Apollo Durable Object (created in
`onStart`, `apps/agent/src/agents/apollo.ts`): `id`, `list_name`, `content`, `created_at`. Helpers
are in `apps/agent/src/lists/store.ts`.

## Speaking a list

`formatListForSpeech` renders one list as "Lista super: café, pan, leche." and groups by
name when several lists come back at once. Read-back is a sentence, not a bulleted dump —
the device reads it literally, so markdown would be spoken out loud (see
[Voice](../runtime/voice.md)).

## Navigation

Prev: [Timers](timers.md) · Next: [Dollar rates](rates.md)
