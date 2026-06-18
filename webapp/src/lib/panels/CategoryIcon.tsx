'use client';

import { useEffect, useState } from 'react';
import { categoryColor } from '../map/layers';
import { resolveIconUrl } from '../icons';

export interface CategoryIconProps {
  icon: string | null;
  categoryId: number;
  /** px; defaults to the 12px swatch size used across the sidebar. */
  size?: number;
  alt?: string;
}

/**
 * A category's visual marker. The icon SVG/image is rendered as-is (no disc or
 * tint behind it), mirroring the map marker. Anything missing/broken falls back
 * to the deterministic color swatch, so a bad icon never leaves a blank gap.
 */
export const CategoryIcon: React.FC<CategoryIconProps> = ({
  icon,
  categoryId,
  size = 12,
  alt = '',
}) => {
  const url = resolveIconUrl(icon);
  const [failed, setFailed] = useState(false);

  // A new url is a fresh chance to load — clear a prior failure.
  useEffect(() => {
    setFailed(false);
  }, [url]);

  if (url && !failed) {
    return (
      <img
        className="cat-icon"
        src={url}
        alt={alt}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        onError={() => setFailed(true)}
        aria-hidden={alt === '' ? true : undefined}
      />
    );
  }
  return (
    <span
      className="swatch"
      style={{ background: categoryColor(categoryId), width: size, height: size }}
      aria-hidden="true"
    />
  );
};
