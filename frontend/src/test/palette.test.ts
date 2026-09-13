// frontend/src/test/palette.test.ts
//
// The colour tokens, measured against WCAG 2.2 AA.
//
// Contrast on this site was being audited by a browser run that reports a *count*
// of failing nodes per page and a ceiling nobody lowers. That is the wrong
// instrument for a token decision: the number moves when a page adds a button,
// and it says nothing about whether the palette itself is sound. This test asks
// the question the token change actually answers — does white on the brand
// action colour clear 4.5:1, does the muted-text token clear it on both surfaces
// — and it reads the values from the stylesheets rather than restating them, so
// editing a token here without editing the CSS does not pass.
//
// It runs in Node with no browser, which is the point: a palette regression is
// caught by `npm run test:unit` instead of waiting for a Playwright job.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const appCss = readFileSync(path.join(root, 'src', 'index.css'), 'utf8');
const themeCss = readFileSync(
  path.join(root, 'node_modules', 'tailwindcss', 'theme.css'),
  'utf8',
);

/** `@theme { --x: ... }` in src/index.css beats Tailwind's default. */
function token(name: string): string {
  const read = (source: string): string | undefined =>
    source.match(new RegExp(`--${name}:\\s*([^;}]+)`))?.[1]?.trim();
  const value = read(appCss) ?? read(themeCss);
  if (!value) throw new Error(`token --${name} is defined in neither stylesheet`);
  return value;
}

/** The value `.dark` gives the same token, or `null` when it is not overridden. */
function darkToken(name: string): string | null {
  return appCss.match(new RegExp(`\\.dark\\s*\\{[^}]*--${name}:\\s*([^;}]+)`))?.[1]?.trim() ?? null;
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function linearFromHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => channel(parseInt(full.slice(i, i + 2), 16))) as [
    number,
    number,
    number,
  ];
}

/** Tailwind v4 ships its palette in OKLCH; WCAG's formula needs sRGB. */
function linearFromOklch(value: string): [number, number, number] {
  const [lRaw, cRaw, hRaw] = value
    .replace(/^oklch\(|\)$/g, '')
    .split(/\s+/)
    .map((part) => part.trim());
  // Lightness and chroma may be written as percentages (`59.6%`), which
  // parseFloat reads as 59.6 rather than 0.596 — a 100x error that shows up as
  // a contrast ratio in the thousands rather than as an obviously wrong colour.
  const ratio = (part: string | undefined): number => {
    const n = parseFloat((part ?? '0').replace('%', ''));
    return (part ?? '').includes('%') ? n / 100 : n;
  };
  const L = ratio(lRaw);
  const C = ratio(cRaw);
  const hue = (parseFloat((hRaw ?? '0').replace('deg', '')) * Math.PI) / 180;
  const a = C * Math.cos(hue);
  const b = C * Math.sin(hue);

  const l3 = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m3 = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s3 = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return [
    4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
  ];
}

function luminance(colour: string): number {
  const [r, g, b] = colour.startsWith('oklch')
    ? linearFromOklch(colour)
    : linearFromHex(colour);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x relative-luminance contrast, 1:1 to 21:1. */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const AA_NORMAL_TEXT = 4.5;
const AA_UI_AND_LARGE_TEXT = 3;

/** Surfaces the app actually puts text on. */
const WHITE = '#ffffff';
const SLATE_900 = token('color-slate-900');

describe('the OKLCH→sRGB conversion this file depends on', () => {
  // A wrong conversion would make every assertion below meaningless, so the two
  // values it is checked against are ones Tailwind publishes as hex too.
  it('reads Tailwind’s own palette the same way in both notations', () => {
    const slate500Oklch = themeCss.match(/--color-slate-500:\s*([^;]+)/)?.[1]?.trim() ?? '';
    expect(slate500Oklch.startsWith('oklch')).toBe(true);
    // #64748b is slate-500; its contrast against white is the well-known 4.76:1.
    // Two decimals of agreement is more than enough: the failure this guards
    // against is a 100x error, and the residual here is the rounding in the
    // OKLCH→sRGB matrix, not a bug.
    expect(contrast(slate500Oklch, WHITE)).toBeCloseTo(contrast('#64748b', WHITE), 1);
    expect(contrast('#64748b', WHITE)).toBeCloseTo(4.76, 1);
  });
});

describe('brand action colour', () => {
  it('carries white text at AA', () => {
    const emerald600 = token('color-emerald-600');
    // 3.77:1 is what Tailwind's default measured; this is the regression guard.
    expect(contrast(WHITE, emerald600)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  it('is readable as text on white too', () => {
    expect(contrast(token('color-emerald-600'), WHITE)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  it('stays a usable component colour', () => {
    // Borders and icons are held to the lower bar, and a token fix aimed at text
    // must not push them under it on the way.
    expect(contrast(token('color-emerald-600'), WHITE)).toBeGreaterThanOrEqual(
      AA_UI_AND_LARGE_TEXT,
    );
  });
});

describe('muted text', () => {
  it('clears AA on the light surface', () => {
    expect(contrast(token('color-slate-400'), WHITE)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  it('keeps clearing AA on the dark surface, where the token is overridden', () => {
    const dark = darkToken('color-slate-400');
    expect(dark, '.dark must restate the muted-text token').not.toBeNull();
    expect(contrast(dark ?? '', SLATE_900)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  it('still reads as lighter than slate-500 on a light surface', () => {
    // The token was darkened to clear AA; it must not collapse into the step
    // above it, or the scale has silently lost a rung.
    expect(luminance(token('color-slate-400'))).toBeGreaterThan(
      luminance(token('color-slate-500')),
    );
  });
});

describe('the type scale has no step below the readable floor', () => {
  it.each(['2xs', 'xs', 'sm', 'base'])('--text-%s never renders under 12px', (step) => {
    const value = token(`text-${step}`);
    // The clamp's first argument is the floor, and it is what a 320px phone gets.
    const floor = value.match(/clamp\(\s*([\d.]+)rem/)?.[1];
    expect(floor, `--text-${step} should be a rem-based clamp`).toBeDefined();
    expect(Number(floor) * 16).toBeGreaterThanOrEqual(12);
  });
});

describe('the touch minimum is anchored in pixels', () => {
  it('--tap-min is a px length, not a multiple of the type scale', () => {
    const value = appCss.match(/--tap-min:\s*([^;}]+)/)?.[1]?.trim() ?? '';
    expect(value).toMatch(/^44px$/);
  });

  it('controls declared as tap targets get the floor in both axes', () => {
    // The rule, not the utility: `min-h-11` is 2.75rem and only equals 44px while
    // the root font-size happens to be 16px.
    expect(appCss).toMatch(/button\.min-h-11[^{]*\{[^}]*min-width:\s*var\(--tap-min\)/);
    expect(appCss).toMatch(/button\.min-h-11[^{]*\{[^}]*min-height:\s*var\(--tap-min\)/);
  });
});
