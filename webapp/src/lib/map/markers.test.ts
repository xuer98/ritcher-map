import { describe, it, expect } from 'vitest';
import { markersToGeoJSON } from './markers';
import type { CatalogMarker } from '../api/maps';

const markers: CatalogMarker[] = [
  { id: 10, mapId: 1, categoryId: 5, x: 100, y: 120, title: 'A', description: null },
  { id: 11, mapId: 1, categoryId: 6, x: 200, y: 220, title: 'B', description: null },
];

const MAX_ZOOM = 8;

describe('markersToGeoJSON icon tagging', () => {
  it('tags only markers whose category has a loaded icon sprite', () => {
    const fc = markersToGeoJSON(markers, MAX_ZOOM, new Set(), new Set([5]));
    const byId = new Map(fc.features.map((f) => [f.properties.id, f.properties]));
    expect(byId.get(10)?.icon).toBe('rm-cat-5');
    // category 6 has no loaded sprite -> stays a circle (no icon prop)
    expect(byId.get(11)?.icon).toBeUndefined();
  });

  it('tags nothing when no icon categories are supplied', () => {
    const fc = markersToGeoJSON(markers, MAX_ZOOM, new Set());
    for (const f of fc.features) {
      expect(f.properties.icon).toBeUndefined();
    }
  });

  it('preserves found state independently of icon tagging', () => {
    const fc = markersToGeoJSON(markers, MAX_ZOOM, new Set([10]), new Set([5, 6]));
    const byId = new Map(fc.features.map((f) => [f.properties.id, f.properties]));
    expect(byId.get(10)?.found).toBe(true);
    expect(byId.get(10)?.icon).toBe('rm-cat-5');
    expect(byId.get(11)?.found).toBe(false);
    expect(byId.get(11)?.icon).toBe('rm-cat-6');
  });

  it('stores the marker id in both feature.id and properties.id', () => {
    const fc = markersToGeoJSON(markers, MAX_ZOOM, new Set());
    expect(fc.features[0].id).toBe(10);
    expect(fc.features[0].properties.id).toBe(10);
  });
});
