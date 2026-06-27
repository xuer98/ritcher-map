'use client';

import type { CatalogMarker } from '../api/maps';
import { MarkerBody } from '../markdown/MarkerBody';
import type { CategoryResponse } from '../types';
import { CategoryIcon } from './CategoryIcon';

export interface MarkerDetailProps {
  marker: CatalogMarker;
  /** The marker's category, for the header label + icon (may be absent). */
  category: CategoryResponse | undefined;
  authed: boolean;
  found: boolean;
  onToggleFound: () => void;
  onClose: () => void;
  /** Follow a `#marker-<id>` link inside the description. */
  onMarkerLink: (id: number) => void;
  /** Resolve a linked marker's id to its title, or null if not loaded. */
  resolveMarkerLabel: (id: number) => string | null;
}

/** The right-hand detail card for the selected marker. */
export const MarkerDetail: React.FC<MarkerDetailProps> = ({
  marker,
  category,
  authed,
  found,
  onToggleFound,
  onClose,
  onMarkerLink,
  resolveMarkerLabel,
}) => (
  <div className="absolute inset-y-4 right-4 z-20 flex max-h-[calc(100dvh-32px)] w-80 max-w-[calc(100vw-32px)] flex-col gap-2.5 overflow-y-auto rounded-card border border-edge bg-panel p-4 shadow-panel backdrop-blur-md">
    <button
      type="button"
      className="absolute right-3 top-2.5 cursor-pointer border-0 bg-transparent text-[22px] leading-none text-fg-dim hover:text-fg"
      aria-label="Close"
      onClick={onClose}
    >
      ×
    </button>
    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-fg-dim">
      <CategoryIcon
        icon={category?.icon ?? null}
        categoryId={marker.categoryId}
        size={16}
      />
      {category?.name ?? 'Marker'}
    </div>
    <h2 className="m-0 pr-6 text-lg font-bold">
      {marker.title ?? `Marker #${marker.id}`}
    </h2>
    {marker.description && (
      <MarkerBody
        markdown={marker.description}
        onMarkerLink={onMarkerLink}
        resolveMarkerLabel={resolveMarkerLabel}
      />
    )}
    {authed ? (
      <label className="flex cursor-pointer items-center gap-2 border-t border-edge pt-2.5 font-semibold">
        <input type="checkbox" checked={found} onChange={onToggleFound} />
        <span>Found</span>
      </label>
    ) : (
      <div className="text-sm text-fg-dim">Log in to track progress.</div>
    )}
  </div>
);
