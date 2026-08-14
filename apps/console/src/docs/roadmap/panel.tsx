import { DOCS_MESSAGES } from '@/docs/copy';
import {
  ROADMAP_COMPLETION_PERCENT,
  ROADMAP_STATUS_LABEL_MAP,
  ROADMAP_TRACK_LIST,
} from '@/docs/roadmap/catalog';

import type { RoadmapBrand, RoadmapTrack } from '@/docs/roadmap/catalog';

const PROGRESS_SEGMENT_COUNT = 40;

function ProgressMeter() {
  const filledSegmentCount = Math.round(
    (ROADMAP_COMPLETION_PERCENT / 100) * PROGRESS_SEGMENT_COUNT,
  );
  return (
    <div className="border bg-card p-7">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div>
          <div className="text-xs text-dim">{DOCS_MESSAGES.roadmapProgressLabel}</div>
          <div className="mt-1 font-serif text-[clamp(44px,9vw,76px)] leading-none tracking-[-0.02em]">
            {ROADMAP_COMPLETION_PERCENT}
            <span className="text-muted-foreground">%</span>
          </div>
        </div>
        <p className="max-w-[42ch] text-sm text-muted-foreground">
          {DOCS_MESSAGES.roadmapProgressCaption}
        </p>
      </div>
      <div
        className="mt-6 flex gap-[3px]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={ROADMAP_COMPLETION_PERCENT}
        aria-label={DOCS_MESSAGES.roadmapProgressLabel}
      >
        {Array.from({ length: PROGRESS_SEGMENT_COUNT }, (_, segmentIndex) => (
          <span
            key={segmentIndex}
            className={`h-7 flex-1 ${
              segmentIndex < filledSegmentCount ? 'bg-foreground' : 'bg-border'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function BrandChip({ brand }: { readonly brand: RoadmapBrand }) {
  return (
    <span
      className={`flex items-center gap-2 border px-2.5 py-1.5 text-xs ${
        brand.isShipped ? 'border-border-hover text-foreground' : 'text-muted-foreground'
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        className={`size-3.5 shrink-0 ${brand.isShipped ? '' : 'opacity-45'}`}
        fill="currentColor"
        aria-hidden
      >
        <path d={brand.iconPath} />
      </svg>
      {brand.name}
    </span>
  );
}

function TrackSection({ track }: { readonly track: RoadmapTrack }) {
  return (
    <section className="border-t pt-8">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <span className="font-mono text-xs text-dim">{track.indexLabel}</span>
        <h2 className="font-serif text-[26px] leading-[1.25] tracking-[-0.01em]">
          {track.title}
        </h2>
        <span className="ml-auto border px-2 py-0.5 text-xs text-muted-foreground">
          {ROADMAP_STATUS_LABEL_MAP[track.status]}
        </span>
      </div>
      <p className="mt-3.5 max-w-[68ch] text-[15.5px] leading-[1.78] text-foreground/80">
        {track.summary}
      </p>
      {track.brandList.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {track.brandList.map((brand) => (
            <BrandChip key={brand.name} brand={brand} />
          ))}
        </div>
      )}
      <ul className="mt-5 space-y-2">
        {track.itemList.map((item) => (
          <li key={item} className="flex gap-3 text-[15.5px] leading-[1.7]">
            <span aria-hidden className="mt-[0.62em] size-1 shrink-0 bg-dim" />
            <span className="text-foreground/80">{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function DocsRoadmapPanel() {
  return (
    <div className="space-y-10">
      <ProgressMeter />
      <p className="max-w-[68ch] text-[15.5px] leading-[1.78] text-foreground/80">
        {DOCS_MESSAGES.roadmapIntro}
      </p>
      <div className="space-y-10">
        {ROADMAP_TRACK_LIST.map((track) => (
          <TrackSection key={track.indexLabel} track={track} />
        ))}
      </div>
      <p className="border-t pt-8 text-sm text-muted-foreground">
        {DOCS_MESSAGES.roadmapClosing}
      </p>
    </div>
  );
}
