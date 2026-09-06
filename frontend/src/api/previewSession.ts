// frontend/src/api/previewSession.ts
//
// Where a preview keeps its credential when the browser will not keep a cookie.
//
// The sandbox shows the shop inside an iframe of another origin, and such a frame is a
// third-party cookie context: some browsers refuse to store the session cookie at all,
// whatever SameSite says, and the visitor is thrown out after every sign-in. When the
// preview switch (GK_PREVIEW_IFRAME_COOKIES) is on under DEBUG, the auth endpoints hand
// the same token to the page once, and this module is where it lives — this frame's own
// storage, sent back as an Authorization header.
//
// It is a preview affordance and nothing else. The response includes the field only while
// that flag is set with DEBUG, so on the real shop there is no token for JavaScript to
// hold, and the HttpOnly cookie remains the whole of the session.

const STORAGE_KEY = 'garinkood:preview-token';

/** The saved preview token, or '' when there is nothing (or storage is denied). */
export function readPreviewToken(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    // Storage can be denied outright by a hardened browser — which is precisely the
    // case this file exists for, so it must never be the thing that throws.
    return '';
  }
}

export function writePreviewToken(token: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, token);
  } catch {
    // Nothing to retry: the notice tells the visitor what to change instead.
  }
}

export function clearPreviewToken(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignored for the same reason as above.
  }
}
