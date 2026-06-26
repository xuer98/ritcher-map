import type { LayerSpecification } from 'maplibre-gl';

/** Id of the GeoJSON source holding markers + clusters. */
export const MARKER_SOURCE_ID = 'rm-markers';

export const CLUSTER_LAYER_ID = 'rm-clusters';
export const CLUSTER_COUNT_LAYER_ID = 'rm-cluster-count';
/** Iconless markers (circle) and icon markers (symbol). Both are clickable. */
export const MARKER_LAYER_ID = 'rm-marker-points';
export const MARKER_SYMBOL_LAYER_ID = 'rm-marker-symbols';

/** All layers reading the marker source, in render order (cluster beneath markers). */
export const MARKER_LAYER_IDS = [
  CLUSTER_LAYER_ID,
  CLUSTER_COUNT_LAYER_ID,
  MARKER_LAYER_ID,
  MARKER_SYMBOL_LAYER_ID,
] as const;

/** Deterministic color from a category id. null -> neutral grey. */
export function categoryColor(categoryId: number | null): string {
  if (categoryId === null) return '#9aa0a6';
  // Golden-angle hue spread for good separation across nearby ids.
  const hue = (categoryId * 137.508) % 360;
  return `hsl(${hue.toFixed(1)}, 65%, 55%)`;
}

/**
 * Build the MapLibre layers for the marker source. The source has clustering
 * enabled (`cluster: true`), so MapLibre tags grouped points with `point_count`
 * and leaves individual markers without it. We key the layer filters off that:
 * a cluster circle (radius by count) + count label for `['has','point_count']`,
 * and individual marker circle/symbol layers for the rest. Found state shows via
 * stroke + opacity.
 *
 * Marker fill color reads an optional precomputed `color` feature property
 * (callers may set it via categoryColor); it falls back to a static accent.
 */
export function buildLayers(): LayerSpecification[] {
  const clusterCircle: LayerSpecification = {
    id: CLUSTER_LAYER_ID,
    type: 'circle',
    source: MARKER_SOURCE_ID,
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': '#3b82f6',
      'circle-opacity': 0.85,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 1.5,
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['get', 'point_count'],
        2,
        14,
        25,
        20,
        100,
        28,
        500,
        38,
      ],
    },
  };

  const clusterCount: LayerSpecification = {
    id: CLUSTER_COUNT_LAYER_ID,
    type: 'symbol',
    source: MARKER_SOURCE_ID,
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-size': 12,
      'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': '#ffffff',
    },
  };

  // Unclustered markers (no `point_count`) fall into two layers by whether their
  // category has a loaded icon sprite (the `icon` feature prop, set in
  // markers.ts): circle for the rest, symbol for icon-bearing ones. The filters
  // are mutually exclusive so every marker renders exactly once.
  const markerCircle: LayerSpecification = {
    id: MARKER_LAYER_ID,
    type: 'circle',
    source: MARKER_SOURCE_ID,
    filter: ['all', ['!', ['has', 'point_count']], ['!', ['has', 'icon']]],
    paint: {
      // Caller may inject a precomputed 'color' prop; otherwise accent.
      'circle-color': ['coalesce', ['get', 'color'], '#ef4444'],
      'circle-radius': 7,
      'circle-stroke-width': ['case', ['get', 'found'], 3, 1.5],
      'circle-stroke-color': ['case', ['get', 'found'], '#22c55e', '#ffffff'],
      'circle-opacity': ['case', ['get', 'found'], 0.55, 1],
    },
  };

  const markerSymbol: LayerSpecification = {
    id: MARKER_SYMBOL_LAYER_ID,
    type: 'symbol',
    source: MARKER_SOURCE_ID,
    filter: ['all', ['!', ['has', 'point_count']], ['has', 'icon']],
    layout: {
      'icon-image': ['get', 'icon'],
      'icon-size': 1,
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'icon-anchor': 'center',
    },
    paint: {
      // Found markers dim (the circle layer signals found via stroke instead).
      'icon-opacity': ['case', ['get', 'found'], 0.5, 1],
    },
  };

  return [clusterCircle, clusterCount, markerCircle, markerSymbol];
}
