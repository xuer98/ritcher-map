import { pixelToLngLat } from './crs';
import { categoryIconSpriteId } from '../icons';
import type { CatalogMarker } from '../api/maps';

export type MarkerFeatureProps = {
  id: number;
  categoryId: number;
  title: string | null;
  found: boolean;
  /**
   * MapLibre sprite id, present ONLY when the category's icon image is loaded
   * into the map. The symbol layer renders markers that have it; the circle
   * layer renders those that don't.
   */
  icon?: string;
};

/**
 * Convert the full catalog marker list into a MapLibre-ready FeatureCollection.
 * The source has clustering enabled, so MapLibre groups these points into
 * clusters per zoom; we just emit one point feature per marker. Pixel coords are
 * projected to lng/lat at maxZoom. `id` is stored in properties (not just
 * feature.id) because clustering reindexes feature ids — selection reads
 * properties.id.
 */
export function markersToGeoJSON(
  markers: CatalogMarker[],
  maxZoom: number,
  found: Set<number>,
  /** Categories whose icon sprite is loaded; their markers render as symbols. */
  iconCategoryIds?: ReadonlySet<number>,
): GeoJSON.FeatureCollection<GeoJSON.Point, MarkerFeatureProps> {
  const features: Array<GeoJSON.Feature<GeoJSON.Point, MarkerFeatureProps>> = [];

  for (const m of markers) {
    const { lng, lat } = pixelToLngLat(m.x, m.y, maxZoom);
    const props: MarkerFeatureProps = {
      id: m.id,
      categoryId: m.categoryId,
      title: m.title,
      found: found.has(m.id),
    };
    if (iconCategoryIds?.has(m.categoryId)) {
      props.icon = categoryIconSpriteId(m.categoryId);
    }
    features.push({
      type: 'Feature',
      id: m.id,
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: props,
    });
  }

  return { type: 'FeatureCollection', features };
}
