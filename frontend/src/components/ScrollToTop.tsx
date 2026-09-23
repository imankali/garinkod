import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';

/**
 * Puts the reader at the top of the new page, and puts the keyboard there too.
 *
 * `window.scrollTo(0, 0)` alone fixes what a sighted reader sees and leaves
 * everything else behind. Measured on this app: after clicking a nav link the
 * document scrolled to the top, the title and `h1` changed — and focus stayed on
 * the link that had just been clicked, which in most cases no longer exists, so
 * it fell back to `<body>`. A screen reader announced nothing at all: from its
 * point of view the page had not changed. A keyboard user's next Tab then
 * continued from wherever the browser decided, not from the new page.
 *
 * So the same effect moves focus to the main landmark, which App already marks
 * with `tabIndex={-1}` for the skip link. That is the standard shape for a
 * single-page app: the region is announced by its name, and the next Tab starts
 * inside the new content rather than at the top of the chrome.
 *
 * Two things it deliberately does not do:
 *
 *   - it does not run on the first render, or every page load would start with
 *     focus already inside the content and the skip link would be pointless;
 *   - it only reacts to `pathname`. Query-string changes are same-page updates —
 *     a filter, a sort, a search — and yanking focus to the top of the document
 *     while someone is narrowing a list is worse than doing nothing.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();
  const isFirstRender = useRef(true);

  useEffect(() => {
    window.scrollTo(0, 0);

    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // `preventScroll` because the scroll above already decided where the page
    // is; letting the focus call scroll as well would fight it on pages where
    // the content has not laid out yet.
    const main = document.getElementById('main-content');
    main?.focus({ preventScroll: true });
  }, [pathname]);

  return null;
}
