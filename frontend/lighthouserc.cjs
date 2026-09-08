/**
 * Lighthouse CI — performance lockdown for the GarinKood SPA.
 *
 * Local-only by design: reports land in ./.lighthouseci (filesystem target);
 * no LHCI server, no LHCI_GITHUB_APP_TOKEN required.
 *
 * What it guards (the work this config locks in):
 *  - AVIF/WebP <picture> pipeline  → modern-image-formats, uses-responsive-images
 *  - explicit width/height + aspect-ratio → unsized-images, CLS = 0
 *  - eager hero / lazy grid images      → largest-contentful-paint
 *
 * Emulation: Lighthouse's default MOBILE profile (this is the strict gate —
 * the same claims were made for mobile RTL layouts). A desktop pass is a
 * separate npm script: `npm run test:perf:desktop`.
 *
 * Prerequisites: Django API on :8000 (vite preview proxies /api + /media)
 * and a production build: `npm run build` (chained in the npm script).
 */
module.exports = {
  ci: {
    collect: {
      url: [
        'http://127.0.0.1:4173/',
        'http://127.0.0.1:4173/products',
        'http://127.0.0.1:4173/marketplace',
        'http://127.0.0.1:4173/products/image-pipeline-demo/',
      ],
      // Built bundle, same-origin API — identical to what a visitor receives.
      startServerCommand: 'npm run preview -- --host 127.0.0.1 --port 4173',
      startServerReadyPattern: 'Local',
      numberOfRuns: 3, // median of 3 runs is what assertions evaluate (noise control)
      settings: {
        throttlingMethod: 'simulate',
        // No `preset` here: default = mobile emulation (the strict target).
        chromeFlags: ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage'],
      },
    },
    assert: {
      assertions: {
        // ---- hard performance budget (per user spec) -----------------------
        'categories:performance': ['error', { minScore: 0.9 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0 }],
        'total-blocking-time': ['error', { maxNumericValue: 200 }],

        // ---- the image pipeline is the point of these audits --------------
        'modern-image-formats': 'error', // AVIF/WebP must actually be served
        'uses-responsive-images': 'error', // srcset must match display size
        'unsized-images': 'error', // every <img> keeps explicit dimensions

        // ---- accessibility/quality floor (kept from the previous config) --
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.9 }],
        'color-contrast': 'error',
        'heading-order': 'error',
        'image-alt': 'error',
        label: 'error',
        'html-has-lang': 'error',
        'meta-viewport': 'error',
      },
    },
    upload: {
      // Local filesystem reports only — no token, no server.
      target: 'filesystem',
      outputDir: './.lighthouseci',
      reportFilenamePattern: '%%PATHNAME%%-%%DATETIME%%-report.%%EXTENSION%%',
    },
  },
};
