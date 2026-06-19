import { ImageResponse } from 'next/og';
import { resolveAssetUrl } from '@/lib/icons';
import { fetchGame } from '@/lib/server';

// Per-game favicon. A segment-level dynamic `icon` route overrides the root
// app/icon.svg for everything under /[gameSlug] (the game page AND its maps), so
// each game gets its own browser-tab icon: the game's cover art (thumbnail) or
// logo, cropped to a square. Falls back to the site map-pin (mirrors icon.svg)
// when the game has no art or isn't found.
export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

interface IconProps {
  params: Promise<{ gameSlug: string }>;
}

export default async function Icon({ params }: IconProps) {
  const { gameSlug } = await params;
  const game = await fetchGame(gameSlug).catch(() => null);
  const art = resolveAssetUrl(game?.thumbnailUrl ?? game?.logoUrl ?? null);

  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%' }}>
        {art ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={art}
            alt=""
            width={size.width}
            height={size.height}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              width: '100%',
              height: '100%',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(#3b82f6, #1d4ed8)',
            }}
          >
            <svg
              width="44"
              height="44"
              viewBox="0 0 64 64"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M32 12a13 13 0 0 1 13 13c0 10-13 27-13 27s-13-17-13-27a13 13 0 0 1 13-13Z"
                fill="#ffffff"
              />
              <circle cx="32" cy="25" r="5" fill="#1d4ed8" />
            </svg>
          </div>
        )}
      </div>
    ),
    { ...size },
  );
}
