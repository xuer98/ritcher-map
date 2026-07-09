"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import type {
  GeoJSONSource,
  MapGeoJSONFeature,
  MapLayerMouseEvent,
  MapMouseEvent,
  Map as MapLibreMap,
  StyleSpecification,
} from "maplibre-gl";

import { tileTemplateUrl } from "../api/client";
import type { CatalogMarker } from "../api/maps";
import { TILE_SIZE } from "../config";
import { categoryIconSpriteId } from "../icons";
import type { MapResponse, RegionResponse } from "../types";
import { imageBounds, lngLatToPixel, pixelToLngLat } from "./crs";
import {
  buildLayers,
  CLUSTER_LAYER_ID,
  MARKER_LAYER_ID,
  MARKER_LAYER_IDS,
  MARKER_SOURCE_ID,
  MARKER_SYMBOL_LAYER_ID,
} from "./layers";
import { markersToGeoJSON, type MarkerFeatureProps } from "./markers";
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
import {
  buildCustomMarkerLayers,
  CUSTOM_MARKER_LAYER_ID,
  CUSTOM_MARKER_LAYER_IDS,
  CUSTOM_MARKER_SOURCE_ID,
  customMarkersToGeoJSON,
} from "./customMarkers";
import type { CustomMarker } from "../api/customMarkers";

export interface MapViewProps {
  meta: MapResponse;
  /** Every marker on the map; rendered client-side with MapLibre clustering. */
  markers: CatalogMarker[];
  /**
   * Visible category ids, or null for "all". Markers are filtered to these
   * before clustering; an empty array shows none.
   */
  categories: number[] | null;
  found: Set<number>;
  /** Hide found markers from the map entirely (not just restyle them). */
  hideFound?: boolean;
  onMarkerClick: (markerId: number) => void;
  /**
   * Ctrl+click (Windows/Linux) or Cmd+click (macOS — where Ctrl+click is a
   * right-click) a marker to toggle its found state in place, without opening
   * the detail panel. Opt-in: when omitted, a modified click just selects like
   * a normal click. The player view wires this to discovery progress.
   */
  onMarkerToggleFound?: (markerId: number) => void;
  /** Pixel-space point to fly the camera to; bump `key` to retrigger. */
  focus?: { x: number; y: number; key: number } | null;
  /**
   * Click on the bare map (not on a marker), in pixel space. Admin console
   * uses this for click-to-place marker authoring.
   */
  onMapClick?: (point: { x: number; y: number }) => void;
  /**
   * Dragging a marker pin reports its new pixel-space position on release.
   * Opt-in: when omitted (the player view) markers are not draggable. A plain
   * click is distinguished from a drag by a small movement threshold, so it
   * still fires `onMarkerClick`.
   */
  onMarkerDragEnd?: (markerId: number, point: { x: number; y: number }) => void;
  /**
   * Fires once per map instance at MapLibre's `load` — the first visually
   * complete render (style + the initial viewport's tiles). Re-fires for the
   * new map when `meta.id` changes (the map is rebuilt). The player view uses
   * it to dismiss its loading overlay.
   */
  onTilesLoaded?: () => void;
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
  /**
   * The signed-in user's custom markers (already filtered to the visible ones).
   * Rendered as a distinct layer above the catalog markers.
   */
  customMarkers?: CustomMarker[];
  /** Click a custom marker — opens its editor. Ids are UUID strings. */
  onCustomMarkerClick?: (id: string) => void;
  /** Drag a custom marker; reports its new pixel-space position on release. */
  onCustomMarkerDragEnd?: (id: string, point: { x: number; y: number }) => void;
  /**
   * Placement mode: the next bare-map click reports a point via `onMapClick`
   * (the player "add custom marker" flow). Shows a crosshair cursor while on.
   */
  placing?: boolean;
}

/** Both marker layers are clickable / hoverable. */
const MARKER_INTERACTIVE_LAYERS = [MARKER_LAYER_ID, MARKER_SYMBOL_LAYER_ID];

/** Longest icon edge (px) markers render at; sprites are scaled to this. */
const ICON_TARGET_PX = 36;
/** Rasterize sprites at 2x for crispness on hi-dpi screens. */
const ICON_PIXEL_RATIO = 2;

/**
 * Min height:width ratio for an icon to count as a teardrop "pin" whose bottom
 * tip marks the location (anchored at 'bottom'). MapGenie-style pins are 66×88
 * (≈1.33); square game-icons glyphs are 1.0, so a 1.2 cutoff cleanly splits them.
 */
const PIN_ASPECT_MIN = 1.2;

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
): Promise<{ data: ImageData; pin: boolean }> {
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
      const pin = ih >= iw * PIN_ASPECT_MIN;
      try {
        resolve({ data: ctx.getImageData(0, 0, size, size), pin });
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
async function rasterizeViaBlob(
  url: string
): Promise<{ data: ImageData; pin: boolean }> {
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
function rasterizeIcon(
  url: string
): Promise<{ data: ImageData; pin: boolean }> {
  return drawIconToImageData(url, true).catch((err) => {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[rm-map] icon <img> load failed, retrying via fetch:", url, err);
    }
    return rasterizeViaBlob(url);
  });
}

const EMPTY_FC: GeoJSON.FeatureCollection<GeoJSON.Point, MarkerFeatureProps> = {
  type: "FeatureCollection",
  features: [],
};

/** [[swLng,swLat],[neLng,neLat]] -> [minLng,minLat,maxLng,maxLat] for raster source bounds. */
function flattenBounds(
  b: [[number, number], [number, number]]
): [number, number, number, number] {
  return [b[0][0], b[0][1], b[1][0], b[1][1]];
}

/**
 * Camera options for flying to a region's bounds. `linear: true` uses easeTo
 * instead of the default flyTo — in this near-pole pixel CRS flyTo zooms out
 * past the target and back, which reads as the camera "flying all over" before
 * settling; easeTo interpolates straight to the fit. `maxZoom` is per-map so a
 * region never zooms past the native max.
 */
function regionFitOptions(maxZoom: number | undefined) {
  return { padding: 48, maxZoom, linear: true, duration: 600 };
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
        // Non-clustered: every marker renders individually. MapLibre's GeoJSON
        // clustering is deliberately disabled because supercluster mis-tiles our
        // pixel CRS (markers project into the extreme NW corner of Web Mercator);
        // see the `shouldCluster` note in the marker effect below.
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
  markers,
  categories,
  found,
  hideFound = false,
  onMarkerClick,
  onMarkerToggleFound,
  focus = null,
  onMapClick,
  onMarkerDragEnd,
  onTilesLoaded,
  categoryIcons,
  regions,
  regionFocus = null,
  drawing = false,
  draftPolygon = null,
  customMarkers,
  onCustomMarkerClick,
  onCustomMarkerDragEnd,
  placing = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  // Re-render once the map instance exists so the viewport hook receives it.
  const [mapInstance, setMapInstance] = useState<MapLibreMap | null>(null);

  // Per-map-instance icon state: which category sprites are loaded (so we can
  // tag markers as symbols) and which are mid-load (de-dupes loadImage calls).
  const loadedIconCats = useRef<Set<number>>(new Set());
  // Subset of loadedIconCats whose icon is a pin (bottom-anchored on the map).
  const pinIconCats = useRef<Set<number>>(new Set());
  const loadingIcons = useRef<Set<string>>(new Set());
  // Whether the marker source is currently clustered. The style builds it
  // non-clustered; the marker effect recreates it clustered past the threshold.
  const clusteredRef = useRef(false);
  // Bumped when a sprite finishes loading, to re-tag/redraw the marker source.
  const [iconsVersion, setIconsVersion] = useState(0);

  // Keep the latest callbacks without re-binding the click handlers.
  const onClickRef = useRef(onMarkerClick);
  onClickRef.current = onMarkerClick;
  const onToggleFoundRef = useRef(onMarkerToggleFound);
  onToggleFoundRef.current = onMarkerToggleFound;
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;
  const onMarkerDragEndRef = useRef(onMarkerDragEnd);
  onMarkerDragEndRef.current = onMarkerDragEnd;
  const onTilesLoadedRef = useRef(onTilesLoaded);
  onTilesLoadedRef.current = onTilesLoaded;
  // Latest rendered marker FeatureCollection, so the once-bound drag handler can
  // move a single feature in place without rebuilding it from the prop.
  const markerFcRef =
    useRef<GeoJSON.FeatureCollection<GeoJSON.Point, MarkerFeatureProps>>(
      EMPTY_FC
    );
  // Latest regions for the once-bound region click handler to read.
  const regionsRef = useRef<RegionResponse[]>(regions ?? []);
  regionsRef.current = regions ?? [];
  // Custom-marker callbacks + the latest rendered FeatureCollection, so the
  // once-bound click/drag handlers stay current without rebinding.
  const onCustomClickRef = useRef(onCustomMarkerClick);
  onCustomClickRef.current = onCustomMarkerClick;
  const onCustomDragEndRef = useRef(onCustomMarkerDragEnd);
  onCustomDragEndRef.current = onCustomMarkerDragEnd;
  const customFcRef = useRef<GeoJSON.FeatureCollection<GeoJSON.Point>>({
    type: "FeatureCollection",
    features: [],
  });
  // Latest drawing flag for the once-bound click handlers to read.
  const drawingRef = useRef(drawing);
  drawingRef.current = drawing;
  // Latest placing flag, so hover/drag handlers restore the crosshair (not the
  // default cursor) when they reset while placement mode is armed.
  const placingRef = useRef(placing);
  placingRef.current = placing;

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
    // Registered synchronously at construction, so `load` cannot already have
    // fired — the once-handler race this file guards against elsewhere only
    // affects handlers registered later, from re-running effects.
    map.once("load", () => onTilesLoadedRef.current?.());
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
      // Read properties.id, not feature.id: clustering reindexes feature ids,
      // so the original marker id only survives in our own property.
      const propId = (feature.properties as { id?: number }).id;
      const id =
        propId !== undefined && propId !== null
          ? Number(propId)
          : Number(feature.id);
      if (Number.isNaN(id)) return;
      // Ctrl/Cmd+click toggles found in place instead of opening the detail
      // panel (a quick "mark as found" without the round-trip through the popup).
      const oe = e.originalEvent;
      if ((oe.ctrlKey || oe.metaKey) && onToggleFoundRef.current) {
        onToggleFoundRef.current(id);
        return;
      }
      onClickRef.current(id);
    };

    // Clicking a cluster zooms in until it breaks apart (supercluster's
    // expansion zoom). The marker layers' own click handler still fires for
    // unclustered markers; this only covers the cluster circle.
    const onClusterClick = (e: MapLayerMouseEvent): void => {
      if (drawingRef.current) return;
      const feature = e.features?.[0];
      const clusterId = (feature?.properties as { cluster_id?: number })
        ?.cluster_id;
      const src = map.getSource(MARKER_SOURCE_ID) as GeoJSONSource | undefined;
      if (clusterId === undefined || !src) return;
      src
        .getClusterExpansionZoom(clusterId)
        .then((zoom) => {
          const coords = (feature!.geometry as GeoJSON.Point).coordinates;
          map.easeTo({ center: [coords[0], coords[1]], zoom });
        })
        .catch(() => {});
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
      map.getCanvas().style.cursor = placingRef.current ? "crosshair" : "";
      popup.remove();
    };

    // --- marker dragging (admin authoring) ---------------------------------
    // Press a marker and drag to reposition it; the new pixel coords are
    // reported on release via onMarkerDragEnd. Enabled only when that callback
    // is set. A movement threshold separates a drag from a plain click, so
    // clicking a marker still selects it (onMarkerClick) rather than "moving"
    // it onto itself. preventDefault() on mousedown stops the map from panning.
    let dragId: number | null = null;
    let dragMoved = false;
    let dragStart: { x: number; y: number } | null = null;

    const onDragMove = (e: MapMouseEvent): void => {
      if (dragId === null) return;
      if (
        !dragMoved &&
        dragStart &&
        Math.hypot(e.point.x - dragStart.x, e.point.y - dragStart.y) < 3
      ) {
        return; // below threshold — still a click, not a drag yet
      }
      dragMoved = true;
      map.getCanvas().style.cursor = "grabbing";
      popup.remove();
      const feat = markerFcRef.current.features.find(
        (f) => (f.properties as { id?: number }).id === dragId
      );
      if (feat) {
        feat.geometry.coordinates = [e.lngLat.lng, e.lngLat.lat];
        const src = map.getSource(MARKER_SOURCE_ID) as GeoJSONSource | undefined;
        src?.setData(markerFcRef.current);
      }
    };

    const onDragUp = (e: MapMouseEvent): void => {
      map.off("mousemove", onDragMove);
      const id = dragId;
      const moved = dragMoved;
      dragId = null;
      dragMoved = false;
      dragStart = null;
      map.getCanvas().style.cursor = placingRef.current ? "crosshair" : "";
      if (id !== null && moved && onMarkerDragEndRef.current) {
        const px = lngLatToPixel(e.lngLat.lng, e.lngLat.lat, maxZoom);
        onMarkerDragEndRef.current(id, { x: px.x, y: px.y });
      }
    };

    const onMarkerDown = (e: MapLayerMouseEvent): void => {
      if (!onMarkerDragEndRef.current || drawingRef.current) return;
      const feature = e.features?.[0];
      if (!feature) return;
      const propId = (feature.properties as { id?: number }).id;
      const id =
        propId !== undefined && propId !== null
          ? Number(propId)
          : Number(feature.id);
      if (Number.isNaN(id)) return;
      e.preventDefault(); // suppress the default drag-pan for this gesture
      dragId = id;
      dragMoved = false;
      dragStart = { x: e.point.x, y: e.point.y };
      map.on("mousemove", onDragMove);
      map.once("mouseup", onDragUp);
    };

    // --- custom markers (player "My Markers") ------------------------------
    // Click selects (opens the editor); press-and-drag repositions. Ids are
    // UUID strings, read from properties.id (never Number()-coerced).
    const onCustomClick = (e: MapLayerMouseEvent): void => {
      if (drawingRef.current) return;
      const id = (e.features?.[0]?.properties as { id?: string } | undefined)?.id;
      if (typeof id === "string" && id.length > 0) onCustomClickRef.current?.(id);
    };

    let cDragId: string | null = null;
    let cDragMoved = false;
    let cDragStart: { x: number; y: number } | null = null;

    const onCustomDragMove = (e: MapMouseEvent): void => {
      if (cDragId === null) return;
      if (
        !cDragMoved &&
        cDragStart &&
        Math.hypot(e.point.x - cDragStart.x, e.point.y - cDragStart.y) < 3
      ) {
        return; // below threshold — still a click
      }
      cDragMoved = true;
      map.getCanvas().style.cursor = "grabbing";
      popup.remove();
      const feat = customFcRef.current.features.find(
        (f) => (f.properties as { id?: string }).id === cDragId
      );
      if (feat) {
        feat.geometry.coordinates = [e.lngLat.lng, e.lngLat.lat];
        const src = map.getSource(CUSTOM_MARKER_SOURCE_ID) as
          | GeoJSONSource
          | undefined;
        src?.setData(customFcRef.current);
      }
    };

    const onCustomDragUp = (e: MapMouseEvent): void => {
      map.off("mousemove", onCustomDragMove);
      const id = cDragId;
      const moved = cDragMoved;
      cDragId = null;
      cDragMoved = false;
      cDragStart = null;
      map.getCanvas().style.cursor = placingRef.current ? "crosshair" : "";
      if (id !== null && moved && onCustomDragEndRef.current) {
        const px = lngLatToPixel(e.lngLat.lng, e.lngLat.lat, maxZoom);
        onCustomDragEndRef.current(id, { x: px.x, y: px.y });
      }
    };

    const onCustomDown = (e: MapLayerMouseEvent): void => {
      if (!onCustomDragEndRef.current || drawingRef.current) return;
      const id = (e.features?.[0]?.properties as { id?: string } | undefined)?.id;
      if (typeof id !== "string" || id.length === 0) return;
      e.preventDefault();
      cDragId = id;
      cDragMoved = false;
      cDragStart = { x: e.point.x, y: e.point.y };
      map.on("mousemove", onCustomDragMove);
      map.once("mouseup", onCustomDragUp);
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
      const guard = [
        ...MARKER_INTERACTIVE_LAYERS,
        CLUSTER_LAYER_ID,
        REGION_FILL_LAYER_ID,
        CUSTOM_MARKER_LAYER_ID,
      ];
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
      map.fitBounds(regionBounds(region, maxZoom), regionFitOptions(maxZoom));
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
      map.on("mousedown", layer, onMarkerDown);
    }
    // Cluster circle: click zooms in; cursor turns to a pointer on hover.
    map.on("click", CLUSTER_LAYER_ID, onClusterClick);
    map.on("mouseenter", CLUSTER_LAYER_ID, onRegionEnter);
    map.on("mouseleave", CLUSTER_LAYER_ID, onRegionLeave);
    map.on("click", REGION_FILL_LAYER_ID, onRegionClick);
    map.on("mouseenter", REGION_FILL_LAYER_ID, onRegionEnter);
    map.on("mouseleave", REGION_FILL_LAYER_ID, onRegionLeave);
    // Custom markers (layer added lazily in its own effect; MapLibre delivers
    // these layer-scoped handlers once the layer exists).
    map.on("click", CUSTOM_MARKER_LAYER_ID, onCustomClick);
    map.on("mouseenter", CUSTOM_MARKER_LAYER_ID, onEnter);
    map.on("mouseleave", CUSTOM_MARKER_LAYER_ID, onLeave);
    map.on("mousedown", CUSTOM_MARKER_LAYER_ID, onCustomDown);
    map.on("click", onBgClick);

    return () => {
      map.off("click", onBgClick);
      map.off("click", CUSTOM_MARKER_LAYER_ID, onCustomClick);
      map.off("mouseenter", CUSTOM_MARKER_LAYER_ID, onEnter);
      map.off("mouseleave", CUSTOM_MARKER_LAYER_ID, onLeave);
      map.off("mousedown", CUSTOM_MARKER_LAYER_ID, onCustomDown);
      map.off("mousemove", onCustomDragMove); // in case teardown lands mid-drag
      map.off("click", REGION_FILL_LAYER_ID, onRegionClick);
      map.off("mouseenter", REGION_FILL_LAYER_ID, onRegionEnter);
      map.off("mouseleave", REGION_FILL_LAYER_ID, onRegionLeave);
      map.off("click", CLUSTER_LAYER_ID, onClusterClick);
      map.off("mouseenter", CLUSTER_LAYER_ID, onRegionEnter);
      map.off("mouseleave", CLUSTER_LAYER_ID, onRegionLeave);
      for (const layer of MARKER_INTERACTIVE_LAYERS) {
        map.off("click", layer, onClick);
        map.off("mouseenter", layer, onEnter);
        map.off("mouseleave", layer, onLeave);
        map.off("mousedown", layer, onMarkerDown);
      }
      map.off("mousemove", onDragMove); // in case teardown lands mid-drag
      popup.remove();
      mapRef.current = null;
      setMapInstance(null);
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.id, ready]);

  // Stable dependency key for the categories filter (the array identity churns
  // on every parent render, but its contents rarely change).
  const categoriesKey = categories ? categories.join(",") : "all";

  // Clustering is DISABLED. MapLibre's GeoJSON clustering (supercluster) runs in
  // geographic Web-Mercator space, but our pixel CRS projects every marker into a
  // tiny sliver at the extreme NW corner of Mercator (lng≈-180, lat≈85°).
  // Supercluster mis-tiles that degenerate region, so a clustered source renders
  // nothing at the fit-to-image zoom — which silently hid all ~1900 of Pharloom's
  // markers (the only map dense enough to cross the old cluster threshold).
  // Individual rendering is correct at every zoom; density is managed by category
  // filtering, not clustering. The cluster layers/handler below stay inert (no
  // feature ever carries point_count) so clustering can be restored if the CRS
  // ever changes to a non-degenerate projection.
  const shouldCluster = false;

  // Sprites live on a specific map instance; drop the loaded-set when the map
  // is (re)created so we don't tag markers with sprites the new map lacks.
  useEffect(() => {
    loadedIconCats.current = new Set();
    pinIconCats.current = new Set();
    loadingIcons.current = new Set();
    clusteredRef.current = false; // new map's style source is non-clustered
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
          .then(({ data, pin }) => {
            loadingIcons.current.delete(spriteId);
            if (cancelled || map.hasImage(spriteId)) return;
            map.addImage(spriteId, data, { pixelRatio: ICON_PIXEL_RATIO });
            loadedIconCats.current.add(catId);
            if (pin) pinIconCats.current.add(catId);
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

    // Gate on the style-shipped rm-markers source existing, not
    // isStyleLoaded(): isStyleLoaded() flaps false transiently (sprite/glyph/
    // tile churn) after `load` has fired, and a settled map schedules no
    // repaint, so no further `load`/`idle` may ever fire — a once() handler
    // registered in that window never runs and icons silently stay circles.
    // Persistent styledata/idle handlers retry until one application lands,
    // then unsubscribe; the style's initial load always fires styledata.
    // (loadAll itself is safe to re-run: it skips loaded/loading sprites.)
    let applied = false;
    const tryLoadAll = (): void => {
      if (applied || !map.getSource(MARKER_SOURCE_ID)) return;
      applied = true;
      map.off("styledata", tryLoadAll);
      map.off("idle", tryLoadAll);
      loadAll();
    };

    if (map.getSource(MARKER_SOURCE_ID)) {
      loadAll();
    } else {
      map.on("styledata", tryLoadAll);
      map.on("idle", tryLoadAll);
    }

    return () => {
      cancelled = true;
      map.off("styledata", tryLoadAll);
      map.off("idle", tryLoadAll);
    };
  }, [mapInstance, categoryIcons]);

  // Build marker GeoJSON from the full list — filtered by visible categories
  // and (when hideFound) found markers — and push it into the clustered source.
  // Filtering happens BEFORE setData so cluster counts reflect what's shown;
  // setData re-clusters.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = (): void => {
      // Recreate the marker source (+ its layers) when the desired clustering
      // differs from the current one — e.g. once a dense map's markers load.
      // Sparse maps never enter this branch (both stay false from the style).
      if (clusteredRef.current !== shouldCluster) {
        for (const id of MARKER_LAYER_IDS) {
          if (map.getLayer(id)) map.removeLayer(id);
        }
        if (map.getSource(MARKER_SOURCE_ID)) map.removeSource(MARKER_SOURCE_ID);
        map.addSource(
          MARKER_SOURCE_ID,
          shouldCluster
            ? {
                type: "geojson",
                data: EMPTY_FC,
                cluster: true,
                clusterRadius: 50,
                clusterMaxZoom: Math.max(0, (meta.maxZoom ?? 0) - 1),
              }
            : { type: "geojson", data: EMPTY_FC }
        );
        for (const layer of buildLayers()) map.addLayer(layer);
        clusteredRef.current = shouldCluster;
      }

      const src = map.getSource(MARKER_SOURCE_ID) as GeoJSONSource | undefined;
      if (!src) return;
      const catSet = categories ? new Set(categories) : null;
      let list = markers;
      if (catSet) list = list.filter((m) => catSet.has(m.categoryId));
      if (hideFound) list = list.filter((m) => !found.has(m.id));
      const fc = markersToGeoJSON(
        list,
        meta.maxZoom ?? 0,
        found,
        loadedIconCats.current,
        pinIconCats.current
      );
      markerFcRef.current = fc; // so the drag handler can move a feature in place
      src.setData(fc);
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
    // categoriesKey stands in for the `categories` array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    markers,
    categoriesKey,
    found,
    hideFound,
    meta.maxZoom,
    iconsVersion,
    shouldCluster,
  ]);

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
    mapInstance.fitBounds(
      regionBounds(region, meta.maxZoom ?? 0),
      regionFitOptions(meta.maxZoom ?? undefined),
    );
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

  // Custom markers (player "My Markers"): rebuild the source + layers ABOVE the
  // catalog markers on change. Low-cardinality (≤200/map), so a full rebuild is
  // cheap — mirrors the region overlay. The drag handler mutates the source in
  // place via customFcRef; this re-seeds it from the latest prop.
  useEffect(() => {
    const map = mapInstance;
    if (!map) return;

    const apply = (): void => {
      for (const id of CUSTOM_MARKER_LAYER_IDS) {
        if (map.getLayer(id)) map.removeLayer(id);
      }
      if (map.getSource(CUSTOM_MARKER_SOURCE_ID)) {
        map.removeSource(CUSTOM_MARKER_SOURCE_ID);
      }
      const fc = customMarkersToGeoJSON(customMarkers ?? [], meta.maxZoom ?? 0);
      customFcRef.current = fc;
      map.addSource(CUSTOM_MARKER_SOURCE_ID, { type: "geojson", data: fc });
      for (const layer of buildCustomMarkerLayers()) map.addLayer(layer); // on top
    };

    if (map.isStyleLoaded()) {
      apply();
    } else {
      // Same as the catalog-marker effect: `load` may already have fired by the
      // time this runs, so also hook `idle` (re-fires on settle) to be safe.
      map.once("load", apply);
      map.once("idle", apply);
    }
    return () => {
      map.off("load", apply);
      map.off("idle", apply);
    };
  }, [mapInstance, customMarkers, meta.maxZoom]);

  // Placement mode: a crosshair cursor cues the player to click the map to drop
  // a marker. Hover handlers still flip it to pointer/grabbing transiently.
  useEffect(() => {
    if (!mapInstance) return;
    mapInstance.getCanvas().style.cursor = placing ? "crosshair" : "";
  }, [mapInstance, placing]);

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
    </div>
  );
};

// Default export so next/dynamic can import this module without a resolver.
export default MapView;
