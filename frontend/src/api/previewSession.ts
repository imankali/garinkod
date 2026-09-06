// frontend/src/api/previewSession.ts
//
// Where a preview keeps its credential when the browser will not keep a cookie.
//
// The sandbox shows the shop inside an iframe of another origin, and such a frame is a
// third-party cookie context: some browsers refuse to store the session cookie at all,
// whatever SameSite says, and the visitor is thrown out after every sign-in. When the
// preview switch (GK_PREVIEW_IFRAME_COOKIES) is on under DEBUG, the auth endpoints hand
// the same token to the page once, and this module is where it is kept — in memory for
// this page view, in the frame's own storage when it allows that, and in the address when
// it allows neither, so a reload still knows who it is.
//
// It is a preview affordance and nothing else. The response includes the field only while
// that flag is set with DEBUG, so on the real shop there is nothing here to keep, and the
// HttpOnly cookie remains the whole of the session.

const STORAGE_KEY = 'garinkood:preview-token';
const URL_PARAM = 'gk_preview_token';

/** The name the API looks for on a request that cannot present a header. */
export const PRESENTED_TOKEN_PARAM = 'gk_token';

/** Held between requests without needing storage — a frame can deny even that. */
let heldToken = '';

function storedToken(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    // Storage can be denied outright by a hardened browser — which is precisely the
    // case this file exists for, so it must never be the thing that throws.
    return '';
  }
}

/** The saved preview token, or '' when there is nothing to send. */
export function readPreviewToken(): string {
  return heldToken || storedToken();
}

/**
 * Keep a token the preview was given, and say whether storage agreed.
 *
 * A false return is not a failed sign-in: memory carries it for this page view and the
 * address carries it into the next one, which is all a session has to survive anyway.
 */
export function writePreviewToken(token: string): boolean {
  heldToken = token;
  try {
    window.localStorage.setItem(STORAGE_KEY, token);
    return true;
  } catch {
    keepInAddress(token);
    return false;
  }
}

export function clearPreviewToken(): void {
  heldToken = '';
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing was kept, which is exactly what clearing it means.
  }
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has(URL_PARAM)) {
      url.searchParams.delete(URL_PARAM);
      window.history.replaceState(window.history.state, '', url.toString());
    }
  } catch {
    // A frame that refuses history still logged out: memory is what gates the app.
  }
}

/**
 * Read the token out of the address, then take it back out of the address.
 *
 * This runs before the router looks at the URL: the parameter exists only to survive a
 * reload in a frame with no storage, and nothing is trusted by being present — it is
 * offered to the API, and a key the shop does not recognise leaves the visitor a visitor.
 */
export function adoptPreviewTokenFromUrl(): void {
  let token = '';
  let clean = '';
  try {
    const url = new URL(window.location.href);
    token =
      url.searchParams.get(URL_PARAM) ??
      new URLSearchParams(url.hash.replace(/^#/, '')).get(URL_PARAM) ??
      '';
    if (url.searchParams.has(URL_PARAM)) {
      url.searchParams.delete(URL_PARAM);
      clean = url.toString();
    }
  } catch {
    return;
  }
  if (clean) {
    try {
      window.history.replaceState(window.history.state, '', clean);
    } catch {
      // The address keeps the token; it is dev-only either way.
    }
  }
  if (!token || heldToken === token) return;
  heldToken = token;
  try {
    window.localStorage.setItem(STORAGE_KEY, token);
  } catch {
    // Memory for this page view; the address still holds it for the next one.
  }
}

/**
 * Put the credential into a URL that is fetched without axios.
 *
 * The waiting room and the «this page errored» report are plain `fetch` calls — they have
 * to keep working when the app is half-dead — and in a preview they are also the requests
 * a proxy may strip of its header. A relative URL comes back a relative URL, so the
 * preview's own host is never rewritten.
 */
export function withPreviewCredential(url: string): string {
  const token = readPreviewToken();
  if (!token) return url;
  try {
    const target = new URL(url, window.location.origin);
    target.searchParams.set(PRESENTED_TOKEN_PARAM, token);
    return `${target.pathname}${target.search}`;
  } catch {
    return url;
  }
}

function keepInAddress(token: string): void {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set(URL_PARAM, token);
    window.history.replaceState(window.history.state, '', url.toString());
  } catch {
    // Without history the sign-in still stands for this page view.
  }
}
