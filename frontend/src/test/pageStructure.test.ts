// frontend/src/test/pageStructure.test.ts
//
// Structural rules that hold for *every* route, checked against the source
// rather than against one rendered page.
//
// The defect these lock down was real and site-wide: App.tsx renders the one
// `<main id="main-content">` landmark (the target of the skip link), and thirty
// page components rendered a second `<main>` inside it. Two main landmarks are
// invalid markup, and a screen reader that offers "jump to main" then has to
// choose between them. Page-level wrappers are plain `<div>`s now; this test
// stops the next page from reintroducing the nesting.
//
// The second rule is the one a page can silently lose during a refactor: a
// route with no `<h1>` (and no `PageHeader`, which renders one) has no
// page-level heading at all, so the document outline starts in the middle.

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const pagesDir = path.join(root, 'src', 'pages');
const pageFiles = readdirSync(pagesDir)
  .filter((name) => name.endsWith('.tsx') && !name.endsWith('.test.tsx'))
  .map((name) => path.join(pagesDir, name));

const read = (file: string) => readFileSync(file, 'utf8');
const rel = (file: string) => path.relative(root, file);

describe('page structure', () => {
  it('lets App.tsx own the only <main> landmark', () => {
    const app = read(path.join(root, 'src', 'App.tsx'));
    expect(app.match(/<main\b/g) ?? []).toHaveLength(1);
    // The skip link points at this id, and tabIndex=-1 makes it focusable.
    expect(app).toMatch(/<main\s+id="main-content"/);
    expect(app).toMatch(/id="main-content"[\s\S]{0,120}tabIndex=\{-1\}/);

    const offenders = pageFiles.filter((file) => /<main\b/.test(read(file))).map(rel);
    expect(offenders).toEqual([]);
  });

  it('gives every route a page-level heading', () => {
    const offenders = pageFiles
      .filter((file) => {
        const source = read(file);
        // PageHeader renders the <h1> itself.
        return !/<h1[\s>]/.test(source) && !/<PageHeader[\s>]/.test(source);
      })
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it('opens every route with a skip-link target that is not a nested landmark', () => {
    // A page that wraps itself in <article>/<section> keeps its own semantics;
    // what it must not do is start a second banner/navigation landmark, which
    // would duplicate the header and the mega menu.
    const offenders = pageFiles
      .filter((file) => {
        const source = read(file);
        return /<header\b[^>]*id="main-content"/.test(source) || /<nav\b[^>]*id="main-content"/.test(source);
      })
      .map(rel);
    expect(offenders).toEqual([]);
  });
});
