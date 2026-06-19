"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import type {
  GeoJSONSource,
  MapGeoJSONFeature,
  MapLayerMouseEvent,
  Map as MapLibreMap,
  StyleSpecification,
} from "maplibre-gl";

import { tileTemplateUrl } from "../api/client";
import { TILE_SIZE } from "../config";
import { categoryIconSpriteId } from "../icons";
import type { MapResponse, RegionResponse, ViewportResponse } from "../types";
import { imageBounds, lngLatToPixel, pixelToLngLat } from "./crs";
import {
  buildLayers,
  CLUSTER_LAYER_ID,
  MARKER_LAYER_ID,
  MARKER_SOURCE_ID,
  MARKER_SYMBOL_LAYER_ID,
} from "./layers";
import { viewportToGeoJSON, type AnyProps } from "./markers";
import {
  buildRegionLayers,
  REGION_FILL_LAYER_ID,
  REGION_LAYER_IDS,
  REGION_SOURCE_ID,
  regionBounds,
  regionsToGeoJSON,
} from "./regions";
import {
  buildDraftLayers,
  DRAFT_LAYER_IDS,
  DRAFT_SOURCE_ID,
  draftToGeoJSON,
} from "./regionDraft";
import { useViewportMarkers } from "./useViewportMarkers";

export interface MapViewProps {
  meta: MapResponse;
  categories: number[] | null;
  found: Set<number>;
  /** Hide found markers from the map entirely (not just restyle them). */
  hideFound?: boolean;
  onMarkerClick: (markerId: number) => void;
  /** Pixel-space point to fly the camera to; bump `key` to retrigger. */
  focus?: { x: number; y: number; key: number } | null;
  /**
   * Click on the bare map (not on a marker), in pixel space. Admin console
   * uses this for click-to-place marker authoring.
   */
  onMapClick?: (point: { x: number; y: number }) => void;
  /** Bump to force a viewport-marker refetch (after authoring mutations). */
  markersVersion?: number;
  /**
   * categoryId -> resolved icon URL. Markers in these categories render as the
   * icon image once it loads; everything else stays a colored circle.
   */
  categoryIcons?: ReadonlyMap<number, string>;
  /** Named polygonal areas drawn beneath the markers; clicking one fits its bounds. */
  regions?: RegionResponse[];
  /** Region to fit the camera to (e.g. from a sidebar list); bump `key` to retrigger. */
  regionFocus?: { id: number; key: number } | null;
  /**
   * Polygon-drawing mode (admin region authoring). While true, every map click is
   * reported via `onMapClick` as a pixel-space vertex — marker and region click
   * handlers are suppressed.
   */
  drawing?: boolean;
  /**
   * In-progress region polygon as pixel-space vertices, rendered on top of
   * everything. `null` removes the draft overlay; `[]` shows an (empty) draft.
   */
  draftPolygon?: [number, number][] | null;
}

/** Both marker layers are clickable / hoverable. */
const MARKER_INTERACTIVE_LAYERS = [MARKER_LAYER_ID, MARKER_SYMBOL_LAYER_ID];

/** Longest icon edge (px) markers render at; sprites are scaled to this. */
const ICON_TARGET_PX = 28;
/** Rasterize sprites at 2x for crispness on hi-dpi screens. */
const ICON_PIXEL_RATIO = 2;

/**
 * Load an image URL into a square canvas and return ImageData for
 * `map.addImage`. Uses an <img> + canvas (not `map.loadImage`, whose
 * createImageBitmap path can't decode SVG) so both SVG and raster icons work;
 * the icon is drawn as-is — fit, centered — with no disc or tint behind it.
 * `crossOrigin` is set for remote URLs so the canvas can be read back (the host
 * must send GET CORS headers); blob: URLs are same-origin and never taint.
 */
function drawIconToImageData(
  url: string,
  crossOrigin: boolean
): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = "anonymous";
    img.onload = () => {
      const size = ICON_TARGET_PX * ICON_PIXEL_RATIO;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no 2d context"));

      const iw = img.naturalWidth || size;
      const ih = img.naturalHeight || size;
      const scale = Math.min(size / iw, size / ih);
      const w = iw * scale;
      const h = ih * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      try {
        resolve(ctx.getImageData(0, 0, size, size));
      } catch (e) {
        reject(e instanceof Error ? e : new Error("icon canvas tainted"));
      }
    };
    img.onerror = () => reject(new Error("icon load failed"));
    img.src = url;
  });
}

/**
 * Fetch an icon's bytes and rasterize via a same-origin blob URL. Fixes two
 * things the direct-<img> path can't: (1) hosts (e.g. R2 by default) that serve
 * an `.svg` as `application/octet-stream`, which <img> refuses to decode — we
 * sniff the bytes and relabel it `image/svg+xml`; (2) SVG-on-canvas tainting in
 * some browsers (Safari), since a blob: URL is same-origin. The fetch still
 * needs the host to allow CORS — the same requirement as reading pixels back.
 */
async function rasterizeViaBlob(url: string): Promise<ImageData> {
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error(`icon fetch ${res.status}`);
  let blob = await res.blob();
  if (!blob.type.startsWith("image/")) {
    const buf = await blob.arrayBuffer();
    const head = new TextDecoder().decode(buf.slice(0, 256)).trimStart();
    const isSvg = head.startsWith("<?xml") || head.includes("<svg");
    blob = new Blob([buf], { type: isSvg ? "image/svg+xml" : blob.type });
  }
  const objUrl = URL.createObjectURL(blob);
  try {
    return await drawIconToImageData(objUrl, false);
  } finally {
    URL.revokeObjectURL(objUrl);
  }
}

/**
 * Rasterize an icon URL to ImageData. Tries a direct <img> first (fast path for
 * same-origin built-ins and CORS-clean hosts); on failure (load error — e.g. an
 * SVG mislabeled as octet-stream — or canvas taint) retries by fetching the
 * bytes into a same-origin blob. Both paths need the remote host to allow CORS.
 */
function rasterizeIcon(url: string): Promise<ImageData> {
  return drawIconToImageData(url, true).catch((err) => {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[rm-map] icon <img> load failed, retrying via fetch:", url, err);
    }
    return rasterizeViaBlob(url);
  });
}

const EMPTY_FC: GeoJSON.FeatureCollection<GeoJSON.Point, AnyProps> = {
  type: "FeatureCollection",
  features: [],
};

// An empty markers response so viewportToGeoJSON (which requires a
// ViewportResponse) can be called uniformly before the first fetch resolves.
const EMPTY_RESPONSE: ViewportResponse = {
  kind: "markers",
  markers: [],
  map_id: 0,
  zoom: 0,
  total: 0,
  clustered: false,
};

/** [[swLng,swLat],[neLng,neLat]] -> [minLng,minLat,maxLng,maxLat] for raster source bounds. */
function flattenBounds(
  b: [[number, number], [number, number]]
): [number, number, number, number] {
  return [b[0][0], b[0][1], b[1][0], b[1][1]];
}

function isReady(meta: MapResponse): boolean {
  return (
    meta.status === "READY" &&
    meta.width !== null &&
    meta.height !== null &&
    meta.maxZoom !== null
  );
}

function buildStyle(meta: MapResponse): StyleSpecification {
  const width = meta.width ?? 256;
  const height = meta.height ?? 256;
  const maxZoom = meta.maxZoom ?? 0;
  const bounds = flattenBounds(imageBounds(width, height, maxZoom));

  return {
    version: 8,
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: {
      "rm-raster": {
        type: "raster",
        tiles: [tileTemplateUrl(meta.prefix, meta.format)],
        tileSize: TILE_SIZE,
        scheme: "xyz",
        minzoom: meta.minZoom ?? 0,
        maxzoom: maxZoom,
        bounds,
      },
      [MARKER_SOURCE_ID]: {
        type: "geojson",
        data: EMPTY_FC,
      },
    },
    layers: [
      {
        id: "rm-background",
        type: "background",
        paint: { "background-color": "#0b0d10" },
      },
      {
        id: "rm-raster-layer",
        type: "raster",
        source: "rm-raster",
        paint: { "raster-fade-duration": 150 },
      },
      ...buildLayers(),
    ],
  };
}

export const MapView: React.FC<MapViewProps> = ({
  meta,
  categories,
  found,
  hideFound = false,
  onMarkerClick,
  focus = null,
  onMapClick,
  markersVersion = 0,
  categoryIcons,
  regions,
  regionFocus = null,
  drawing = false,
  draftPolygon = null,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  // Re-render once the map instance exists so the viewport hook receives it.
  const [mapInstance, setMapInstance] = useState<MapLibreMap | null>(null);

  // Per-map-instance icon state: which category sprites are loaded (so we can
  // tag markers as symbols) and which are mid-load (de-dupes loadImage calls).
  const loadedIconCats = useRef<Set<number>>(new Set());
  const loadingIcons = useRef<Set<string>>(new Set());
  // Bumped when a sprite finishes loading, to re-tag/redraw the marker source.
  const [iconsVersion, setIconsVersion] = useState(0);

  // Keep the latest callbacks without re-binding the click handlers.
  const onClickRef = useRef(onMarkerClick);
  onClickRef.current = onMarkerClick;
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;
  // Latest regions for the once-bound region click handler to read.
  const regionsRef = useRef<RegionResponse[]>(regions ?? []);
  regionsRef.current = regions ?? [];
  // Latest drawing flag for the once-bound click handlers to read.
  const drawingRef = useRef(drawing);
  drawingRef.current = drawing;

  const ready = isReady(meta);

  // Create the map exactly once per (meta.id, ready); switching maps rebuilds it.
  useEffect(() => {
    if (!containerRef.current || !ready) return;

    const width = meta.width ?? 256;
    const height = meta.height ?? 256;
    const maxZoom = meta.maxZoom ?? 0;
    const bounds = imageBounds(width, height, maxZoom);

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildStyle(meta),
      maxBounds: bounds,
      bounds,
      minZoom: meta.minZoom ?? 0,
      maxZoom,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({}), "top-right");
    mapRef.current = map;
    setMapInstance(map);
    if (process.env.NODE_ENV !== "production") {
      // Dev-only debugging handle (e.g. __rmMap.getStyle() in the console).
      const w = window as unknown as {
        __rmMap?: unknown;
        __rmMapErrors?: string[];
      };
      w.__rmMap = map;
      w.__rmMapErrors = w.__rmMapErrors ?? [];
      map.on("error", (e) => {
        w.__rmMapErrors?.push(String(e.error?.message ?? e.error ?? "unknown"));
        console.error("[rm-map error]", e.error?.message);
      });
    }

    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
    });

    const onClick = (e: MapLayerMouseEvent): void => {
      if (drawingRef.current) return; // every click is a draft vertex
      const feature = e.features?.[0];
      if (!feature) return;
      const id =
        feature.id !== undefined && feature.id !== null
          ? Number(feature.id)
          : Number((feature.properties as { id?: number }).id);
      if (Number.isNaN(id)) return;
      onClickRef.current(id);
    };

    const onEnter = (e: MapLayerMouseEvent): void => {
      map.getCanvas().style.cursor = "pointer";
      const feature = e.features?.[0] as MapGeoJSONFeature | undefined;
      const title = feature?.properties?.title as string | null | undefined;
      if (title) {
        popup.setLngLat(e.lngLat).setText(title).addTo(map);
      }
    };

    const onLeave = (): void => {
      map.getCanvas().style.cursor = "";
      popup.remove();
    };

    // Background clicks (not on a marker) report pixel-space coordinates.
    // The marker layer's own click handler still fires for marker hits; the
    // queryRenderedFeatures guard keeps this one from double-reporting them.
    const onBgClick = (e: MapLayerMouseEvent): void => {
      if (!onMapClickRef.current) return;
      // While drawing, every click is a polygon vertex — skip the marker/region
      // hit guard so clicks landing on an existing overlay still add a point.
      if (drawingRef.current) {
        const px = lngLatToPixel(e.lngLat.lng, e.lngLat.lat, maxZoom);
        onMapClickRef.current({ x: px.x, y: px.y });
        return;
      }
      // queryRenderedFeatures THROWS for a layer the style hasn't loaded yet,
      // and clicks can land before 'load' — query only layers that exist and
      // treat the rest as "no marker hit".
      const guard = [...MARKER_INTERACTIVE_LAYERS, REGION_FILL_LAYER_ID];
      const present = guard.filter((l) => map.getLayer(l));
      const hits = present.length
        ? map.queryRenderedFeatures(e.point, { layers: present })
        : [];
      if (hits.length > 0) return;
      const px = lngLatToPixel(e.lngLat.lng, e.lngLat.lat, maxZoom);
      onMapClickRef.current({ x: px.x, y: px.y });
    };

    // Clicking a region fits the camera to its bounds. Read the latest regions
    // via ref since this handler is bound once for the map's lifetime.
    const onRegionClick = (e: MapLayerMouseEvent): void => {
      if (drawingRef.current) return; // clicks build the draft, not navigate
      const f = e.features?.[0];
      if (!f) return;
      const id =
        f.id !== undefined && f.id !== null
          ? Number(f.id)
          : Number((f.properties as { id?: number }).id);
      const region = regionsRef.current.find((r) => r.id === id);
      if (!region) return;
      map.fitBounds(regionBounds(region, maxZoom), { padding: 48, maxZoom });
    };
    const onRegionEnter = (): void => {
      map.getCanvas().style.cursor = "pointer";
    };
    const onRegionLeave = (): void => {
      map.getCanvas().style.cursor = "";
    };

    for (const layer of MARKER_INTERACTIVE_LAYERS) {
      map.on("click", layer, onClick);
      map.on("mouseenter", layer, onEnter);
      map.on("mouseleave", layer, onLeave);
    }
    map.on("click", REGION_FILL_LAYER_ID, onRegionClick);
    map.on("mouseenter", REGION_FILL_LAYER_ID, onRegionEnter);
    map.on("mouseleave", REGION_FILL_LAYER_ID, onRegionLeave);
    map.on("click", onBgClick);

    return () => {
      map.off("click", onBgClick);
      map.off("click", REGION_FILL_LAYER_ID, onRegionClick);
      map.off("mouseenter", REGION_FILL_LAYER_ID, onRegionEnter);
      map.off("mouseleave", REGION_FILL_LAYER_ID, onRegionLeave);
      for (const layer of MARKER_INTERACTIVE_LAYERS) {
        map.off("click", layer, onClick);
        map.off("mouseenter", layer, onEnter);
        map.off("mouseleave", layer, onLeave);
      }
      popup.remove();
      mapRef.current = null;
      setMapInstance(null);
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.id, ready]);

  const vp = useViewportMarkers(
    mapInstance,
    ready ? meta.id : null,
    meta.maxZoom,
    categories,
    markersVersion
  );

  // Sprites live on a specific map instance; drop the loaded-set when the map
  // is (re)created so we don't tag markers with sprites the new map lacks.
  useEffect(() => {
    loadedIconCats.current = new Set();
    loadingIcons.current = new Set();
    setIconsVersion(0);
  }, [mapInstance]);

  // Load each category's icon image into the map as a named sprite. On success
  // we record the category and bump iconsVersion so the apply effect re-tags
  // those markers as symbols; failures (404/CORS) leave them as circles.
  useEffect(() => {
    const map = mapInstance;
    if (!map || !categoryIcons || categoryIcons.size === 0) return;
    let cancelled = false;

    const loadAll = (): void => {
      for (const [catId, url] of categoryIcons) {
        const spriteId = categoryIconSpriteId(catId);
        if (map.hasImage(spriteId) || loadingIcons.current.has(spriteId))
          continue;
        loadingIcons.current.add(spriteId);
        // Rasterize via <img>+canvas rather than map.loadImage: that path uses
        // createImageBitmap, which can't decode SVG (our built-in icons). This
        // handles SVG and raster uniformly, normalized to a square sprite, drawn
        // as-is (no disc/tint behind the glyph).
        rasterizeIcon(url)
          .then((data) => {
            loadingIcons.current.delete(spriteId);
            if (cancelled || map.hasImage(spriteId)) return;
            map.addImage(spriteId, data, { pixelRatio: ICON_PIXEL_RATIO });
            loadedIconCats.current.add(catId);
            setIconsVersion((v) => v + 1);
          })
          .catch((err) => {
            loadingIcons.current.delete(spriteId);
            if (process.env.NODE_ENV !== "production") {
              console.warn(
                `[rm-map] category ${catId} icon failed (falls back to circle):`,
                url,
                err,
              );
            }
          });
      }
    };

    if (map.isStyleLoaded()) loadAll();
    else map.once("load", loadAll);

    return () => {
      cancelled = true;
      map.off("load", loadAll);
    };
  }, [mapInstance, categoryIcons]);

  // Push viewport response + found state into the GeoJSON source.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = (): void => {
      const src = map.getSource(MARKER_SOURCE_ID) as GeoJSONSource | undefined;
      if (!src) return;
      const fc = viewportToGeoJSON(
        vp.response ?? EMPTY_RESPONSE,
        meta.maxZoom ?? 0,
        found,
        loadedIconCats.current
      );
      src.setData(
        hideFound
          ? {
              ...fc,
              features: fc.features.filter(
                (f) => !(f.properties.kind === "marker" && f.properties.found)
              ),
            }
          : fc
      );
    };

    if (map.isStyleLoaded()) {
      apply();
    } else {
      // `load` fires once and may already have fired by the time this effect
      // re-runs; `idle` re-fires whenever sources/tiles settle, so it reliably
      // catches a post-load run where isStyleLoaded() is transiently false.
      map.once("load", apply);
      map.once("idle", apply);
    }

    return () => {
      map.off("load", apply);
      map.off("idle", apply);
    };
  }, [vp.response, found, hideFound, meta.maxZoom, iconsVersion]);

  // Fly to a requested marker (search hit / external selection).
  useEffect(() => {
    if (!mapInstance || !focus || meta.maxZoom === null) return;
    const ll = pixelToLngLat(focus.x, focus.y, meta.maxZoom);
    mapInstance.flyTo({
      center: [ll.lng, ll.lat],
      zoom: Math.max(mapInstance.getZoom(), meta.maxZoom - 1),
    });
  }, [mapInstance, focus, meta.maxZoom]);

  // Region overlays: (re)build the source + layers with the current data. We
  // create the geojson source WITH its data (rather than an empty source then
  // setData) because the latter doesn't reliably render in this pixel CRS.
  // Regions are static + low-cardinality, so a full rebuild on change is cheap.
  useEffect(() => {
    const map = mapInstance;
    if (!map) return;

    const apply = (): void => {
      for (const id of REGION_LAYER_IDS) {
        if (map.getLayer(id)) map.removeLayer(id);
      }
      if (map.getSource(REGION_SOURCE_ID)) map.removeSource(REGION_SOURCE_ID);
      map.addSource(REGION_SOURCE_ID, {
        type: "geojson",
        data: regionsToGeoJSON(regions ?? [], meta.maxZoom ?? 0),
      });
      // Insert beneath the cluster/marker layers so markers stay on top.
      const before = map.getLayer(CLUSTER_LAYER_ID) ? CLUSTER_LAYER_ID : undefined;
      for (const layer of buildRegionLayers()) map.addLayer(layer, before);
    };

    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
    return () => {
      map.off("load", apply);
    };
  }, [mapInstance, regions, meta.maxZoom]);

  // Fit the camera to a region requested externally (e.g. the sidebar list).
  useEffect(() => {
    if (!mapInstance || !regionFocus) return;
    const region = (regions ?? []).find((r) => r.id === regionFocus.id);
    if (!region) return;
    mapInstance.fitBounds(regionBounds(region, meta.maxZoom ?? 0), {
      padding: 48,
      maxZoom: meta.maxZoom ?? undefined,
    });
  }, [mapInstance, regionFocus, regions, meta.maxZoom]);

  // Draft-polygon overlay (admin region authoring): rebuild source + layers on
  // top of everything as vertices change. `null` => no draft; remove it.
  useEffect(() => {
    const map = mapInstance;
    if (!map) return;

    const apply = (): void => {
      for (const id of DRAFT_LAYER_IDS) {
        if (map.getLayer(id)) map.removeLayer(id);
      }
      if (map.getSource(DRAFT_SOURCE_ID)) map.removeSource(DRAFT_SOURCE_ID);
      if (!draftPolygon) return;
      map.addSource(DRAFT_SOURCE_ID, {
        type: "geojson",
        data: draftToGeoJSON(draftPolygon, meta.maxZoom ?? 0),
      });
      for (const layer of buildDraftLayers()) map.addLayer(layer); // on top
    };

    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
    return () => {
      map.off("load", apply);
    };
  }, [mapInstance, draftPolygon, meta.maxZoom]);

  return (
    <div className="relative h-full w-full">
      {/* h-full/w-full (not absolute inset-0): MapLibre's unlayered
          `.maplibregl-map { position: relative }` overrides Tailwind's layered
          `.absolute`, so inset-0 wouldn't stretch the container. */}
      <div ref={containerRef} className="h-full w-full" />
      {!ready && (
        <div className="absolute inset-0 z-5 flex items-center justify-center bg-bg/70 text-fg-dim text-[15px] pointer-events-none">
          Map not ready yet (status: {meta.status})
        </div>
      )}
      {vp.error && ready && (
        <div className="absolute left-1/2 bottom-4.5 -translate-x-1/2 z-6 bg-[rgba(40,12,12,0.92)] border border-danger/50 text-[#ffb4b4] text-[13px] px-3 py-2 rounded-lg">
          Markers failed: {vp.error}
        </div>
      )}
    </div>
  );
};

// Default export so next/dynamic can import this module without a resolver.
export default MapView;
