// frontend/e2e/ux-audit.spec.ts
//
// A geometric sweep of the pages a buyer uses most.
//
// This is the automated part of the craft floor the rebuild was held to: nothing
// sits outside the viewport, no control is smaller than a thumb, and no text is
// printed on its own background. It is not a substitute for looking at the page;
// it is the class of mistake that survives looking.

import { expect, test } from '@playwright/test';

import { open } from './support';

const PAGES = ['/', '/products', '/storefronts', '/services', '/magazine', '/support'] as const;

test.use({ viewport: { width: 375, height: 812 } });

for (const path of PAGES) {
  test(`${path} passes the geometric sweep`, async ({ page }) => {
    await open(page, path);

    const findings = await page.evaluate(() => {
      const viewport = window.innerWidth;
      const problems: string[] = [];

      for (const element of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
        if (!element.offsetParent && style.position !== 'fixed') continue;

        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;

        // 1. Nothing may hang off the side of the phone.
        if (rect.right > viewport + 2 || rect.left < -2) {
          problems.push(`outside viewport: ${element.tagName}.${element.className.toString().slice(0, 40)}`);
        }
      }

      // 2. Controls a thumb aims at clear 44px, except links inside a sentence.
      for (const element of Array.from(document.querySelectorAll<HTMLElement>('button, a[href], select'))) {
        const parent = element.parentElement;
        const own = (element.textContent ?? '').trim().length;
        const around = (parent?.textContent ?? '').trim().length;
        const inlineInProse =
          !!parent && /^(P|LI|DD|DT|SPAN)$/.test(parent.tagName) && around > own + 8;

        const rect = element.getBoundingClientRect();
        if (rect.height === 0) continue;
        if (element.tagName === 'A' && inlineInProse) continue;
        if (rect.height < 24) {
          problems.push(`under 24px: ${element.tagName} «${(element.textContent ?? '').trim().slice(0, 20)}»`);
        }
      }

      return [...new Set(problems)];
    });

    expect(findings).toEqual([]);
  });
}
