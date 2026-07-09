"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getMarkers,
  registerMarkerClick,
  type CatalogMarker,
} from "@/lib/api/maps";
import { useAuth } from "@/lib/auth/AuthContext";
import { LoginForm } from "@/lib/auth/LoginForm";
import { BrandTheme } from "@/lib/branding/BrandTheme";
import { resolveAssetUrl, resolveIconUrl } from "@/lib/icons";
import { regionColor } from "@/lib/map/regions";
import { CategoryIcon } from "@/lib/panels/CategoryIcon";
import { CategoryPanel } from "@/lib/panels/CategoryPanel";
import { MarkerDetail } from "@/lib/panels/MarkerDetail";
import {
  CustomMarkerEditor,
  type CustomMarkerTarget,
} from "@/lib/panels/CustomMarkerEditor";
import { useProgressSync } from "@/lib/progress/useProgressSync";
import { useCustomMarkers } from "@/lib/customMarkers/useCustomMarkers";
import { CUSTOM_MARKER_DEFAULT_COLOR } from "@/lib/map/customMarkers";
import {
  ChevronRightIcon,
  DiscoveryIcon,
  EyeIcon,
  EyeOffIcon,
  FlameIcon,
  LayersIcon,
  MapPinPlusIcon,
  PanelCollapseIcon,
  PanelExpandIcon,
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

/**
 * Ids of categories that are "untracked" — either the category itself is
 * non-trackable, OR its parent is (untracked cascades to subcategories). These
 * are the informational overlays: hidden on the map by default and excluded
 * from discovery progress. `=== false` (not `!trackable`) so a category from an
 * older catalog that omits the field is treated as trackable (the default).
 */
function untrackedCategoryIds(categories: CategoryResponse[]): Set<number> {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const isUntracked = (c: CategoryResponse): boolean =>
    c.trackable === false ||
    (c.parentId !== null && byId.get(c.parentId)?.trackable === false);
  return new Set(categories.filter(isUntracked).map((c) => c.id));
}

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
  const customMarkers = useCustomMarkers(meta.id, authed);

  // "My Markers" (per-user custom pins). `placing` arms the next map click to
  // drop a pin; `customTarget` drives the editor (a new draft or an existing
  // pin); `hiddenCustomIds` mirrors hiddenCats for per-pin visibility.
  const [placing, setPlacing] = useState(false);
  const [customTarget, setCustomTarget] = useState<CustomMarkerTarget | null>(
    null,
  );
  const [customBusy, setCustomBusy] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);
  const [hiddenCustomIds, setHiddenCustomIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [myMarkersOpen, setMyMarkersOpen] = useState(true);

  // Sibling maps of a game share this route segment, so React reconciles
  // MapScreen in place across a map switch — reset per-map ephemeral UI state
  // (selection, placement, the open editor) so nothing from the old map leaks.
  useEffect(() => {
    setSelectedId(null);
    setPlacing(false);
    setCustomTarget(null);
    setCustomError(null);
    setHiddenCustomIds(new Set());
    // Re-arm the loading overlay: switching maps rebuilds the MapView map, so
    // onTilesLoaded fires again. allMarkers goes back to null (not the old
    // map's stale list) so the overlay + search hold until the refetch lands.
    setTilesLoaded(false);
    setAllMarkers(null);
  }, [meta.id]);

  // Category ids that are HIDDEN; an empty set means everything is shown.
  // Untracked categories (and their subcategories) start hidden — informational
  // overlays the player can still toggle on from the category panel.
  const [hiddenCats, setHiddenCats] = useState<Set<number>>(() =>
    untrackedCategoryIds(categories),
  );
  const [hideFound, setHideFound] = useState(false);
  const [popularOnly, setPopularOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  // Side-menu disclosure state.
  const [sidebarOpen, setSidebarOpen] = useState(true);
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
  // First visually complete map render (style + initial tiles), per map.
  const [tilesLoaded, setTilesLoaded] = useState(false);

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
  // Shared deep link: /…/map/<slug>?m=<markerId> selects + flies to the marker
  // once the catalog list arrives (client-only; runs at most once per map).
  useEffect(() => {
    if (allMarkers === null) return;
    const id = Number(new URLSearchParams(window.location.search).get("m"));
    if (!Number.isInteger(id) || id <= 0) return;
    const m = markerById.get(id);
    if (!m) return;
    setSelectedId(id);
    setFocus({ x: m.x, y: m.y, key: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allMarkers === null, meta.id]);
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
  // Category ids that count toward discovery progress. Untracked categories AND
  // their subcategories are excluded from both the total and the found tally
  // below — same cascade as the hidden-by-default set above.
  const trackableCatIds = useMemo(() => {
    const untracked = untrackedCategoryIds(categories);
    return new Set(
      categories.filter((c) => !untracked.has(c.id)).map((c) => c.id),
    );
  }, [categories]);
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

  // Popularity filter: "popular" = top quintile (>= the 80th-percentile click
  // count) among this map's markers that have been clicked at all. Until
  // anything is clicked there's no signal, so the filter shows nothing.
  const popularityThreshold = useMemo(() => {
    const counts = (allMarkers ?? [])
      .map((m) => m.clickCount ?? 0)
      .filter((c) => c > 0)
      .sort((a, b) => a - b);
    if (counts.length === 0) return Infinity;
    return Math.max(1, counts[Math.floor(counts.length * 0.8)] ?? counts[counts.length - 1]);
  }, [allMarkers]);
  const markersForMap = useMemo(() => {
    const ms = allMarkers ?? [];
    if (!popularOnly) return ms;
    return ms.filter((m) => (m.clickCount ?? 0) >= popularityThreshold);
  }, [allMarkers, popularOnly, popularityThreshold]);

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

  // A `[label](#category-<id>)` reference: reveal that category's markers on
  // the map (descriptions often point at hidden/untracked overlays). No-op for
  // ids outside this game; already-visible categories stay as they are.
  const onCategoryLink = useCallback(
    (id: number) => {
      if (!categoryById.has(id)) return;
      setHiddenCats((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
    [categoryById]
  );
  const resolveCategoryLabel = useCallback(
    (id: number) => categoryById.get(id)?.name ?? null,
    [categoryById]
  );

  const regionById = useMemo(
    () => new Map(regions.map((r) => [r.id, r])),
    [regions]
  );
  // A `[label](#region-<id>)` reference: fit the camera to the region, exactly
  // like the sidebar's region list. No-op if the region isn't on this map.
  const onRegionLink = useCallback(
    (id: number) => {
      if (!regionById.has(id)) return;
      setRegionFocus((f) => ({ id, key: (f?.key ?? 0) + 1 }));
    },
    [regionById]
  );
  const resolveRegionLabel = useCallback(
    (id: number) => regionById.get(id)?.name ?? null,
    [regionById]
  );

  // --- custom markers --------------------------------------------------------
  const visibleCustomMarkers = useMemo(
    () => customMarkers.markers.filter((m) => !hiddenCustomIds.has(m.id)),
    [customMarkers.markers, hiddenCustomIds],
  );

  // Toggle placement mode. Anonymous users get the login modal (custom markers
  // are account-scoped, like progress).
  const togglePlacing = () => {
    if (!authed) {
      setShowLogin(true);
      return;
    }
    setSelectedId(null);
    setCustomTarget(null);
    setPlacing((p) => !p);
  };

  // A map click while arming places a new pin (opens the editor on its spot).
  const onMapClickPlace = (p: { x: number; y: number }) => {
    if (!placing) return;
    setPlacing(false);
    setSelectedId(null);
    setCustomError(null);
    setCustomTarget({ kind: "new", x: p.x, y: p.y });
  };

  const openCustomMarker = (id: string) => {
    const m = customMarkers.markers.find((cm) => cm.id === id);
    if (!m) return;
    setPlacing(false);
    setSelectedId(null);
    setCustomError(null);
    setCustomTarget({ kind: "edit", marker: m });
  };

  // Drag-to-reposition persists immediately; the hook rolls back (snapping the
  // pin to its saved spot) if the write fails.
  const onCustomDragEnd = (id: string, p: { x: number; y: number }) => {
    customMarkers
      .update(id, { x: Math.round(p.x), y: Math.round(p.y) })
      .catch(() => {});
  };

  const saveCustomMarker = async (values: {
    label: string | null;
    note: string | null;
    color: string | null;
  }) => {
    if (!customTarget) return;
    setCustomBusy(true);
    setCustomError(null);
    try {
      if (customTarget.kind === "new") {
        await customMarkers.create({
          x: customTarget.x,
          y: customTarget.y,
          ...values,
        });
      } else {
        await customMarkers.update(customTarget.marker.id, values);
      }
      setCustomTarget(null);
    } catch (err) {
      // Keep the editor open with the reason (e.g. the per-map cap) so the user
      // can fix it and retry; the optimistic rollback already happened.
      setCustomError(err instanceof Error ? err.message : "Couldn't save marker.");
    } finally {
      setCustomBusy(false);
    }
  };

  const deleteCustomMarker = async () => {
    if (customTarget?.kind !== "edit") return;
    if (!window.confirm("Delete this marker?")) return;
    setCustomBusy(true);
    setCustomError(null);
    try {
      await customMarkers.remove(customTarget.marker.id);
      setCustomTarget(null);
    } catch (err) {
      setCustomError(err instanceof Error ? err.message : "Couldn't delete marker.");
    } finally {
      setCustomBusy(false);
    }
  };

  const toggleCustomHidden = (id: string) =>
    setHiddenCustomIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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
  // Loading overlay: covers the map until the first complete render (style +
  // initial tiles) AND the marker list have both landed. Mirrors MapView's
  // internal isReady gate (which can't be imported here — the module is
  // client-only via dynamic(ssr:false)): a non-renderable map never creates a
  // MapLibre instance, so onTilesLoaded would never fire — don't wait on it.
  const mapRenderable =
    meta.status === "READY" &&
    meta.width !== null &&
    meta.height !== null &&
    meta.maxZoom !== null;
  const mapLoading = mapRenderable && (!tilesLoaded || allMarkers === null);

  return (
    <BrandTheme game={game} className="relative h-dvh w-full overflow-hidden">
      <div className="absolute inset-0 z-0">
        <MapView
          meta={meta}
          markers={markersForMap}
          categories={catFilter}
          found={progress.found}
          hideFound={hideFound}
          onMarkerClick={(id) => {
            setCustomTarget(null);
            setSelectedId(id);
            // Popularity signal: every marker open counts one click. Server
            // increment is fire-and-forget; the local bump keeps the loaded
            // list consistent without a refetch.
            registerMarkerClick(id);
            setAllMarkers((ms) =>
              ms === null
                ? ms
                : ms.map((m) =>
                    m.id === id
                      ? { ...m, clickCount: (m.clickCount ?? 0) + 1 }
                      : m,
                  ),
            );
          }}
          onMarkerToggleFound={(id) => {
            // Ctrl/Cmd+click shortcut: flip found state without opening the
            // panel. Anonymous users get the login modal (progress is synced
            // server-side), mirroring the discovery box and marker-placing.
            if (!authed) {
              setShowLogin(true);
              return;
            }
            progress.toggle(id);
          }}
          focus={focus}
          categoryIcons={categoryIcons}
          regions={regions}
          regionFocus={regionFocus}
          customMarkers={visibleCustomMarkers}
          onCustomMarkerClick={openCustomMarker}
          onCustomMarkerDragEnd={onCustomDragEnd}
          onMapClick={onMapClickPlace}
          placing={placing}
          onTilesLoaded={() => setTilesLoaded(true)}
        />
        {mapLoading && (
          <div
            role="status"
            aria-live="polite"
            // Same hex as the map style's background layer, so dismissal reveals
            // the map without a color jump. Sits above the canvas but inside the
            // z-0 map wrapper, leaving the sidebar/chrome interactive.
            className="absolute inset-0 z-10 grid place-items-center bg-[#0b0d10]"
          >
            <div className="flex items-center gap-3 rounded-full bg-panel px-5 py-3 shadow-panel">
              <span
                aria-hidden="true"
                className="h-4 w-4 animate-spin rounded-full border-2 border-fg-dim border-t-transparent"
              />
              <span className="text-sm text-fg-dim">
                {tilesLoaded ? "Loading markers…" : "Loading map…"}
              </span>
            </div>
          </div>
        )}
      </div>

      {!sidebarOpen && (
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open sidebar"
          title="Open sidebar"
          className="absolute left-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-panel text-fg shadow-panel hover:bg-white/10"
        >
          <PanelExpandIcon size={20} />
        </button>
      )}

      <aside
        className={`sidebar absolute left-0 top-0 z-10${
          sidebarOpen ? "" : " hidden"
        }`}
      >
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

        {/* Collapse + search */}
        <div className="flex items-start gap-2.5">
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
            className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-panel text-fg hover:bg-white/10"
          >
            <PanelCollapseIcon size={20} />
          </button>
          <div className="min-w-0 flex-1">
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
        <div className="grid grid-cols-3 gap-2">
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
          <button
            type="button"
            onClick={() => setPopularOnly((v) => !v)}
            className={`flex flex-col items-center gap-1.5 rounded-xl py-3 ${
              popularOnly ? "text-lime" : "text-fg hover:bg-white/5"
            }`}
            aria-pressed={popularOnly}
            title="Show only the most-clicked markers"
          >
            <FlameIcon size={22} />
            <span className="text-[12px] font-bold uppercase tracking-[1.5px]">
              Popular
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
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 pb-1 pl-6">
                  {regions.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className="flex min-w-0 items-center gap-2 rounded-md px-1 py-1 text-left text-sm hover:bg-white/5"
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

          {authed && (
            <div className="flex flex-col">
              <button
                type="button"
                onClick={() => setMyMarkersOpen((o) => !o)}
                className="section-row"
                aria-expanded={myMarkersOpen}
              >
                <ChevronRightIcon
                  size={13}
                  className={`flex-none text-fg transition-transform${
                    myMarkersOpen ? " rotate-90" : ""
                  }`}
                />
                <span className="section-title flex-1">My Markers</span>
                <span className="flex-none text-xs font-bold tabular-nums text-fg">
                  {customMarkers.markers.length}
                </span>
              </button>
              {myMarkersOpen && (
                <div className="flex flex-col gap-0.5 pb-1 pl-6">
                  {customMarkers.markers.length === 0 ? (
                    <p className="px-1 py-1 text-[13px] text-fg-dim">
                      None yet — tap the pin button, then click the map to add
                      one.
                    </p>
                  ) : (
                    customMarkers.markers.map((m) => {
                      const hidden = hiddenCustomIds.has(m.id);
                      return (
                        <div
                          key={m.id}
                          className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-white/5"
                        >
                          <button
                            type="button"
                            className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
                            onClick={() => {
                              openCustomMarker(m.id);
                              setFocus({ x: m.x, y: m.y, key: Date.now() });
                            }}
                          >
                            <span
                              aria-hidden="true"
                              className="h-2.5 w-2.5 flex-none rounded-full border border-white/70"
                              style={{
                                background: m.color ?? CUSTOM_MARKER_DEFAULT_COLOR,
                              }}
                            />
                            <span
                              className={`truncate${hidden ? " opacity-45" : ""}`}
                            >
                              {m.label || "Untitled"}
                            </span>
                          </button>
                          <button
                            type="button"
                            className="flex-none p-1 text-fg-dim hover:text-fg"
                            aria-label={hidden ? "Show marker" : "Hide marker"}
                            onClick={() => toggleCustomHidden(m.id)}
                          >
                            {hidden ? (
                              <EyeOffIcon size={16} />
                            ) : (
                              <EyeIcon size={16} />
                            )}
                          </button>
                        </div>
                      );
                    })
                  )}
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
          found={progress.isFound(selected.id)}
          onToggleFound={() => {
            // Progress is account-scoped — anonymous users get the login modal
            // (same gate as the ctrl-click shortcut and the discovery box).
            if (!authed) {
              setShowLogin(true);
              return;
            }
            progress.toggle(selected.id);
          }}
          onClose={() => setSelectedId(null)}
          onExplore={() => jumpTo(selected)}
          onMarkerLink={onMarkerLink}
          resolveMarkerLabel={resolveMarkerLabel}
          onCategoryLink={onCategoryLink}
          resolveCategoryLabel={resolveCategoryLabel}
          onRegionLink={onRegionLink}
          resolveRegionLabel={resolveRegionLabel}
        />
      )}

      {customTarget && (
        <CustomMarkerEditor
          key={
            customTarget.kind === "edit"
              ? customTarget.marker.id
              : `new-${customTarget.x}-${customTarget.y}`
          }
          target={customTarget}
          busy={customBusy}
          error={customError}
          onSave={saveCustomMarker}
          onDelete={deleteCustomMarker}
          onClose={() => setCustomTarget(null)}
        />
      )}

      {/* Floating "add a custom marker" button — hidden while a detail/editor
          panel is open (they share the bottom-right corner). */}
      {!selected && !customTarget && (
        <button
          type="button"
          onClick={togglePlacing}
          aria-pressed={placing}
          aria-label={placing ? "Cancel adding marker" : "Add a custom marker"}
          title={
            placing ? "Click the map to place — or tap to cancel" : "Add a marker"
          }
          className={`absolute bottom-5 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full shadow-panel transition-colors ${
            placing
              ? "bg-lime text-black"
              : "bg-white text-[#1a1c1f] hover:bg-white/90"
          }`}
        >
          <MapPinPlusIcon size={26} />
        </button>
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
