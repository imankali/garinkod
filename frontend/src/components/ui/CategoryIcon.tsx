import { Carrot, Citrus, Droplets, FlaskConical, Grape, Leaf, Package, Sprout, Tractor, Trees, Wheat, Wrench, type LucideIcon } from 'lucide-react';

/**
 * One place where a category, a crop or a land type becomes an icon.
 *
 * The UI used to draw these as emoji: `{ name: 'کود', emoji: '🌱' }` in the home
 * page's category tiles, `categoryIcons[slug]` in the mega menu, an emoji per
 * crop in the crop selector, an emoji per land type in the farm panel. The
 * skill's style rules name emoji-as-icon as an anti-pattern, and it is not only
 * a matter of taste here:
 *
 *   - the glyph depends on the reader's platform and font, so the same category
 *     is a different picture on Windows, Android and iOS, and on a system
 *     without that emoji font it is an empty box — the home page's six category
 *     tiles then have no icon at all;
 *   - an emoji cannot take the text colour, cannot be sized to the optical
 *     weight of the surrounding type, and carries its own palette that fights
 *     the brand's;
 *   - screen readers announce some of them ("seedling", "test tube") in the
 *     middle of a label that already says the same word.
 *
 * These are the same mappings the emoji stood for, drawn from the icon set the
 * rest of the site already uses, so they scale, inherit colour, and stay
 * consistent across platforms. Everything decorative is `aria-hidden`: the
 * visible label beside it already carries the meaning.
 */

/** A product category, by slug. Slugs are what the API and the URLs use. */
const CATEGORY_ICONS: Record<string, { icon: LucideIcon; tone: string }> = {
  fertilizer: { icon: Sprout, tone: 'text-emerald-600 dark:text-lime-300' },
  pesticide: { icon: FlaskConical, tone: 'text-rose-600 dark:text-rose-300' },
  seed: { icon: Wheat, tone: 'text-amber-600 dark:text-amber-300' },
  equipment: { icon: Tractor, tone: 'text-slate-700 dark:text-slate-200' },
  tools: { icon: Wrench, tone: 'text-sky-700 dark:text-sky-300' },
  irrigation: { icon: Droplets, tone: 'text-cyan-600 dark:text-cyan-300' },
};

/** A crop, by id. `پسته` and the rest are orchards rather than a single fruit. */
const CROP_ICONS: Record<string, LucideIcon> = {
  wheat: Wheat,
  rice: Wheat,
  pistachio: Trees,
  tomato: Carrot,
  cucumber: Leaf,
  citrus: Citrus,
  grape: Grape,
};

const LAND_ICONS = {
  orchard: Trees,
  greenhouse: Leaf,
  field: Wheat,
} as const;

export type LandType = keyof typeof LAND_ICONS;

export function CategoryIcon({ slug, size = 24, className }: { slug: string; size?: number; className?: string }) {
  const entry = CATEGORY_ICONS[slug] ?? { icon: Package, tone: 'text-slate-500 dark:text-slate-300' };
  const Icon = entry.icon;
  return <Icon size={size} aria-hidden="true" className={className ?? entry.tone} />;
}

export function CropIcon({ id, size = 20, className }: { id: string; size?: number; className?: string }) {
  const Icon = CROP_ICONS[id] ?? Sprout;
  return <Icon size={size} aria-hidden="true" className={className} />;
}

export function LandTypeIcon({ type, size = 16, className }: { type: LandType | string; size?: number; className?: string }) {
  const Icon = LAND_ICONS[type as LandType] ?? Wheat;
  return <Icon size={size} aria-hidden="true" className={className} />;
}
