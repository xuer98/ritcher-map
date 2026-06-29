// User-created "My Markers" rendered as a distinct layer ABOVE the catalog
// markers. Kept separate (own source/layers, own click+drag routing) so user
// pins never mix with catalog content. Like the catalog markers, these are
// rendered individually — clustering is deliberately NOT used (supercluster
// mis-tiles the pixel CRS; see the note in MapView). Pixel x/y are projected to
// lng/lat at maxZoom, same as every other overlay.

import type { LayerSpecification } from 'maplibre-gl';
import { pixelToLngLat } from './crs';
import type { CustomMarker } from '../api/customMarkers';

export const CUSTOM_MARKER_SOURCE_ID = 'rm-custom-markers';
export const CUSTOM_MARKER_LAYER_ID = 'rm-custom-points';
export const CUSTOM_MARKER_LABEL_LAYER_ID = 'rm-custom-labels';
/** All custom-marker layer ids, top-to-bottom, for teardown. */
export const CUSTOM_MARKER_LAYER_IDS = [
  CUSTOM_MARKER_LABEL_LAYER_ID,
  CUSTOM_MARKER_LAYER_ID,
] as const;

/** Default pin tint when the user hasn't picked a color. */
export const CUSTOM_MARKER_DEFAULT_COLOR = '#a855f7';

/**
 * Palette offered in the editor. Sent verbatim as `color` (#rrggbb); the
 * accounts service validates the hex format, so this list can change freely.
 */
export const CUSTOM_MARKER_PALETTE: readonly string[] = [
  '#ef4444', // red
  '#f59e0b', // amber
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#a855f7', // violet
  '#ec4899', // pink
];

/** Custom markers as a MapLibre FeatureCollection (pixel coords -> lng/lat). */
export function customMarkersToGeoJSON(
  markers: CustomMarker[],
  maxZoom: number,
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: markers.map((m) => {
      const { lng, lat } = pixelToLngLat(m.x, m.y, maxZoom);
      return {
        type: 'Feature' as const,
        // id stays in properties (string UUID) — the click/drag handlers read
        // properties.id, never feature.id.
        properties: {
          id: m.id,
          color: m.color ?? CUSTOM_MARKER_DEFAULT_COLOR,
          label: m.label ?? '',
          // `title` so the shared hover-popup (which reads properties.title)
          // shows the label.
          title: m.label ?? '',
        },
        geometry: { type: 'Point' as const, coordinates: [lng, lat] },
      };
    }),
  };
}

/**
 * A colored ringed dot + a label above it. The white ring + violet-ish default
 * reads clearly distinct from catalog markers (red circles / category glyphs),
 * and `circle-color` reads the per-marker `color` property so each pin shows the
 * user's chosen tint.
 */
export function buildCustomMarkerLayers(): LayerSpecification[] {
  const points: LayerSpecification = {
    id: CUSTOM_MARKER_LAYER_ID,
    type: 'circle',
    source: CUSTOM_MARKER_SOURCE_ID,
    paint: {
      'circle-color': ['coalesce', ['get', 'color'], CUSTOM_MARKER_DEFAULT_COLOR],
      'circle-radius': 8,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2.5,
    },
  };
  const labels: LayerSpecification = {
    id: CUSTOM_MARKER_LABEL_LAYER_ID,
    type: 'symbol',
    source: CUSTOM_MARKER_SOURCE_ID,
    layout: {
      'text-field': ['get', 'label'],
      'text-size': 12,
      'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
      'text-offset': [0, -1.4],
      'text-anchor': 'bottom',
      'text-optional': true,
    },
    paint: {
      'text-color': '#ffffff',
      'text-halo-color': 'rgba(0,0,0,0.75)',
      'text-halo-width': 1.4,
    },
  };
  return [points, labels];
}
