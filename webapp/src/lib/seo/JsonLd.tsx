// Structured data (schema.org JSON-LD) for richer, higher-CTR search results.
// Builders return plain objects; <JsonLd> serializes them into a script tag.
// Server-only: rendered inside server components, never shipped as client JS.

import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/config';

type JsonLdData = Record<string, unknown>;

/** A single crumb: visible label + root-relative path. */
export interface Crumb {
  name: string;
  path: string;
}

/** schema.org WebSite — home page. (No SearchAction: there's no /search endpoint yet.) */
export function websiteJsonLd(): JsonLdData {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    alternateName: 'RitcherMap — Interactive Game Maps',
    url: `${SITE_URL}/`,
    description: SITE_DESCRIPTION,
  };
}

/** schema.org BreadcrumbList — surfaces the trail (Home › Game › Map) in the SERP. */
export function breadcrumbJsonLd(crumbs: Crumb[]): JsonLdData {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: `${SITE_URL}${c.path}`,
    })),
  };
}

/** schema.org VideoGame — the game a set of maps belongs to. */
export function videoGameJsonLd(opts: {
  title: string;
  gameSlug: string;
  description?: string;
  image?: string | null;
}): JsonLdData {
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name: opts.title,
    url: `${SITE_URL}/${opts.gameSlug}`,
    ...(opts.description ? { description: opts.description } : {}),
    ...(opts.image ? { image: opts.image } : {}),
  };
}

/**
 * Render one or more JSON-LD objects as a script tag. `<` is escaped so the
 * payload can never break out of the <script> element.
 */
export function JsonLd({ data }: { data: JsonLdData | JsonLdData[] }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
