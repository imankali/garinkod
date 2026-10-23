// frontend/src/test/uiStandards.test.ts
//
// The ui-ux-pro-max pre-delivery checklist, enforced on *every page file*
// rather than on the handful of components the render gallery covers.
//
// The gallery in uxAudit.test.tsx renders real components and measures the
// DOM. That catches a small button once a component is mounted, but it cannot
// say anything about the 38 page files nobody renders in a test — and that is
// where the audit found the debt: 51 <button> elements with no explicit type
// (a submit waiting to fire inside a form), images with no intrinsic size
// (layout shift), and headings that skipped a level.
//
// These checks are static on purpose. They are cheap enough for every
// `vitest run`, they fail with a file:line the author can act on, and they
// cannot be satisfied by mocking the network.

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx') ? [full] : [];
  });
}

const sourceFiles = walk(path.join(root, 'src'));
const rel = (file: string) => path.relative(root, file);
// Top-level route components only: the folders under src/pages hold panels and
// overlays that render inside another page, so they must not declare an h1.
const pageFiles = readdirSync(path.join(root, 'src', 'pages'))
  .filter((name) => name.endsWith('.tsx') && !name.endsWith('.test.tsx'))
  .map((name) => path.join(root, 'src', 'pages', name));

/** file:line for every match, so a failure points at the author's line. */
function matches(file: string, pattern: RegExp): string[] {
  const source = readFileSync(file, 'utf8');
  const out: string[] = [];
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
  for (const match of source.matchAll(re)) {
    const line = source.slice(0, match.index).split('\n').length;
    out.push(`${path.relative(root, file)}:${line}`);
  }
  return out;
}

describe('ui standards — every page', () => {
  it('declares an <h1> on every route component', () => {
    // More than one <h1> in a *file* is fine when the extra ones live in
    // mutually exclusive branches (loading / not-found / empty cart); more
    // than one in the *document* is what matters, and that is what the
    // rendered gallery checks. This guard stops a new page shipping without
    // any page-level heading at all.
    const offenders = pageFiles
      .filter((file) => {
        const source = readFileSync(file, 'utf8');
        // PageHeader renders the <h1> itself.
        return !/<h1[\s>]/.test(source) && !/<PageHeader[\s>]/.test(source);
      })
      .map((file) => path.relative(root, file));
    expect(offenders).toEqual([]);
  });

  it('gives every button an explicit type', () => {
    // motion.button is the same HTML element with animation props: without a
    // type it defaults to submit inside any ancestor form, which is how a
    // quantity stepper ends up placing an order.
    const offenders = sourceFiles.flatMap((file) => [
      ...matches(file, /<button(?![^>]*\btype=)/),
      ...matches(file, /<motion\.button(?![^>]*\btype=)/),
    ]);
    expect(offenders).toEqual([]);
  });

  it('gives every image an alt attribute', () => {
    const offenders = sourceFiles.flatMap((file) => matches(file, /<img(?![^>]*\balt=)/));
    expect(offenders).toEqual([]);
  });

  it('gives every image intrinsic dimensions or an aspect ratio', () => {
    // `loading="lazy"` without width/height still shifts the page when the
    // bytes arrive; browsers need one of the two to reserve the box.
    const offenders = sourceFiles.flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      const out: string[] = [];
      for (const match of source.matchAll(/<img\b[^>]*>/g)) {
        const tag = match[0];
        const className = tag.match(/className=(?:"([^"]*)"|\{`([^`]*)`\})/);
        const classes = `${className?.[1] ?? ''} ${className?.[2] ?? ''}`;
        const sized =
          /\bwidth=/.test(tag) ||
          /\bheight=/.test(tag) ||
          // A height utility (or an aspect ratio) already reserves the box;
          // `w-full h-auto` on its own does not.
          /\bh-(\d|\[|full|screen|auto)/.test(classes) ||
          /\baspect-/.test(classes) ||
          /\bsize-/.test(classes);
        if (!sized) out.push(`${path.relative(root, file)}:${source.slice(0, match.index).split('\n').length}`);
      }
      return out;
    });
    expect(offenders).toEqual([]);
  });

  it('does not open a new tab without rel="noopener"', () => {
    const offenders = sourceFiles.flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return Array.from(source.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g))
        .filter((match) => !/rel=/.test(match[0]))
        .map((match) => `${path.relative(root, file)}:${source.slice(0, match.index).split('\n').length}`);
    });
    expect(offenders).toEqual([]);
  });

  it('does not type raw hex colours into class names', () => {
    // Every colour that has a name lives in the `@theme` block of index.css.
    // An arbitrary `bg-[#08392a]` is how the palette drifted before: the same
    // surface in two components ended a shade apart, and no one could grep the
    // brand. Gradients and `url()` arbitrary values are fine — they are images,
    // not palette entries.
    const offenders = sourceFiles.flatMap((file) =>
      matches(file, /\b[a-z-]+-\[#[0-9a-fA-F]{3,8}\]/),
    );
    expect(offenders).toEqual([]);
  });

  it('gives catalogue cards one scaling media ratio, never a fixed height', () => {
    // The cards used to pin `aspect-[4/3]` *and* `h-40 md:h-48`: the image was
    // square on a phone and 4:3 on a laptop, so two cards of the same
    // component had different proportions. One ratio that scales with the card
    // is the standard behaviour, and the skeleton must mirror it or the page
    // jumps when the data lands.
    for (const file of ['ProductCard.tsx', 'MarketplaceListingCard.tsx']) {
      const source = readFileSync(path.join(root, 'src', 'components', file), 'utf8');
      expect(source, file).toMatch(/aspect-square/);
      expect(source, file).not.toMatch(/\bh-4[08]\b/);
      expect(source, file).not.toMatch(/aspect-\[4\/3\]/);
    }
    const skeleton = readFileSync(path.join(root, 'src', 'components', 'ui', 'SkeletonCard.tsx'), 'utf8');
    expect((skeleton.match(/aspect-square/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('takes rail card widths from one shared class', () => {
    // Five files each typed their own w-[46%] sm:w-[30%] lg:w-[23%]; one drift
    // and the rails stop lining up. The widths live in `.rail-card` now.
    const css = readFileSync(path.join(root, 'src', 'index.css'), 'utf8');
    expect(css).toMatch(/\.rail-card\s*\{[^}]*width:/);
    const offenders = sourceFiles
      // `max-w-[45%]` is a different concern (a truncating label), so only an
      // owned width counts.
      .filter((file) => /(?<!max-)w-\[\d+%\]/.test(readFileSync(file, 'utf8')))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it('hides the scrollbar on horizontal rails but keeps them operable', () => {
    // A rail is drag/touch/wheel/keyboard operable and shows an edge fade, so
    // a permanent grey strip under every panel is decoration, not affordance.
    // The bar may only be hidden together with a keyboard path: if someone
    // later removes the tabIndex from useDragToScroll, this pairing is wrong.
    const css = readFileSync(path.join(root, 'src', 'index.css'), 'utf8');
    const block = css.match(/\.rail-scroll\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(block).toMatch(/scrollbar-width:\s*none/);
    expect(css).toMatch(/\.rail-scroll::-webkit-scrollbar\s*\{[^}]*display:\s*none/);

    const dragHook = readFileSync(path.join(root, 'src', 'hooks', 'useDragToScroll.ts'), 'utf8');
    expect(dragHook).toMatch(/tabIndex:\s*focusable\s*\?\s*0/);
    expect(dragHook).toMatch(/case 'ArrowRight'/);
  });

  it('does not use emoji as a structural icon', () => {
    // Emoji in copy (a toast, a ticker string) is allowed; an emoji inside a
    // decorative icon slot is not — it renders differently per platform and
    // cannot inherit the brand colour. The pattern only matches an emoji that
    // is the whole content of an element, e.g. <span aria-hidden>🌱</span>.
    const emojiOnly = />\s*\p{Extended_Pictographic}(?:\uFE0F)?\s*</gu;
    const offenders = sourceFiles.flatMap((file) => matches(file, emojiOnly));
    expect(offenders).toEqual([]);
  });
});
