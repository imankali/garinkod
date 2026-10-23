// frontend/src/components/farm/LandTypeGlyph.tsx
//
// One glyph for a land type, used by the farm panel, the land drawer and the
// farmers page. The drawer and the panel used to share the same inline
// `orchard ? '🌳' : greenhouse ? '🏡' : '🌾'` ternary, which meant three copies
// of the same art and three different pictures per operating system. A single
// lucide icon keeps the three surfaces identical and quiet for screen readers,
// because the land-type label is always printed next to it in text.

import { House, Sprout, Trees, type LucideIcon } from 'lucide-react';

export function landTypeIcon(landType: string): LucideIcon {
  if (landType === 'orchard') return Trees;
  if (landType === 'greenhouse') return House;
  return Sprout;
}

export default function LandTypeGlyph({
  landType,
  size = 20,
  className,
}: {
  landType: string;
  size?: number;
  className?: string;
}) {
  const Icon = landTypeIcon(landType);
  return <Icon size={size} className={className} aria-hidden="true" />;
}
