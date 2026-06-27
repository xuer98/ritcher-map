'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { GameSummary } from '@/lib/games';
import { resolveAssetUrl } from '@/lib/icons';

type SortKey = 'popular' | 'az' | 'recent';

/** Most recent map `updatedAt` in the game, as epoch ms (0 if none parse). */
function latestUpdated(g: GameSummary): number {
  let max = 0;
  for (const m of g.maps) {
    const t = Date.parse(m.updatedAt);
    if (!Number.isNaN(t) && t > max) max = t;
  }
  return max;
}

const SORTS: {
  key: SortKey;
  label: string;
  icon: ReactNode;
  compare: (a: GameSummary, b: GameSummary) => number;
}[] = [
  {
    key: 'popular',
    label: 'Popular',
    // No popularity metric in the catalog yet — map count is the best proxy.
    compare: (a, b) => b.maps.length - a.maps.length || a.title.localeCompare(b.title),
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
        <path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.9l-5.81 3.05 1.11-6.47-4.7-4.58 6.5-.95z" />
      </svg>
    ),
  },
  {
    key: 'az',
    label: 'A-Z',
    compare: (a, b) => a.title.localeCompare(b.title),
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-3.5 w-3.5"
        aria-hidden="true"
      >
        <path d="M7 4v16M7 4 4 7M7 4l3 3M17 20V4M17 20l-3-3M17 20l3-3" />
      </svg>
    ),
  },
  {
    key: 'recent',
    label: 'Recently Updated',
    compare: (a, b) => latestUpdated(b) - latestUpdated(a) || a.title.localeCompare(b.title),
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-3.5 w-3.5"
        aria-hidden="true"
      >
        <path d="M21 12a9 9 0 1 1-2.64-6.36M21 4v5h-5" />
      </svg>
    ),
  },
];

function GameCard({ g }: { g: GameSummary }) {
  const thumb = resolveAssetUrl(g.branding?.thumbnailUrl ?? null);
  const logo = resolveAssetUrl(g.branding?.logoUrl ?? null);
  const style = g.branding?.accentColor
    ? ({ '--color-brand': g.branding.accentColor } as CSSProperties)
    : undefined;
  return (
    <Link
      href={`/${g.slug}`}
      style={style}
      className="group relative flex aspect-[3/4] flex-col justify-end overflow-hidden rounded-card border border-edge bg-panel shadow-panel transition-transform hover:-translate-y-0.5 hover:border-brand"
    >
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumb}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <span
          aria-hidden="true"
          className="absolute inset-0 grid place-items-center bg-gradient-to-br from-brand/30 to-black/50 text-6xl font-bold text-white/70"
        >
          {g.title.charAt(0)}
        </span>
      )}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent"
      />
      <span className="relative z-10 flex flex-col gap-1 p-3">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt={g.title}
            className="max-h-12 w-auto max-w-full self-start object-contain object-left drop-shadow-lg"
          />
        ) : (
          <span className="text-base font-bold leading-tight text-white">
            {g.title}
          </span>
        )}
        <span className="text-xs text-white/70">
          {g.maps.length} map{g.maps.length === 1 ? '' : 's'}
        </span>
      </span>
    </Link>
  );
}

/**
 * Client-side search + sort over the grouped game list. The server page fetches
 * and groups the catalog; this component owns the interactive controls (a search
 * box matching by game title or any of its map names, and the Popular / A-Z /
 * Recently Updated sort pills) and renders the card grid.
 */
export function MapBrowser({ games }: { games: GameSummary[] }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('popular');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered =
      q === ''
        ? games
        : games.filter(
            (g) =>
              g.title.toLowerCase().includes(q) ||
              g.maps.some((m) => m.name.toLowerCase().includes(q)),
          );
    const compare = SORTS.find((s) => s.key === sort)?.compare;
    return compare ? [...filtered].sort(compare) : filtered;
  }, [games, query, sort]);

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1 sm:max-w-sm">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-dim"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search maps"
            aria-label="Search maps"
            className="w-full rounded-full border border-edge bg-white/[0.06] py-2 pl-9 pr-3 text-sm text-fg outline-none backdrop-blur placeholder:text-fg-dim focus:border-accent"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSort(s.key)}
              aria-pressed={sort === s.key}
              className={`btn btn-sm rounded-full ${sort === s.key ? 'btn-active' : ''}`}
            >
              {s.icon}
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="mt-8 text-sm text-fg-dim">
          No maps match &ldquo;{query.trim()}&rdquo;.
        </p>
      ) : (
        <div className="mt-6 grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(210px,1fr))]">
          {visible.map((g) => (
            <GameCard key={g.slug} g={g} />
          ))}
        </div>
      )}
    </>
  );
}
