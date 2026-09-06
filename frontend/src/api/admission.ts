// frontend/src/api/admission.ts
//
// Two halves of the same idea: the shop is allowed to say «not yet» instead of
// «broken», and a screen that dies should be able to say so before it goes.
//
// Both talk to the backend without axios on purpose. This module is imported by
// the axios interceptor and by the error boundary, so a dependency on the client
// would be a cycle — and a component that has just crashed is not in a position
// to run an interceptor chain.

export interface QueueSnapshot {
  /** 1-based place in line; 0 when the shop has no line for this visitor. */
  position: number;
  waiting_minutes: number;
  capacity: number;
  max_wait_minutes: number;
}

export interface AdmissionState {
  waiting: boolean;
  snapshot: QueueSnapshot | null;
  /** Set once the visitor is back inside, so the gate can reload exactly once. */
  released: boolean;
}

type Listener = (state: AdmissionState) => void;

let state: AdmissionState = { waiting: false, snapshot: null, released: false };
const listeners = new Set<Listener>();

function publish(next: Partial<AdmissionState>): void {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener(state));
}

/** Called by the response interceptor when the shop answers 503 shop_overloaded. */
export function markWaiting(snapshot?: unknown): void {
  if (state.waiting) return;
  publish({ waiting: true, snapshot: (snapshot as QueueSnapshot) ?? null, released: false });
}

/** The gate calls this when the shop says the visitor is through. */
export function releaseWaiting(): void {
  if (!state.waiting) return;
  publish({ waiting: false, snapshot: null, released: true });
}

export function getAdmissionState(): AdmissionState {
  return state;
}

export function subscribeAdmission(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ========================================
// Reporting a failure from the visitor's own screen
// ========================================

export interface ClientReport {
  title?: string;
  message: string;
  path?: string;
  source?: string;
  level?: 'error' | 'warning' | 'notice';
  /** What the visitor typed about it, if they typed anything. */
  note?: string;
  context?: Record<string, unknown>;
}

export interface ClientReportResult {
  reported: boolean;
  id?: number;
  count?: number;
}

let lastReportAt = 0;
const REPORT_COOLDOWN_MS = 20_000;

/**
 * Send one crash to `/api/system/report/` without waiting for it.
 *
 * `keepalive` is the reason this is a bare `fetch` rather than a normal call: a
 * React tree that has just thrown is often followed by a reload, and a request
 * that dies with the page tells the shop nothing. The cooldown is what keeps one
 * broken component from filing fifty reports a minute — the backend groups
 * repeats into a counter anyway, and so should the browser.
 */
export function reportClientError(report: ClientReport): Promise<ClientReportResult> {
  const message = (report.message || '').slice(0, 4000);
  const note = (report.note || '').slice(0, 1200);
  if (!message.trim() && !note.trim() && !report.path) {
    return Promise.resolve({ reported: false });
  }

  const now = Date.now();
  if (!note && now - lastReportAt < REPORT_COOLDOWN_MS) {
    return Promise.resolve({ reported: false });
  }
  lastReportAt = now;

  const body = JSON.stringify({
    title: report.title?.slice(0, 200),
    message,
    note,
    path: (report.path || (typeof window === 'undefined' ? '' : window.location.pathname) || '').slice(0, 200),
    source: report.source || 'frontend',
    level: report.level || 'error',
    context: report.context,
  });

  if (typeof fetch !== 'function') return Promise.resolve({ reported: false });

  return fetch('/api/system/report/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    credentials: 'same-origin',
    keepalive: true,
  })
    .then((response) => (response.ok ? response.json() : null))
    .then((data: ClientReportResult | null) => ({ reported: Boolean(data?.reported), id: data?.id, count: data?.count }))
    .catch(() => ({ reported: false }));
}
