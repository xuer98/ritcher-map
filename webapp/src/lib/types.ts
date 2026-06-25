// Wire types. Field names are EXACT per the gateway contract:
//   - tile-service (markers) + progress + accounts: snake_case
//   - catalog (/api/v1/...): camelCase

/**
 * Pixel-space bounding box: [minX, minY, maxX, maxY]; requires max > min.
 * Retained for the pixel/geo CRS helpers (`viewportToPixelBbox`); the webapp
 * now loads all markers up front and clusters them client-side rather than
 * fetching per-viewport.
 */
export type Bbox = [minX: number, minY: number, maxX: number, maxY: number];

// ----------------------------------------------------------------------------
// catalog: /api/v1/maps, /api/v1/maps/{id}, /api/v1/games/{gameSlug}/categories
//   (camelCase)
// ----------------------------------------------------------------------------

export type MapStatus = 'DRAFT' | 'UPLOADED' | 'TILING' | 'READY' | 'FAILED';

export interface MapResponse {
  id: number;
  gameSlug: string;
  mapSlug: string;
  name: string;
  prefix: string;
  status: MapStatus;
  width: number | null;
  height: number | null;
  maxZoom: number | null;
  /** Lowest zoom the viewer exposes; defaults to 0. */
  minZoom: number;
  /** Display order within the game (ascending; ties broken by name). */
  sortOrder: number;
  tileSize: number;
  format: string;
  createdAt: string;
  updatedAt: string;
}

/** Per-game branding (catalog /api/v1/games). All branding fields nullable. */
export interface GameResponse {
  id: number;
  slug: string;
  title: string;
  primaryColor: string | null;
  accentColor: string | null;
  fontFamily: string | null;
  fontUrl: string | null;
  logoUrl: string | null;
  thumbnailUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryResponse {
  id: number;
  /** Categories are game-scoped — shared across every map of the game. */
  gameSlug: string;
  parentId: number | null;
  slug: string;
  name: string;
  icon: string | null;
  sortOrder: number;
}

/** A named polygonal area of a map (catalog /api/v1/maps/{id}/regions). */
export interface RegionResponse {
  id: number;
  mapId: number;
  name: string;
  sortOrder: number;
  /** Exterior ring as [x, y] pixel-space pairs (auto-closed). */
  polygon: [number, number][];
  /** [minX, minY, maxX, maxY] in pixel space — used to fit the camera. */
  bbox: Bbox;
}

// ----------------------------------------------------------------------------
// progress: gateway-local, STRING ids on the wire (converted in src/api/progress.ts)
// ----------------------------------------------------------------------------

export interface ProgressGetResponse {
  map_id: string;
  found: string[];
  count: number;
}

export interface ProgressUpdateRequest {
  marker_id: string;
  found: boolean;
}

// ----------------------------------------------------------------------------
// accounts: /auth/*, /account/me  (snake_case)
// ----------------------------------------------------------------------------

export interface AccountUser {
  id: string;
  email: string;
  /** CMS operator (users.admin). Gates catalog writes at the gateway. */
  admin: boolean;
}

export interface AuthResponse {
  token: string;
  user: AccountUser;
}

export interface MeResponse {
  id: string;
  email: string;
  admin: boolean;
}

// ----------------------------------------------------------------------------
// websocket: server -> client only
// ----------------------------------------------------------------------------

export interface ProgressSyncMessage {
  type: 'progress';
  map_id: string;
  marker_id: string;
  found: boolean;
}
