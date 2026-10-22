// frontend/src/test/uxAudit.ts
//
// The UX audit rules from scripts/ux_audit.mjs, expressed as DOM contracts
// jsdom can actually check. jsdom has no layout engine — getBoundingClientRect
// always answers zero — so the unit layer asserts the *mechanisms* the
// stylesheet guarantees (min-h-11, tap-target, explicit tailwind sizes); the
// pixel truth (real rects, scrollWidth, wheel panning) lives in
// e2e/ux-audit.spec.ts and runs in CI.
//
// Never scan source text: per AGENTS.md §8b, markup-based scans of this
// codebase produce false positives (multi-line tags, `>` in arrow functions,
// <Field> rendering labels at runtime). Walk the rendered tree only —
// LandCalendar.test.tsx is the precedent.

export type UxRule = 'touch-target' | 'img-alt' | 'unnamed-control';

export interface UxViolation {
  rule: UxRule;
  detail: string;
}

const INTERACTIVE = 'a[href], button, [role="button"], summary';

/** Tailwind spacing token → px at the 16px root (n × 0.25rem). */
function tokenPx(token: string): number | null {
  const bare = token.match(/^(?:min-)?(?:[hw]|size)-(\d+(?:\.\d+)?)$/);
  const bareValue = bare?.[1];
  if (bareValue) return parseFloat(bareValue) * 4;
  const arbitrary = token.match(/^(?:min-)?(?:[hw]|size)-\[(\d+(?:\.\d+)?)(px|rem)\]$/);
  const arbitraryValue = arbitrary?.[1];
  const arbitraryUnit = arbitrary?.[2];
  if (arbitraryValue && arbitraryUnit) {
    return parseFloat(arbitraryValue) * (arbitraryUnit === 'rem' ? 16 : 1);
  }
  return null;
}

/**
 * Whether an element's own class set guarantees a ≥44×44 hit box in the base
 * (mobile) state. Three sanctioned mechanisms:
 *  1. `tap-target` — the ::after pseudo-element grows the hit region (§10b).
 *  2. `min-h-11` without `min-w-0` — the CSS rule gives such buttons both axes.
 *  3. Explicit size tokens on both axes (h-11 w-11, h-12 w-12, size-11, …).
 * Responsive variants (sm:h-11) deliberately do not count: they say nothing
 * about the phone. `min-w-0` opts out of mechanism 2 on purpose — that is the
 * class a flexible text column asks through, and the CSS honours it.
 * Mechanism 4 is the documented stretched-link overlay: a box declared to
 * fill its parent (inset-0, or h-full w-full) — the card's media area, which
 * the layout keeps well over 44px — so the size is inherited rather than
 * declared; the pixel truth of that inheritance is e2e's job.
 */
export function guarantees44px(el: Element): boolean {
  const cls = typeof el.className === 'string' ? el.className : (el.getAttribute('class') ?? '');
  const tokens = cls.split(/\s+/);
  if (tokens.includes('tap-target')) return true;
  if (tokens.includes('inset-0') || (tokens.includes('h-full') && tokens.includes('w-full'))) {
    return true;
  }
  if (tokens.includes('min-h-11') && !tokens.includes('min-w-0')) return true;
  let height = 0;
  let width = 0;
  for (const token of tokens) {
    const px = tokenPx(token);
    if (px === null) continue;
    if (/^(?:min-)?h-/.test(token)) height = Math.max(height, px);
    if (/^(?:min-)?w-/.test(token)) width = Math.max(width, px);
    if (/^(?:min-)?size-/.test(token)) {
      height = Math.max(height, px);
      width = Math.max(width, px);
    }
  }
  return height >= 44 && width >= 44;
}

function describe(el: Element): string {
  const name = el.getAttribute('aria-label') || (el.textContent ?? '').trim().slice(0, 24);
  const cls = (typeof el.className === 'string' ? el.className : '').slice(0, 60);
  return `${el.tagName.toLowerCase()}${name ? ` «${name}»` : ''} [${cls}]`;
}

function isRenderedTarget(el: Element): boolean {
  if (el.closest('[aria-hidden="true"]')) return false;
  if (el.closest('[hidden]')) return false;
  if ((el as HTMLButtonElement).disabled) return false;
  return true;
}

function hasAccessibleName(el: Element): boolean {
  if (el.getAttribute('aria-label')?.trim()) return true;
  if (el.getAttribute('aria-labelledby')) return true;
  if (el.getAttribute('title')) return true;
  return [...el.querySelectorAll('img')].some((img) => img.getAttribute('alt')?.trim());
}

/**
 * Audit a rendered tree. Icon-only interactive elements must guarantee a 44×44
 * hit box and resolve an accessible name; every img must carry an alt
 * attribute. Elements inside aria-hidden subtrees are decoration, not
 * interface, and are exempt.
 */
export function auditUx(root: ParentNode): UxViolation[] {
  const violations: UxViolation[] = [];

  for (const el of root.querySelectorAll<HTMLElement>(INTERACTIVE)) {
    if (!isRenderedTarget(el)) continue;
    if ((el.textContent ?? '').trim()) continue; // labeled controls → e2e rect audit
    if (!guarantees44px(el)) {
      violations.push({
        rule: 'touch-target',
        detail: `icon-only ${describe(el)} has no 44×44 guarantee (tap-target | min-h-11 | explicit size)`,
      });
    }
    if (!hasAccessibleName(el)) {
      violations.push({ rule: 'unnamed-control', detail: `icon-only ${describe(el)} resolves no accessible name` });
    }
  }

  for (const img of root.querySelectorAll('img')) {
    if (img.closest('[aria-hidden="true"]')) continue;
    if (!img.hasAttribute('alt')) {
      violations.push({
        rule: 'img-alt',
        detail: `${img.getAttribute('src') ?? 'img'} has no alt attribute`,
      });
    }
  }

  return violations;
}
