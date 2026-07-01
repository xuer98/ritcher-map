import type { CSSProperties, ReactNode } from 'react';
import type { GameResponse } from '../types';

export interface BrandThemeProps {
  /** Branding row for the game, or null (falls back to default theme). */
  game: GameResponse | null;
  children: ReactNode;
  className?: string;
}

// A `fontUrl` ending in one of these is a self-hosted font FILE (uploaded to
// R2) and needs an @font-face rule bound to the family name; anything else
// (e.g. a Google Fonts href) is a stylesheet loaded via <link>.
const FONT_FILE_FORMAT: Record<string, string> = {
  woff2: 'woff2',
  woff: 'woff',
  ttf: 'truetype',
  otf: 'opentype',
};

function fontFileFormat(url: string): string | null {
  const ext = url.split(/[?#]/)[0].split('.').pop()?.toLowerCase();
  return ext ? (FONT_FILE_FORMAT[ext] ?? null) : null;
}

/** The single family NAME to bind an uploaded font to: the @font-face
 *  descriptor takes one name, not a comma-separated `Family, fallback` stack. */
function primaryFamily(fontFamily: string): string {
  return fontFamily.split(',')[0].trim().replace(/^['"]|['"]$/g, '');
}

/** Strip characters that could break out of the `url("…")` / quoted-name CSS
 *  context (these values are admin-set, but never trust into a raw <style>). */
function cssSafe(value: string): string {
  return value.replace(/["\\\n\r<>]/g, '');
}

/**
 * Retint a subtree with a game's branding by overriding the Tailwind theme
 * CSS variables (`--color-brand`, `--color-accent`, `--font-brand`) on a
 * wrapper, so every `bg-accent`/`text-brand`/`font-brand` utility inside picks
 * up the game's palette. The custom web font is pulled in from either a
 * stylesheet URL (Google Fonts, etc.) or a self-hosted font file (@font-face).
 *
 * No 'use client' — it's pure markup, usable from server components.
 */
export function BrandTheme({ game, children, className }: BrandThemeProps) {
  const style: CSSProperties & Record<string, string> = {};
  if (game?.primaryColor) style['--color-brand'] = game.primaryColor;
  if (game?.accentColor) {
    style['--color-accent'] = game.accentColor;
    style['--color-accent-hover'] = game.accentColor;
  }
  if (game?.fontFamily) {
    style['--font-brand'] = game.fontFamily;
    style.fontFamily = 'var(--font-brand)';
  }

  // A self-hosted font file needs an @font-face bound to the family; a
  // stylesheet URL just needs a <link>. Self-hosting requires a family name to
  // bind to — without one there's nothing to reference, so fall back to <link>.
  const fmt = game?.fontUrl ? fontFileFormat(game.fontUrl) : null;
  const selfHostedFont = fmt !== null && !!game?.fontFamily;
  const fontFace =
    selfHostedFont && game
      ? `@font-face{font-family:"${cssSafe(primaryFamily(game.fontFamily as string))}";` +
        `src:url("${cssSafe(game.fontUrl as string)}") format("${fmt}");font-display:swap;}`
      : null;

  return (
    <>
      {game?.fontUrl && !selfHostedFont && (
        // React 19 hoists this stylesheet <link> into <head>.
        <link rel="stylesheet" href={game.fontUrl} />
      )}
      {/* A <style> applies globally wherever it renders; @font-face self-hosts
          the uploaded file under the brand family name. */}
      {fontFace && <style>{fontFace}</style>}
      <div className={className} style={style} data-game={game?.slug}>
        {children}
      </div>
    </>
  );
}
