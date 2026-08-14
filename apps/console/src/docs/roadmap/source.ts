import { DOCS_MESSAGES } from '@/docs/copy';
import { ROADMAP_STATUS_LABEL_MAP, ROADMAP_TRACK_LIST } from '@/docs/roadmap/catalog';

// The chapter renders as a component rather than markdown, but the handbook
// search indexes plain text, so the same catalog is flattened into a source.
export const ROADMAP_MARKDOWN_SOURCE = [
  DOCS_MESSAGES.roadmapIntro,
  ...ROADMAP_TRACK_LIST.map((track) =>
    [
      `## ${track.title}`,
      `${ROADMAP_STATUS_LABEL_MAP[track.status]}. ${track.summary}`,
      ...track.brandList.map((brand) => `- ${brand.name}`),
      ...track.itemList.map((item) => `- ${item}`),
    ].join('\n\n'),
  ),
  DOCS_MESSAGES.roadmapClosing,
].join('\n\n');
