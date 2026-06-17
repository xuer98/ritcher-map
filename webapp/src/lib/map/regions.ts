// Region overlays: named polygons rendered beneath the markers. Pixel-space
// polygon coords are projected to lng/lat (same CRS as markers) for MapLibre.
// Clicking a region fits the camera to its bounds (see MapView).

import type { LayerSpecification } from 'maplibre-gl';
import { pixelToLngLat } from './crs';
import type { RegionResponse } from '../types';

export const REGION_SOURCE_ID = 'rm-regions';
export const REGION_FILL_LAYER_ID = 'rm-region-fill';
export const REGION_LINE_LAYER_ID = 'rm-region-line';
export const REGION_LABEL_LAYER_ID = 'rm-region-label';
/** All region layer ids, top-to-bottom, for teardown. */
export const REGION_LAYER_IDS = [
  REGION_LABEL_LAYER_ID,
  REGION_LINE_LAYER_ID,
  REGION_FILL_LAYER_ID,
] as const;

/** Deterministic color per region id (golden-angle hue spread). */
export function regionColor(id: number): string {
  const hue = (id * 137.508) % 360;
  return `hsl(${hue.toFixed(1)}, 70%, 60%)`;
}

/** Region polygons as a MapLibre FeatureCollection (coords projected to lng/lat). */
export function regionsToGeoJSON(
  regions: RegionResponse[],
  maxZoom: number,
): GeoJSON.FeatureCollection<GeoJSON.Polygon> {
  return {
    type: 'FeatureCollection',
    features: regions
      .filter((r) => r.polygon && r.polygon.length >= 3)
      .map((r) => {
        const ring = r.polygon.map(([x, y]) => {
          const { lng, lat } = pixelToLngLat(x, y, maxZoom);
          return [lng, lat] as [number, number];
        });
        // Ensure the ring is closed for valid GeoJSON.
        const first = ring[0];
        const last = ring[ring.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);
        return {
          type: 'Feature' as const,
          id: r.id,
          properties: {
            kind: 'region',
            id: r.id,
            name: r.name,
            title: r.name,
            color: regionColor(r.id),
          },
          geometry: { type: 'Polygon' as const, coordinates: [ring] },
        };
      }),
  };
}

/** [[swLng, swLat], [neLng, neLat]] for a region's bbox, to pass to fitBounds. */
export function regionBounds(
  region: RegionResponse,
  maxZoom: number,
): [[number, number], [number, number]] {
  const [minX, minY, maxX, maxY] = region.bbox;
  const sw = pixelToLngLat(minX, maxY, maxZoom); // bottom-left
  const ne = pixelToLngLat(maxX, minY, maxZoom); // top-right
  return [
    [sw.lng, sw.lat],
    [ne.lng, ne.lat],
  ];
}

/** Fill + outline + centroid label layers for the region source. */
export function buildRegionLayers(): LayerSpecification[] {
  const fill: LayerSpecification = {
    id: REGION_FILL_LAYER_ID,
    type: 'fill',
    source: REGION_SOURCE_ID,
    paint: {
      'fill-color': ['coalesce', ['get', 'color'], '#3b82f6'],
      'fill-opacity': 0.1,
    },
  };
  const line: LayerSpecification = {
    id: REGION_LINE_LAYER_ID,
    type: 'line',
    source: REGION_SOURCE_ID,
    paint: {
      'line-color': ['coalesce', ['get', 'color'], '#3b82f6'],
      'line-width': 1.5,
      'line-opacity': 0.7,
    },
  };
  const label: LayerSpecification = {
    id: REGION_LABEL_LAYER_ID,
    type: 'symbol',
    source: REGION_SOURCE_ID,
    layout: {
      'text-field': ['get', 'name'],
      'text-size': 13,
      'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
      'text-transform': 'uppercase',
      'text-letter-spacing': 0.08,
      'symbol-placement': 'point',
    },
    paint: {
      'text-color': '#ffffff',
      'text-halo-color': 'rgba(0,0,0,0.65)',
      'text-halo-width': 1.4,
      'text-opacity': 0.9,
    },
  };
  return [fill, line, label];
}
