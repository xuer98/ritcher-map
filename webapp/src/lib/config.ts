// Central runtime configuration derived from env vars. The NEXT_PUBLIC_ var
// must be referenced statically so Next.js inlines it into the client bundle.

const rawGateway =
  process.env.NEXT_PUBLIC_GATEWAY_URL ?? 'http://localhost:8080';

/** Gateway origin the web client talks to. Trailing slash stripped. */
export const GATEWAY_URL: string = rawGateway.replace(/\/+$/, '');

/**
 * Public origin the site is served from, e.g. 'https://ritchermap.com'. Used as
 * the `metadataBase` for absolute canonical/Open Graph URLs and to build the
 * sitemap + robots.txt. MUST be set in production (set NEXT_PUBLIC_SITE_URL to
 * your real domain) or Google will index localhost URLs. Trailing slash stripped.
 */
export const SITE_URL: string = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
).replace(/\/+$/, '');

/** Brand name used in metadata, JSON-LD, and Open Graph. */
export const SITE_NAME = 'RitcherMap';

/** Default site description (the search-result snippet for the home page). */
export const SITE_DESCRIPTION =
  'Free interactive game maps — find every collectible, boss and location, ' +
  'and track your progress as you explore.';

/**
 * Public base URL for uploaded assets (category icons) held in object storage,
 * e.g. 'https://assets.example.com' or an r2.dev bucket URL. When unset, only
 * absolute icon URLs render; a bare object key can't be resolved to a fetch
 * URL (callers fall back to the category color swatch). Trailing slash stripped.
 */
export const ASSET_BASE_URL: string = (
  process.env.NEXT_PUBLIC_ASSET_BASE_URL ?? ''
).replace(/\/+$/, '');

/**
 * Google OAuth client ID for "Sign in with Google" (Google Identity Services).
 * When unset, the Google button is hidden and only email/password auth is
 * offered. Must be the SAME client id the accounts service verifies against
 * (its GOOGLE_CLIENT_ID env var), and the site origin must be listed under the
 * client's "Authorized JavaScript origins" in the Google Cloud console.
 */
export const GOOGLE_CLIENT_ID: string =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';

/** WebSocket URL: GATEWAY_URL with http->ws / https->wss, plus '/ws'. */
export const WS_URL: string =
  GATEWAY_URL.replace(/^http(s?):\/\//, (_m, s: string) => `ws${s}://`) + '/ws';

/** Tile size in pixels (matches tiler output + CRS math). */
export const TILE_SIZE = 256;

/** Above this marker count the server returns clusters instead of markers. */
export const SERVER_CLUSTER_LIMIT = 500;
