import { ImageResponse } from 'next/og';

// iOS home-screen / Apple touch icon. Generated to PNG at build time so we get a
// raster apple-icon without a binary in the repo. Mirrors the SVG favicon
// (icon.svg): a white map pin on the brand-blue tile.
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(#3b82f6, #1d4ed8)',
        }}
      >
        <svg
          width="120"
          height="120"
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
    ),
    size,
  );
}
