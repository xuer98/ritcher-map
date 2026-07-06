'use client';

import { useMemo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import type { ReactNode } from 'react';
import { parseVideoEmbed } from './embeds';

export interface MarkerBodyProps {
  markdown: string | null;
  /**
   * Clicked an in-description reference to another marker, written in Markdown
   * as `[label](#marker-<id>)`. The host flies to + selects that marker.
   */
  onMarkerLink?: (markerId: number) => void;
  /** Label for a marker reference with empty link text (`[](#marker-<id>)`). */
  resolveMarkerLabel?: (markerId: number) => string | null;
  /**
   * Clicked a `[label](#category-<id>)` reference. The host reveals that
   * category's markers on the map (it may be hidden/untracked).
   */
  onCategoryLink?: (categoryId: number) => void;
  /** Label for a category reference with empty link text. */
  resolveCategoryLabel?: (categoryId: number) => string | null;
  /**
   * Clicked a `[label](#region-<id>)` reference. The host fits the camera to
   * that region, like the sidebar's region list.
   */
  onRegionLink?: (regionId: number) => void;
  /** Label for a region reference with empty link text. */
  resolveRegionLabel?: (regionId: number) => string | null;
}

type LinkHandlers = Omit<MarkerBodyProps, 'markdown'>;

/** Flatten React children to a string (a bare autolink's child is its URL). */
function childText(children: ReactNode): string {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(childText).join('');
  return '';
}

/** In-app reference: `#marker-<id>`, `#category-<id>`, or `#region-<id>`. */
const REF_HREF_RE = /^#(marker|category|region)-(\d+)$/;

/** Fallback label ("Marker #7") + button class per reference kind. */
const REF_KINDS = {
  marker: { className: 'marker-link', noun: 'Marker' },
  category: { className: 'category-link', noun: 'Category' },
  region: { className: 'region-link', noun: 'Region' },
} as const;

function buildComponents(handlers: LinkHandlers): Components {
  const onRefClick = {
    marker: handlers.onMarkerLink,
    category: handlers.onCategoryLink,
    region: handlers.onRegionLink,
  };
  const resolveRefLabel = {
    marker: handlers.resolveMarkerLabel,
    category: handlers.resolveCategoryLabel,
    region: handlers.resolveRegionLabel,
  };
  return {
    a(props) {
      const href = typeof props.href === 'string' ? props.href : '';

      // Internal reference to a marker/category/region → an action button.
      const ref = REF_HREF_RE.exec(href);
      if (ref) {
        const kind = ref[1] as keyof typeof REF_KINDS;
        const id = Number(ref[2]);
        const label =
          childText(props.children) ||
          resolveRefLabel[kind]?.(id) ||
          `${REF_KINDS[kind].noun} #${id}`;
        return (
          <button
            type="button"
            className={REF_KINDS[kind].className}
            {...{ [`data-${kind}-id`]: id }}
            onClick={() => onRefClick[kind]?.(id)}
          >
            {label}
          </button>
        );
      }

      // Bare media link (text === URL) → embedded player.
      const embed = href ? parseVideoEmbed(href) : null;
      if (embed && childText(props.children) === href) {
        if (embed.kind === 'file') {
          return (
            <span className="embed embed-video">
              <video src={embed.src} controls preload="metadata" />
            </span>
          );
        }
        return (
          <span className="embed embed-iframe">
            <iframe
              src={embed.src}
              title={embed.title}
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </span>
        );
      }

      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          title={typeof props.title === 'string' ? props.title : undefined}
        >
          {props.children}
        </a>
      );
    },
    img(props) {
      const s = typeof props.src === 'string' ? props.src : '';
      if (!s) return null;
      // eslint-disable-next-line @next/next/no-img-element
      return (
        <img
          className="md-img"
          src={s}
          alt={typeof props.alt === 'string' ? props.alt : ''}
          loading="lazy"
        />
      );
    },
  };
}

/**
 * Render a marker's Markdown description as sanitized HTML. No raw HTML is
 * allowed (react-markdown ignores it by default + rehype-sanitize), and the
 * only embeds are React-rendered from URLs we validate, so the content is safe.
 * `[label](#marker-<id>)` links become in-app jumps to other markers;
 * `#category-<id>` / `#region-<id>` links reveal a category / fly to a region.
 */
export function MarkerBody({
  markdown,
  onMarkerLink,
  resolveMarkerLabel,
  onCategoryLink,
  resolveCategoryLabel,
  onRegionLink,
  resolveRegionLabel,
}: MarkerBodyProps) {
  const components = useMemo(
    () =>
      buildComponents({
        onMarkerLink,
        resolveMarkerLabel,
        onCategoryLink,
        resolveCategoryLabel,
        onRegionLink,
        resolveRegionLabel,
      }),
    [
      onMarkerLink,
      resolveMarkerLabel,
      onCategoryLink,
      resolveCategoryLabel,
      onRegionLink,
      resolveRegionLabel,
    ],
  );
  if (!markdown || markdown.trim() === '') return null;
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={components}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
