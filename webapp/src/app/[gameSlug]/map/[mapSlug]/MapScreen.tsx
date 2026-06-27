"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getMarkers, type CatalogMarker } from "@/lib/api/maps";
import { useAuth } from "@/lib/auth/AuthContext";
import { LoginForm } from "@/lib/auth/LoginForm";
import { BrandTheme } from "@/lib/branding/BrandTheme";
import { resolveAssetUrl, resolveIconUrl } from "@/lib/icons";
import { regionColor } from "@/lib/map/regions";
import { CategoryIcon } from "@/lib/panels/CategoryIcon";
import { CategoryPanel } from "@/lib/panels/CategoryPanel";
import { MarkerDetail } from "@/lib/panels/MarkerDetail";
import { useProgressSync } from "@/lib/progress/useProgressSync";
import {
  ChevronRightIcon,
  DiscoveryIcon,
  EyeIcon,
  EyeOffIcon,
  LayersIcon,
  PinIcon,
  SearchIcon,
} from "@/lib/ui/icons";
import type {
  CategoryResponse,
  GameResponse,
  MapResponse,
  RegionResponse,
} from "@/lib/types";

// MapLibre needs the DOM/WebGL — the single ssr:false boundary of the app.
const MapView = dynamic(() => import("@/lib/map/MapView"), { ssr: false });

export interface MapScreenProps {
  meta: MapResponse;
  categories: CategoryResponse[];
  /** All maps of the same game, for the switcher (includes `meta` itself). */
  siblings: MapResponse[];
  /** Named polygonal areas of this map (rendered + clickable to zoom). */
  regions: RegionResponse[];
  gameTitle: string;
  /** Per-game branding (colors/font/logo); null when the game has no row. */
  game: GameResponse | null;
}

const SEARCH_LIMIT = 20;

export function MapScreen({
  meta,
  categories,
  siblings,
  regions,
  gameTitle,
  game,
}: MapScreenProps) {
  const { user, token, logout } = useAuth();
  const authed = token !== null;
  const progress = useProgressSync(meta.id, authed);

  // Category ids that are HIDDEN; an empty set means everything is shown.
  // Non-trackable categories (informational overlays) start hidden — the player
  // can still toggle them on from the category panel.
  // `=== false` (not `!c.trackable`) so a category from an older catalog that
  // omits the field is treated as trackable (the default), not hidden.
  const [hiddenCats, setHiddenCats] = useState<Set<number>>(
    () =>
      new Set(
        categories.filter((c) => c.trackable === false).map((c) => c.id),
      ),
  );
  const [hideFound, setHideFound] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  // Side-menu disclosure state.
  const [mapMenuOpen, setMapMenuOpen] = useState(false);
  const [regionsOpen, setRegionsOpen] = useState(true);
  const [focus, setFocus] = useState<{
    x: number;
    y: number;
    key: number;
  } | null>(null);
  // Region to fit the camera to (bump key to retrigger the same region).
  const [regionFocus, setRegionFocus] = useState<{
    id: number;
    key: number;
  } | null>(null);
  // Full catalog marker list (titles + descriptions): powers search and the
  // detail panel — the viewport endpoint intentionally omits descriptions.
  const [allMarkers, setAllMarkers] = useState<CatalogMarker[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMarkers(meta.id)
      .then((ms) => {
        if (!cancelled) setAllMarkers(ms);
      })
      .catch(() => {
        if (!cancelled) setAllMarkers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [meta.id]);

  const markerById = useMemo(
    () => new Map((allMarkers ?? []).map((m) => [m.id, m])),
    [allMarkers]
  );
  // Marker count per category ON THIS MAP. Categories are game-scoped (shared by
  // every map of the game), so the panel must count this map's markers — not the
  // category's subcategory count, which is identical across all the game's maps.
  const markerCountByCategory = useMemo(() => {
    const m = new Map<number, number>();
    for (const mk of allMarkers ?? []) {
      m.set(mk.categoryId, (m.get(mk.categoryId) ?? 0) + 1);
    }
    return m;
  }, [allMarkers]);
  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );
  // Category ids that count toward discovery progress (trackable ones). Markers
  // in non-trackable categories are excluded from both the total and the found
  // tally below.
  const trackableCatIds = useMemo(
    () =>
      new Set(
        categories.filter((c) => c.trackable !== false).map((c) => c.id)
      ),
    [categories]
  );
  // categoryId -> resolved icon URL, for the map's symbol layer. Only
  // categories with a usable icon appear; the rest stay colored circles.
  const categoryIcons = useMemo(() => {
    const m = new Map<number, string>();
    for (const c of categories) {
      const url = resolveIconUrl(c.icon);
      if (url) m.set(c.id, url);
    }
    return m;
  }, [categories]);

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || !allMarkers) return [];
    return allMarkers
      .filter((m) => (m.title ?? "").toLowerCase().includes(q))
      .slice(0, SEARCH_LIMIT);
  }, [search, allMarkers]);

  // Flip one category between shown and hidden.
  const toggleCat = (id: number) =>
    setHiddenCats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Hide or show a batch of categories at once (a group's master toggle).
  const setManyHidden = (ids: number[], hidden: boolean) =>
    setHiddenCats((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (hidden) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  const showAllCats = () => setHiddenCats(new Set());
  const hideAllCats = () => setHiddenCats(new Set(categories.map((c) => c.id)));

  const jumpTo = (m: CatalogMarker) => {
    setSelectedId(m.id);
    setFocus({ x: m.x, y: m.y, key: Date.now() });
  };

  // A `[label](#marker-<id>)` reference inside a description: select + fly to it
  // (which swaps the detail panel to that marker). No-op if it isn't loaded.
  const onMarkerLink = useCallback(
    (id: number) => {
      const m = markerById.get(id);
      if (!m) return;
      setSelectedId(id);
      setFocus({ x: m.x, y: m.y, key: Date.now() });
    },
    [markerById]
  );
  const resolveMarkerLabel = useCallback(
    (id: number) => markerById.get(id)?.title ?? null,
    [markerById]
  );

  // MapView filters the full marker set by these category ids client-side:
  // null = show everything; an explicit list (empty = none) = exactly those.
  const allCatIds = categories.map((c) => c.id);
  const visibleCatIds = allCatIds.filter((id) => !hiddenCats.has(id));
  const catFilter =
    visibleCatIds.length === allCatIds.length ? null : visibleCatIds;
  const selected =
    selectedId === null ? null : markerById.get(selectedId) ?? null;
  const readyMaps = siblings
    .filter((s) => s.status === "READY")
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const isOrphan = siblings.length == 1;
  const logo = resolveAssetUrl(game?.logoUrl ?? null);
  const hasMapMenu = readyMaps.length > 1;
  // Discovery box: found / total on this map, counting only markers in
  // trackable categories (non-trackable overlays don't affect completion).
  const countableMarkers = (allMarkers ?? []).filter((m) =>
    trackableCatIds.has(m.categoryId)
  );
  const total = countableMarkers.length;
  const foundCount = countableMarkers.reduce(
    (n, m) => (progress.found.has(m.id) ? n + 1 : n),
    0
  );
  const pct = total > 0 ? Math.round((foundCount / total) * 100) : 0;
  // "Hide all" flips to "Show all" once every category is hidden.
  const allHidden = allCatIds.length > 0 && hiddenCats.size >= allCatIds.length;

  return (
    <BrandTheme game={game} className="relative h-dvh w-full overflow-hidden">
      <div className="absolute inset-0 z-0">
        <MapView
          meta={meta}
          markers={allMarkers ?? []}
          categories={catFilter}
          found={progress.found}
          hideFound={hideFound}
          onMarkerClick={setSelectedId}
          focus={focus}
          categoryIcons={categoryIcons}
          regions={regions}
          regionFocus={regionFocus}
        />
      </div>

      <aside className="sidebar absolute left-0 top-0 z-10">
        <Link
          href={`/${meta.gameSlug}`}
          className="px-0.5 pt-0.5 hover:no-underline"
        >
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt={gameTitle}
              className="max-h-9 w-auto max-w-full object-contain object-left"
            />
          ) : (
            <span className="text-base font-bold tracking-[0.2px] text-fg">
              ← {gameTitle}
            </span>
          )}
        </Link>

        {/* Search */}
        <div>
          <div className="flex items-center gap-2.5 rounded-full bg-panel px-4 py-2.5">
            <SearchIcon size={18} className="flex-none text-fg-dim" />
            <input
              className="w-full bg-transparent text-sm text-fg outline-none placeholder:text-fg-dim"
              type="search"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {search.trim() !== "" && (
            <div className="mt-1.5 flex max-h-[30vh] flex-col gap-0.5 overflow-y-auto rounded-2xl bg-panel p-1.5">
              {allMarkers === null ? (
                <div className="px-1.5 py-1 text-sm text-fg-dim">
                  Loading markers…
                </div>
              ) : results.length === 0 ? (
                <div className="px-1.5 py-1 text-sm text-fg-dim">
                  No matches.
                </div>
              ) : (
                results.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className="flex items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm text-fg hover:bg-white/[0.07]"
                    onClick={() => jumpTo(m)}
                  >
                    <CategoryIcon
                      icon={categoryById.get(m.categoryId)?.icon ?? null}
                      categoryId={m.categoryId}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {m.title ?? `Marker #${m.id}`}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Discovery progress */}
        <button
          type="button"
          onClick={() => {
            if (!authed) setShowLogin(true);
          }}
          className={`flex items-center gap-3 rounded-[18px] bg-olive px-4 py-3 text-left${
            authed ? " cursor-default" : ""
          }`}
        >
          <DiscoveryIcon size={26} className="flex-none text-lime" />
          <span className="block min-w-0 flex-1">
            <span className="block text-[12px] font-extrabold uppercase tracking-[1.5px] text-lime">
              Discovery Progress
            </span>
            <span className="block truncate text-[13px] text-fg">
              {authed
                ? `${pct}% discovered`
                : "Please log in to track your progress"}
            </span>
          </span>
          <span className="flex-none text-sm font-bold tabular-nums text-fg">
            {foundCount} / {total}
          </span>
        </button>

        {/* Choose map */}
        {!isOrphan && (
          <div className="rounded-2xl bg-panel">
            <button
              type="button"
              onClick={() => hasMapMenu && setMapMenuOpen((o) => !o)}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left${
                hasMapMenu ? "" : " cursor-default"
              }`}
              aria-expanded={hasMapMenu ? mapMenuOpen : undefined}
            >
              <LayersIcon size={20} className="flex-none text-fg" />
              <span className="block min-w-0 flex-1">
                <span className="block text-[11px] font-bold uppercase tracking-[2px] text-fg-dim">
                  Choose map
                </span>
                <span className="block truncate text-[15px] font-semibold text-fg">
                  {meta.name}
                </span>
              </span>
              {hasMapMenu && (
                <ChevronRightIcon
                  size={18}
                  className={`flex-none text-fg-dim transition-transform${
                    mapMenuOpen ? " rotate-90" : ""
                  }`}
                />
              )}
            </button>
            {hasMapMenu && mapMenuOpen && (
              <div className="flex flex-col gap-0.5 border-t border-edge px-2 py-2">
                {readyMaps.map((s) =>
                  s.id === meta.id ? (
                    <span
                      key={s.id}
                      className="rounded-lg bg-white/5 px-2.5 py-1.5 text-sm font-semibold text-fg"
                    >
                      {s.name}
                    </span>
                  ) : (
                    <Link
                      key={s.id}
                      href={`/${s.gameSlug}/map/${s.mapSlug}`}
                      className="rounded-lg px-2.5 py-1.5 text-sm text-fg hover:bg-white/5 hover:no-underline"
                    >
                      {s.name}
                    </Link>
                  )
                )}
              </div>
            )}
          </div>
        )}

        {/* Quick toggles */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => (allHidden ? showAllCats() : hideAllCats())}
            className={`flex flex-col items-center gap-1.5 rounded-xl py-3 ${
              allHidden ? "text-lime" : "text-fg hover:bg-white/5"
            }`}
          >
            {allHidden ? <EyeIcon size={22} /> : <EyeOffIcon size={22} />}
            <span className="text-[12px] font-bold uppercase tracking-[1.5px]">
              {allHidden ? "Show all" : "Hide all"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setHideFound((v) => !v)}
            className={`flex flex-col items-center gap-1.5 rounded-xl py-3 ${
              hideFound ? "text-lime" : "text-fg hover:bg-white/5"
            }`}
            aria-pressed={hideFound}
          >
            <PinIcon size={22} />
            <span className="text-[12px] font-bold uppercase tracking-[1.5px]">
              Unfound only
            </span>
          </button>
        </div>

        <div className="h-px bg-[#26282b]" />

        {/* Sections: regions + categories */}
        <div className="flex flex-col gap-0.5">
          {regions.length > 0 && (
            <div className="flex flex-col">
              <button
                type="button"
                onClick={() => setRegionsOpen((o) => !o)}
                className="section-row"
                aria-expanded={regionsOpen}
              >
                <ChevronRightIcon
                  size={13}
                  className={`flex-none text-fg transition-transform${
                    regionsOpen ? " rotate-90" : ""
                  }`}
                />
                <span className="section-title flex-1">Map Regions</span>
              </button>
              {regionsOpen && (
                <div className="flex flex-col gap-0.5 pb-1 pl-6">
                  {regions.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left text-sm hover:bg-white/5"
                      onClick={() =>
                        setRegionFocus((f) => ({
                          id: r.id,
                          key: (f?.key ?? 0) + 1,
                        }))
                      }
                    >
                      <span
                        aria-hidden="true"
                        className="h-2.5 w-2.5 flex-none rounded-[2px]"
                        style={{ background: regionColor(r.id) }}
                      />
                      <span className="truncate">{r.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <CategoryPanel
            categories={categories}
            counts={markerCountByCategory}
            hidden={hiddenCats}
            onToggle={toggleCat}
            onSetMany={setManyHidden}
          />
        </div>

        {authed && (
          <div className="mt-auto flex items-center justify-between gap-2 rounded-xl bg-panel px-3 py-2">
            <span className="min-w-0 truncate text-[13px] text-fg">
              {user?.email}
            </span>
            <button type="button" className="btn btn-sm" onClick={logout}>
              Log out
            </button>
          </div>
        )}
      </aside>

      {selected && (
        <MarkerDetail
          marker={selected}
          category={categoryById.get(selected.categoryId)}
          authed={authed}
          found={progress.isFound(selected.id)}
          onToggleFound={() => progress.toggle(selected.id)}
          onClose={() => setSelectedId(null)}
          onMarkerLink={onMarkerLink}
          resolveMarkerLabel={resolveMarkerLabel}
        />
      )}

      {showLogin && !authed && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 backdrop-blur-[2px]"
          onClick={() => setShowLogin(false)}
        >
          <div
            className="relative w-90 max-w-[calc(100vw-32px)] rounded-card border border-edge bg-panel p-6 shadow-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <LoginForm onClose={() => setShowLogin(false)} />
          </div>
        </div>
      )}
    </BrandTheme>
  );
}
