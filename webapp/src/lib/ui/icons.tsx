/**
 * Small stroked line-icons for the side menu, matching the Figma import's icon
 * style (currentColor stroke, round caps). Each takes a `size` (px) and optional
 * `className` so callers tint via `text-*` utilities.
 */
import type { SVGProps } from 'react';

type IconProps = { size?: number } & SVGProps<SVGSVGElement>;

function Svg({ size = 18, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const SearchIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
  </Svg>
);

export const LayersIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3l9 5-9 5-9-5 9-5z" />
    <path d="M3 13l9 5 9-5" />
  </Svg>
);

export const PinIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 21s7-5.7 7-11a7 7 0 1 0-14 0c0 5.3 7 11 7 11z" />
    <circle cx="12" cy="10" r="2.5" />
  </Svg>
);

/** Location pin with a plus — the "add a custom marker" affordance. */
export const MapPinPlusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M19.5 9.5c0 5-7.5 11.5-7.5 11.5S4.5 14.5 4.5 9.5a7.5 7.5 0 0 1 12.9-5.2" />
    <path d="M17.5 2.5v5M20 5h-5" />
    <circle cx="12" cy="9.5" r="2.2" />
  </Svg>
);

export const EyeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);

export const EyeOffIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 3l18 18" />
    <path d="M10.6 5.2A10 10 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-3.4 4.3M6.2 6.2A18 18 0 0 0 2 12s3.5 7 10 7a10 10 0 0 0 4-.8" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </Svg>
);

export const ChevronRightIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 6l6 6-6 6" />
  </Svg>
);

/** Hexagon discovery badge with a check — used in the progress box. */
export const DiscoveryIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3l7 4v6l-7 4-7-4V7l7-4z" />
    <path d="M8.5 12l2.5 2.5L16 9" />
  </Svg>
);

/** iOS-style share: tray with an up arrow. */
export const ShareIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3v11" />
    <path d="M8 6.5L12 3l4 3.5" />
    <path d="M6 11H5a1 1 0 0 0-1 1v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a1 1 0 0 0-1-1h-1" />
  </Svg>
);

/** Expand / view full screen (two diagonal arrows). */
export const ExpandIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 4h6v6" />
    <path d="M20 4l-7 7" />
    <path d="M10 20H4v-6" />
    <path d="M4 20l7-7" />
  </Svg>
);

export const CloseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 5l14 14M19 5L5 19" />
  </Svg>
);

/** Check in a circle — the "Found" toggle. */
export const CheckCircleIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 12.5l2.5 2.5 4.5-5.5" />
  </Svg>
);

/** Compass — the "Explore" action (fly the camera to the marker). */
export const CompassIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M15.5 8.5l-2 5-5 2 2-5 5-2z" />
  </Svg>
);
