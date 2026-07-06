'use client';

import { useMemo, useState } from 'react';
import type { CatalogMarker } from '../api/maps';
import { MarkerBody } from '../markdown/MarkerBody';
import type { CategoryResponse } from '../types';
import {
  CheckCircleIcon,
  CloseIcon,
  CompassIcon,
  ExpandIcon,
  ShareIcon,
} from '../ui/icons';
import { CategoryIcon } from './CategoryIcon';

export interface MarkerDetailProps {
  marker: CatalogMarker;
  /** The marker's category, for the header label + icon (may be absent). */
  category: CategoryResponse | undefined;
  found: boolean;
  onToggleFound: () => void;
  onClose: () => void;
  /** Fly the map camera to this marker ("Explore"). */
  onExplore: () => void;
  /** Follow a `#marker-<id>` link inside the description. */
  onMarkerLink: (id: number) => void;
  /** Resolve a linked marker's id to its title, or null if not loaded. */
  resolveMarkerLabel: (id: number) => string | null;
  /** Follow a `#category-<id>` link (reveal the category on the map). */
  onCategoryLink: (id: number) => void;
  /** Resolve a linked category's id to its name, or null if unknown. */
  resolveCategoryLabel: (id: number) => string | null;
  /** Follow a `#region-<id>` link (fit the camera to the region). */
  onRegionLink: (id: number) => void;
  /** Resolve a linked region's id to its name, or null if unknown. */
  resolveRegionLabel: (id: number) => string | null;
}

/** First Markdown image in the description: `![alt](url)` (optional title). */
const IMG_RE = /!\[[^\]]*\]\((\S+?)(?:\s+"[^"]*")?\)/;

/** Pull the first image out of the markdown to use as the card's hero;
 *  the body renders the rest (any further images stay inline). */
function splitHero(md: string | null): { hero: string | null; body: string | null } {
  if (!md) return { hero: null, body: null };
  const m = IMG_RE.exec(md);
  if (!m) return { hero: null, body: md };
  const body = (md.slice(0, m.index) + md.slice(m.index + m[0].length)).trim();
  return { hero: m[1], body: body === '' ? null : body };
}

const CIRCLE_BTN =
  'flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#1a1c1f] shadow-panel hover:bg-white/90';

/** The detail card for the selected marker: hero image (first description
 *  image), floating share / full-screen / close controls, category badge,
 *  and Found + Explore actions. Mobile: bottom sheet; sm+: floating card. */
export const MarkerDetail: React.FC<MarkerDetailProps> = ({
  marker,
  category,
  found,
  onToggleFound,
  onClose,
  onExplore,
  onMarkerLink,
  resolveMarkerLabel,
  onCategoryLink,
  resolveCategoryLabel,
  onRegionLink,
  resolveRegionLabel,
}) => {
  const { hero, body } = useMemo(
    () => splitHero(marker.description),
    [marker.description],
  );
  const [lightbox, setLightbox] = useState(false);
  const [shared, setShared] = useState(false);

  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}?m=${marker.id}`;
    const title = marker.title ?? `Marker #${marker.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShared(true);
      window.setTimeout(() => setShared(false), 1600);
    } catch {
      /* user dismissed the share sheet / clipboard unavailable */
    }
  };

  const controls = (
    <div className="absolute right-3 top-3 flex gap-2">
      <button
        type="button"
        className={CIRCLE_BTN}
        aria-label="Share marker"
        title={shared ? 'Link copied!' : 'Share'}
        onClick={share}
      >
        {shared ? <CheckCircleIcon size={19} /> : <ShareIcon size={19} />}
      </button>
      {hero && (
        <button
          type="button"
          className={CIRCLE_BTN}
          aria-label="View image full screen"
          title="Full screen"
          onClick={() => setLightbox(true)}
        >
          <ExpandIcon size={18} />
        </button>
      )}
      <button
        type="button"
        className={CIRCLE_BTN}
        aria-label="Close"
        onClick={onClose}
      >
        <CloseIcon size={18} />
      </button>
    </div>
  );

  return (
    <>
      {/* Mobile: a bottom sheet capped well under the viewport (the map stays
          visible/tappable above it). sm+: a floating card anchored bottom-right. */}
      <div className="absolute inset-x-0 bottom-0 z-20 flex max-h-[65dvh] flex-col overflow-hidden rounded-t-card border border-edge bg-panel shadow-panel backdrop-blur-md sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-96 sm:max-w-[calc(100vw-32px)] sm:rounded-card sm:max-h-[min(680px,calc(100dvh-32px))]">
        {hero ? (
          // Compressible: full height when there's room, squeezes (never below
          // 96px) on short viewports so the action buttons stay visible.
          <div className="relative min-h-24 shrink-[2] basis-44">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={hero}
              alt={marker.title ?? ''}
              className="absolute inset-0 h-full w-full object-cover"
            />
            {controls}
            {/* Category icon, overlapping the hero's bottom edge. */}
            <span className="absolute -bottom-7 left-4 flex h-14 w-14 items-center justify-center drop-shadow-[0_3px_6px_rgba(0,0,0,0.6)]">
              <CategoryIcon
                icon={category?.icon ?? null}
                categoryId={marker.categoryId}
                size={52}
                alt={category?.name ?? ''}
              />
            </span>
          </div>
        ) : (
          <div className="relative h-14 flex-none">
            {controls}
            <span className="absolute left-4 top-3 flex h-14 w-14 items-center justify-center drop-shadow-[0_3px_6px_rgba(0,0,0,0.6)]">
              <CategoryIcon
                icon={category?.icon ?? null}
                categoryId={marker.categoryId}
                size={52}
                alt={category?.name ?? ''}
              />
            </span>
          </div>
        )}

        <div
          className={`flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-5 pb-3 ${
            hero ? 'pt-9' : 'pt-5'
          }`}
        >
          <h2 className="m-0 text-2xl font-bold leading-tight">
            {marker.title ?? `Marker #${marker.id}`}
          </h2>
          <div className="h-px flex-none bg-edge" />
          {body ? (
            <MarkerBody
              markdown={body}
              onMarkerLink={onMarkerLink}
              resolveMarkerLabel={resolveMarkerLabel}
              onCategoryLink={onCategoryLink}
              resolveCategoryLabel={resolveCategoryLabel}
              onRegionLink={onRegionLink}
              resolveRegionLabel={resolveRegionLabel}
            />
          ) : (
            !hero && (
              <p className="m-0 text-sm text-fg-dim">
                {category?.name ?? 'Marker'}
              </p>
            )
          )}
        </div>

        <div className="flex flex-none flex-col gap-2.5 px-5 pb-5 pt-2">
          <button
            type="button"
            onClick={onToggleFound}
            aria-pressed={found}
            className={`flex w-full items-center justify-center gap-2.5 rounded-full py-3.5 text-[17px] font-semibold transition-colors ${
              found
                ? 'bg-lime text-black'
                : 'bg-white/[0.08] text-fg hover:bg-white/[0.14]'
            }`}
          >
            <CheckCircleIcon size={21} />
            Found
          </button>
          <button
            type="button"
            onClick={onExplore}
            className="flex w-full items-center justify-center gap-2.5 rounded-full bg-white py-3.5 text-[17px] font-semibold text-[#1a1c1f] hover:bg-white/90"
          >
            <CompassIcon size={21} />
            Explore
          </button>
        </div>
      </div>

      {/* Full-screen image lightbox. */}
      {lightbox && hero && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-[2px]"
          onClick={() => setLightbox(false)}
        >
          <button
            type="button"
            className={`${CIRCLE_BTN} absolute right-4 top-4`}
            aria-label="Close full screen"
            onClick={() => setLightbox(false)}
          >
            <CloseIcon size={18} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={hero}
            alt={marker.title ?? ''}
            className="max-h-[92dvh] max-w-[94vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};
