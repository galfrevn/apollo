export type DeskSpeechModeId = 'default' | 'nerd' | 'gracioso' | 'warm';

export type DeskSpeechMode = {
  readonly id: DeskSpeechModeId;
  readonly name: string;
  readonly promptOverride: string;
  readonly accentColor: string;
};

const deskSpeechModeCatalog: readonly DeskSpeechMode[] = [
  {
    id: 'default',
    name: 'default',
    promptOverride:
      'Modo default: claro y útil; 1–3 oraciones habladas; sin payasadas ni jerga técnica de más.',
    accentColor: '#3D8B7A',
  },
  {
    id: 'nerd',
    name: 'nerd',
    promptOverride:
      'Modo nerd: preciso y técnico; asumí contexto de código/sistemas; podés alargar un poco si hace falta exactitud; jargon OK.',
    accentColor: '#4B6CB7',
  },
  {
    id: 'gracioso',
    name: 'gracioso',
    promptOverride:
      'Modo gracioso: muy argentino, joda liviana, jerga natural (boludo, etc.) solo cuando cae bien. Picá un toque; nunca humilles ni toques temas sensibles; no fuerces slang en cada frase.',
    accentColor: '#C45C26',
  },
  {
    id: 'warm',
    name: 'warm',
    promptOverride:
      'Modo warm: cálido y cercano; podés chequear cómo está el usuario; seguí siendo útil, no hagas de terapeuta.',
    accentColor: '#B56B7A',
  },
];

export function migrateLegacySpeechModeId(rawSpeechModeId: string): DeskSpeechModeId {
  if (rawSpeechModeId === 'seco') {
    return 'default';
  }
  const matchedSpeechMode = deskSpeechModeCatalog.find(
    (speechMode) => speechMode.id === rawSpeechModeId,
  );
  return matchedSpeechMode?.id ?? 'default';
}

export function resolveDeskSpeechMode(speechModeId: string): DeskSpeechMode {
  const migratedSpeechModeId = migrateLegacySpeechModeId(speechModeId);
  return (
    deskSpeechModeCatalog.find((speechMode) => speechMode.id === migratedSpeechModeId) ??
    deskSpeechModeCatalog[0]
  );
}

export function cycleDeskSpeechMode(
  currentSpeechModeId: string,
  direction: 1 | -1,
): DeskSpeechMode {
  const resolvedSpeechMode = resolveDeskSpeechMode(currentSpeechModeId);
  const currentIndex = deskSpeechModeCatalog.findIndex(
    (speechMode) => speechMode.id === resolvedSpeechMode.id,
  );
  const nextIndex =
    (currentIndex + direction + deskSpeechModeCatalog.length) %
    deskSpeechModeCatalog.length;
  return deskSpeechModeCatalog[nextIndex];
}
