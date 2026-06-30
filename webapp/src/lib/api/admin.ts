// Admin (CMS) calls. Every gateway call here is a catalog write, which the
// gateway only accepts from tokens carrying the admin claim — a non-admin
// session gets 403 before the catalog ever sees the request.

import { apiSend, getAuthToken } from './client';
import type { CatalogMarker } from './maps';
import type {
  CategoryResponse,
  GameResponse,
  MapResponse,
  RegionResponse,
} from '../types';

export interface CategoryInput {
  slug: string;
  name: string;
  icon?: string | null;
  sortOrder?: number;
  parentId?: number | null;
  /**
   * Whether the category renders by default + counts toward discovery progress.
   * Always sent so a PUT (which replaces all fields, e.g. on reorder) never
   * silently resets it to the server default.
   */
  trackable: boolean;
}

export interface MarkerInput {
  categoryId: number;
  x: number;
  y: number;
  title?: string | null;
  description?: string | null;
}

// --- maps -------------------------------------------------------------------

export function createMap(
  gameSlug: string,
  mapSlug: string,
  name: string,
): Promise<MapResponse> {
  return apiSend<MapResponse>(
    'POST',
    '/api/v1/maps',
    { gameSlug, mapSlug, name },
    { auth: true },
  );
}

/** Patch a map's editable fields (name, minZoom and/or sortOrder). */
export function updateMap(
  id: number,
  patch: { name?: string; minZoom?: number; sortOrder?: number },
): Promise<MapResponse> {
  return apiSend<MapResponse>('PATCH', `/api/v1/maps/${id}`, patch, { auth: true });
}

export function deleteMap(id: number): Promise<void> {
  return apiSend<void>('DELETE', `/api/v1/maps/${id}`, undefined, { auth: true });
}

/** Kick off (or retry) tiling for an image already sitting in object storage. */
export function requestTiling(
  id: number,
  sourceBucket: string,
  sourceKey: string,
  format?: string,
): Promise<MapResponse> {
  return apiSend<MapResponse>(
    'POST',
    `/api/v1/maps/${id}/tiling`,
    { sourceBucket, sourceKey, format: format ?? null },
    { auth: true },
  );
}

export interface ImportedDims {
  width: number;
  height: number;
  maxZoom: number;
  minZoom?: number;
  tileSize?: number;
  format?: string;
}

/**
 * Mark a map READY from a pre-built {z}/{x}/{y} pyramid already uploaded to tile
 * storage — no source image, no tiling worker. The dimensions are what the
 * worker would otherwise have computed.
 */
export function markImported(
  id: number,
  dims: ImportedDims,
): Promise<MapResponse> {
  return apiSend<MapResponse>('POST', `/api/v1/maps/${id}/imported`, dims, {
    auth: true,
  });
}

// --- games (branding) --------------------------------------------------------

export interface GameInput {
  title: string;
  primaryColor?: string | null;
  accentColor?: string | null;
  fontFamily?: string | null;
  fontUrl?: string | null;
  logoUrl?: string | null;
  thumbnailUrl?: string | null;
}

export function createGame(slug: string, input: GameInput): Promise<GameResponse> {
  return apiSend<GameResponse>('POST', '/api/v1/games', { slug, ...input }, { auth: true });
}

export function updateGame(slug: string, input: GameInput): Promise<GameResponse> {
  return apiSend<GameResponse>('PUT', `/api/v1/games/${slug}`, input, { auth: true });
}

export function deleteGame(slug: string): Promise<void> {
  return apiSend<void>('DELETE', `/api/v1/games/${slug}`, undefined, { auth: true });
}

// --- categories ---------------------------------------------------------------

export function createCategory(
  gameSlug: string,
  input: CategoryInput,
): Promise<CategoryResponse> {
  return apiSend<CategoryResponse>(
    'POST',
    `/api/v1/games/${gameSlug}/categories`,
    input,
    { auth: true },
  );
}

/** NOTE: the catalog requires `slug` in the body but ignores it on update. */
export function updateCategory(
  id: number,
  input: CategoryInput,
): Promise<CategoryResponse> {
  return apiSend<CategoryResponse>('PUT', `/api/v1/categories/${id}`, input, {
    auth: true,
  });
}

export function deleteCategory(id: number): Promise<void> {
  return apiSend<void>('DELETE', `/api/v1/categories/${id}`, undefined, {
    auth: true,
  });
}

// --- markers ---------------------------------------------------------------

export function createMarker(
  mapId: number,
  input: MarkerInput,
): Promise<CatalogMarker> {
  return apiSend<CatalogMarker>(
    'POST',
    `/api/v1/maps/${mapId}/markers`,
    input,
    { auth: true },
  );
}

export function updateMarker(
  id: number,
  input: MarkerInput,
): Promise<CatalogMarker> {
  return apiSend<CatalogMarker>('PUT', `/api/v1/markers/${id}`, input, {
    auth: true,
  });
}

export function deleteMarker(id: number): Promise<void> {
  return apiSend<void>('DELETE', `/api/v1/markers/${id}`, undefined, {
    auth: true,
  });
}

export function bulkImportMarkers(
  mapId: number,
  markers: MarkerInput[],
): Promise<{ inserted: number }> {
  return apiSend<{ inserted: number }>(
    'POST',
    `/api/v1/maps/${mapId}/markers:bulk`,
    { markers },
    { auth: true },
  );
}

// --- regions ---------------------------------------------------------------
// Polygon areas of a map. `polygon` is the exterior ring as [x, y] pixel pairs
// (open or closed — the catalog auto-closes it). Drawn in the admin console.

export interface RegionInput {
  name: string;
  sortOrder?: number;
  polygon: [number, number][];
}

export function createRegion(
  mapId: number,
  input: RegionInput,
): Promise<RegionResponse> {
  return apiSend<RegionResponse>(
    'POST',
    `/api/v1/maps/${mapId}/regions`,
    input,
    { auth: true },
  );
}

/** Patch a region; all fields optional on the wire (name/sortOrder/polygon). */
export function updateRegion(
  id: number,
  input: Partial<RegionInput>,
): Promise<RegionResponse> {
  return apiSend<RegionResponse>('PUT', `/api/v1/regions/${id}`, input, {
    auth: true,
  });
}

export function deleteRegion(id: number): Promise<void> {
  return apiSend<void>('DELETE', `/api/v1/regions/${id}`, undefined, {
    auth: true,
  });
}

// --- uploads ---------------------------------------------------------------
// Map images are too big for any serverless body limit, so the browser PUTs
// straight to R2 with a presigned URL minted by our own /api/admin/presign
// route (which re-verifies the admin claim against the accounts service).

export interface PresignedUpload {
  bucket: string;
  key: string;
  url: string;
}

async function presignFetch<T>(payload: unknown): Promise<T> {
  const token = getAuthToken();
  const res = await fetch('/api/admin/presign', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      body && typeof body === 'object' && 'error' in body
        ? String((body as { error: unknown }).error)
        : `presign failed: ${res.status}`;
    throw new Error(msg);
  }
  return body as T;
}

/**
 * Sign a PUT for a single file. `target: 'tiles'` puts it in the PUBLIC bucket
 * under `media/…` (browser-served marker media / icons); the default 'uploads'
 * is the private source-image bucket the tiler reads.
 */
export function presignUpload(
  filename: string,
  target: 'uploads' | 'tiles' = 'uploads',
): Promise<PresignedUpload> {
  return presignFetch<PresignedUpload>({ filename, target });
}

export interface PresignedKey {
  key: string;
  url: string;
}

/**
 * Sign PUT URLs for a batch of caller-chosen keys. `target: 'tiles'` signs
 * against the tile bucket (where the tile service serves from) so a pre-built
 * pyramid can be imported directly. Keep batches ≤500 (server cap).
 */
export function presignKeys(
  keys: string[],
  target: 'uploads' | 'tiles',
): Promise<{ bucket: string; urls: PresignedKey[] }> {
  return presignFetch<{ bucket: string; urls: PresignedKey[] }>({ keys, target });
}

// R2 (like S3) returns 503 "Slow Down" — and occasionally 429/5xx — when PUTs
// arrive faster than it wants, which a bulk tile import easily triggers. These
// are transient: retry with backoff. A 403 (expired/invalid presigned URL) or
// other 4xx won't fix itself, so we fail those immediately.
const RETRYABLE_UPLOAD_STATUS = new Set([429, 500, 502, 503, 504]);
const MAX_UPLOAD_ATTEMPTS = 6;

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** One PUT attempt. Always resolves (never rejects) with the outcome so the
 *  retry loop stays linear. `status: 0` + `networkError` is the no-readable-
 *  response case (genuine network failure or a CORS rule that blocks the PUT —
 *  the only case where the CORS hint actually applies). */
function putOnce(
  url: string,
  file: Blob,
  onProgress?: (pct: number) => void,
): Promise<{ status: number; networkError: boolean; retryAfterMs: number }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    if (file.type) xhr.setRequestHeader('Content-Type', file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () =>
      resolve({
        status: xhr.status,
        networkError: false,
        retryAfterMs: (Number(xhr.getResponseHeader('retry-after')) || 0) * 1000,
      });
    xhr.onerror = () => resolve({ status: 0, networkError: true, retryAfterMs: 0 });
    xhr.send(file);
  });
}

/** PUT a file to a presigned URL. XHR (not fetch) for upload progress events.
 *  Transient throttling/network responses are retried with exponential backoff
 *  + full jitter (honoring Retry-After) so a bulk import survives R2 rate limits
 *  instead of aborting on the first 503. */
export async function uploadToPresignedUrl(
  url: string,
  file: Blob,
  onProgress?: (pct: number) => void,
): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    const { status, networkError, retryAfterMs } = await putOnce(
      url,
      file,
      onProgress,
    );
    if (status >= 200 && status < 300) return;

    const transient = networkError || RETRYABLE_UPLOAD_STATUS.has(status);
    if (!transient || attempt >= MAX_UPLOAD_ATTEMPTS) {
      if (networkError) {
        throw new Error(
          'upload failed: network/CORS error (the R2 bucket needs a CORS rule allowing PUT from this origin)',
        );
      }
      if (transient) {
        throw new Error(
          `upload failed: ${status} after ${attempt} attempts — R2 is throttling/overloaded; wait a moment or import fewer tiles at once`,
        );
      }
      throw new Error(
        status === 403
          ? 'upload failed: 403 — the presigned URL expired or was rejected; reload the page and retry'
          : `upload failed: ${status}`,
      );
    }

    // Full jitter: random point in [0, cappedBackoff]; never shorter than a
    // server-sent Retry-After. Decorrelates the 16 concurrent uploaders so they
    // don't all retry in lockstep and re-trigger the throttle.
    const backoff = Math.min(8000, 250 * 2 ** (attempt - 1));
    await delay(Math.max(retryAfterMs, Math.random() * backoff));
  }
}
