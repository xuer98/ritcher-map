// In-progress region polygon overlay for the admin drawing tool. The draft is a
// list of pixel-space vertices the operator clicks; we project them to lng/lat
// (same CRS as markers/regions) and render vertices + path + fill on top of
// everything so the shape is visible while it's being built.

import type { LayerSpecification } from 'maplibre-gl';
import { pixelToLngLat } from './crs';

export const DRAFT_SOURCE_ID = 'rm-region-draft';
export const DRAFT_FILL_LAYER_ID = 'rm-region-draft-fill';
export const DRAFT_LINE_LAYER_ID = 'rm-region-draft-line';
export const DRAFT_VERTEX_LAYER_ID = 'rm-region-draft-vertex';
/** All draft layer ids, top-to-bottom, for teardown. */
export const DRAFT_LAYER_IDS = [
  DRAFT_VERTEX_LAYER_ID,
  DRAFT_LINE_LAYER_ID,
  DRAFT_FILL_LAYER_ID,
] as const;

/** Amber, distinct from the deterministic per-region hues. */
const DRAFT_COLOR = '#fbbf24';

/**
 * The draft as a mixed-geometry FeatureCollection: a Point per vertex, a
 * LineString path once there are ≥2 points, and a closed Polygon once there are
 * ≥3. Each layer filters by geometry-type so one source feeds all three.
 */
export function draftToGeoJSON(
  points: [number, number][],
  maxZoom: number,
): GeoJSON.FeatureCollection {
  const ll = points.map(([x, y]) => {
    const { lng, lat } = pixelToLngLat(x, y, maxZoom);
    return [lng, lat] as [number, number];
  });

  const features: GeoJSON.Feature[] = ll.map((coord, i) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: coord },
    properties: { index: i },
  }));

  if (ll.length >= 2) {
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: ll },
      properties: {},
    });
  }
  if (ll.length >= 3) {
    features.push({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [[...ll, ll[0]]] },
      properties: {},
    });
  }

  return { type: 'FeatureCollection', features };
}

/** Fill + path + vertex layers for the draft source (rendered above markers). */
export function buildDraftLayers(): LayerSpecification[] {
  const fill: LayerSpecification = {
    id: DRAFT_FILL_LAYER_ID,
    type: 'fill',
    source: DRAFT_SOURCE_ID,
    filter: ['==', ['geometry-type'], 'Polygon'],
    paint: { 'fill-color': DRAFT_COLOR, 'fill-opacity': 0.15 },
  };
  const line: LayerSpecification = {
    id: DRAFT_LINE_LAYER_ID,
    type: 'line',
    source: DRAFT_SOURCE_ID,
    filter: ['==', ['geometry-type'], 'LineString'],
    paint: { 'line-color': DRAFT_COLOR, 'line-width': 2, 'line-opacity': 0.9 },
  };
  const vertex: LayerSpecification = {
    id: DRAFT_VERTEX_LAYER_ID,
    type: 'circle',
    source: DRAFT_SOURCE_ID,
    filter: ['==', ['geometry-type'], 'Point'],
    paint: {
      'circle-radius': 5,
      'circle-color': DRAFT_COLOR,
      'circle-stroke-color': '#000000',
      'circle-stroke-width': 1.5,
    },
  };
  return [fill, line, vertex];
}
