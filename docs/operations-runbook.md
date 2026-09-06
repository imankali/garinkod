# GarinKood operations runbook

This document is an operator checklist, not evidence that any external service
is currently connected. Values, provider accounts, alerts and recovery drills
must be verified in each environment.

## 1. Runtime topology

Run these as independently supervised processes:

1. Django WSGI/ASGI web workers behind a TLS reverse proxy.
2. `python manage.py process_notifications --watch` for the durable outbox.
3. PostgreSQL 16 with encrypted, tested backups.
4. Shared Redis for cache, DRF throttles and OTP per-phone limits.
5. Static frontend build served by a CDN/web server. Browser requests to
   `/api`, `/admin`, `/static` and `/media` must remain same-origin or follow the
   explicit CORS/CSRF allowlist.

Optional S3, Meilisearch, Sentry and provider APIs are separate failure domains.
The site must keep its documented fallback when each optional dependency is
disabled or unavailable.

## 2. Release gate

Run from a clean checkout using the exact production lockfiles:

```bash
cd garinkood
python -m pip install -r requirements-dev.txt
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py spectacular --validate --file /tmp/openapi.yml
python manage.py test shop
python manage.py check --deploy --fail-level WARNING
python manage.py collectstatic --noinput

cd ../frontend
npm ci
npm run type-check
npm run lint
npm run build
npm audit
```

The backend suite must also pass against the same PostgreSQL major version used
in production. Inspect the generated `frontend/dist/sw.js`: it must import
`push-sw.js`, contain the `/api` navigation denylist, and contain only one
precache entry for the helper.

Do not deploy if schema validation emits errors, migrations drift, the frontend
build fails, or a deployment warning has not been accepted with a written
reason.

## 3. Deployment sequence

1. Announce the change window and identify the rollback owner.
2. Record the current application image/commit and database migration head.
3. Take a PostgreSQL backup and verify that it can be listed/read.
4. Deploy to staging, run migrations, smoke tests and one representative order.
5. Put secrets in the runtime secret manager, never in an image or `VITE_*`.
6. Deploy backend code compatible with both old and new schema when a rolling
   deployment is used.
7. Run `python manage.py migrate --noinput` once from a release job.
8. Deploy frontend assets and web workers, then the outbox worker.
9. Verify liveness, privileged readiness, login, catalogue, cart, checkout in a
   non-money method, order lookup and admin access.
10. Verify logs/metrics and hold the release open long enough to observe errors.

### Rollback

- Roll application images back first when the migration is backward-compatible.
- Never reverse a data/destructive migration blindly. Read its `RunPython` and
  dependency chain, take another backup, and rehearse the reverse in staging.
- Payment and notification rows are audit/idempotency records; do not delete
  them to “retry” an incident.
- If frontend rollback changes service-worker assets, keep hashed assets from
  the previous release available until clients have updated.

## 4. Health and monitoring

| Endpoint/signal | Exposure | Expected use |
|---|---|---|
| `/health/live/` | public | Load-balancer process check; returns only `{"status":"ok"}` |
| `/ops/health/ready/` | staff or operations token | Database, cache and default-storage dependency check |
| `/ops/metrics/` | staff or operations token | Prometheus scrape |
| structured stdout | log pipeline only | JSON in production; redact secrets and capability URLs |
| Sentry | optional | Disabled without DSN; default PII remains off |

Use a high-entropy `OPERATIONS_TOKEN`, transmit it only over HTTPS and rotate it
like a password. Prefer a private network and staff/service identity in addition
to the token. A 404 from privileged operations routes without credentials is
intentional.

Suggested alerts (tune from measured traffic):

- readiness failing for two consecutive probes;
- sustained 5xx or latency increase;
- notification rows stuck in `processing`, growing `retry`, or final failures;
- payment verification failures/retries or a callback authority mismatch;
- checkout conflicts above baseline;
- Meilisearch fallback rate spike;
- Axes lockout/throttle spike;
- database disk, connection, replication or backup failure;
- object-storage write failure or unexpected egress growth.

## 5. Database and backup

- Use least-privilege application and migration users where the platform allows.
- Encrypt transport and backups; restrict snapshot access.
- Take automated point-in-time-capable backups appropriate to order volume.
- Quarterly (and before major schema work), restore a backup into an isolated
  environment and run `check`, migration status and representative order lookup.
- Define RPO/RTO with the business owner. Until measured and approved, no RPO or
  RTO is claimed by this repository.
- Retain order/payment/audit data according to applicable accounting and privacy
  obligations, then delete data that no longer has a lawful operational need.

## 6. Payment incident procedure

1. Disable the provider switch (`PAYMENT_ENABLE_ZARINPAL=False`) if new requests
   must stop. Existing order records remain readable.
2. Do not mark an order paid from a browser callback alone. The implementation
   independently verifies authority, persisted amount and `IRT` currency.
3. Search by order code and `PaymentAttempt.external_reference`; compare the
   provider dashboard without copying secrets into tickets.
4. Retry only through the idempotent verification/restart flow. Do not create
   rows or coupons manually unless an audited business procedure authorizes it.
5. Reconcile paid provider transactions against local paid attempts/orders and
   investigate both missing and duplicate-looking records.
6. Refunds require a provider-side refund/reconciliation workflow; changing an
   order to cancelled is intentionally blocked while payment is active/paid.

## 7. Notification worker

- Run exactly as a supervised process with restart/backoff:
  `python manage.py process_notifications --watch`.
- Watch oldest pending age, attempts, final failures and worker liveness.
- A provider outage should produce retry rows, not block checkout.
- Do not run with `MESSAGING_FAKE=True` in production; the deployment check
  rejects it.
- Rotate SMS/Bale/Telegram/WhatsApp credentials independently and send a test to
  a controlled destination after rotation.
- WhatsApp callbacks require both verify token and HMAC app-secret validation.

## 8. Search operations

External search remains behind both `MEILISEARCH_ENABLED` and Waffle flag
`external_search`. Initial rollout:

```bash
python manage.py sync_search_index --batch-size 500
```

Confirm index count and representative Persian searches, then enable the flag
for staff/a small percentage before broad rollout. The command builds a fresh
index and swaps it atomically. On an outage, disable the flag or setting; ORM
search remains authoritative and external IDs are always filtered through the
published database queryset.

## 9. Media/S3 operations

Before setting `MEDIA_STORAGE_BACKEND=s3`:

- create a private bucket and least-privilege IAM identity/role;
- test upload, read, overwrite behavior, delete and large files;
- configure only required CORS origins;
- decide whether signed URLs (`S3_QUERYSTRING_AUTH=True`) or a controlled CDN
  are required;
- configure encryption, versioning/lifecycle, backup and malware/content review;
- monitor storage and egress cost.

A successful Django readiness storage probe proves basic read/write, not policy,
backup, CDN or provider durability.

## 10. Web Push and privacy analytics

Web Push requires valid VAPID keys, HTTPS, the outbox worker and Waffle flag
`web_push`. Test subscribe, delivery, click navigation, unsubscribe and account
switching in each supported browser. Never log the full Push endpoint or keys.

Analytics requires both frontend build values and Waffle flag
`privacy_analytics`. The script is loaded only after explicit opt-in. Confirm the
privacy page and consent reset control before rollout. Changing provider,
retention, data residency or script URL requires another privacy review.

## 11. Secret rotation

Maintain an inventory and owner for Django `SECRET_KEY`, DB/Redis, operations
token, VAPID private key, S3, Sentry and messaging/payment credentials. Rotation
must include:

1. create new credential with least privilege;
2. deploy using dual-key overlap when provider supports it;
3. verify health and a controlled transaction/message;
4. revoke old credential;
5. record date, owner and evidence without recording the secret itself.

Changing `SECRET_KEY` invalidates signed values/sessions; schedule accordingly.
Changing VAPID keys invalidates existing Push subscriptions and needs explicit
customer re-enrolment planning.

## 12. Capacity, the waiting room and the error notebook

The shop measures its own box and can hold the door when the line gets long.
Both halves are off or inert until an operator says otherwise.

**Where the numbers come from.** `shop/capacity.py` reads `/proc/meminfo`, the
cgroup memory ceiling (`memory.max`, else `memory.limit_in_bytes`), the CPU
allowance (`sched_getaffinity` intersected with `cpu.max`), load average and
`shutil.disk_usage`. A GPU label is shown only if
`/proc/driver/nvidia/gpus/*/information` exists; nothing is invented as a zero.
`python manage.py shell -c "from shop.capacity import measure_server, effective_limit; print(measure_server().as_dict()); print(effective_limit())"`
prints the same reading the console prints, with the sentence that explains it.

**Raising or lowering the ceiling.** In `/admin/shop/capacitysettings/`:
`users_per_cpu_core` and `users_per_gb_ram` are the weights, `safety_percent`
the headroom, `derate_load_percent` the point where a strained processor starts
shrinking the number, and `activity_window_minutes` how long an idle tab counts
as a visitor. `strategy = fixed` + `fixed_limit` overrides the measurement
entirely — the console and the samples keep saying «عدد دستی پنل» so nobody
mistakes a hand-picked number for a measurement.

**Opening the queue.** `queue_enabled` defaults to **off** and nothing is held
while it is off, whatever the utilisation says. When it is on:

- page requests from a visitor who is not admitted render a self-refreshing
  waiting page from the API process itself (no bundle, no redirect, `noindex`);
- API requests answer `503` with `Retry-After` and `code: "shop_overloaded"`;
  the SPA replaces itself with a queue screen and polls `GET /api/ops/admission/`
  only, which is why a waiting room cannot turn into a stampede;
- `POST`/`PUT`/`DELETE` are never held, `/admin/`, `/media/`, `/static/`,
  `/health`, `/ops/metrics` and the waiting page are never held, and staff are
  never held while `bypass_staff` is on;
- after `queue_max_minutes` a waiting visitor is admitted even if the hall is
  still full. The line delays people; it does not abandon them.

Every branch of the door fails open: an exception inside admission is logged and
the request is served. If the queue ever misbehaves, switch it off in the admin —
no deploy, and nobody inside the shop is asked to leave.

**The notebook.** `SystemLogEntry` receives every `>=500` response (and `429` as
a `notice`), automatic or client-reported, grouped by source + title with a
counter. Bodies are scrubbed before they are stored: password/token/cookie/card/
cvv/otp keys are masked and long values are cut. `GET /api/ops/logs/` and the
console tab read it; `POST /api/ops/logs/<id>/resolve/` marks it fixed, and a
resolved group that fires again reopens on its own.

**If it fills up in production.** Check in this order: the basis sentence in the
console (is the ceiling the box's fault or a fixed number?), the load and free
memory facts, whether one `source` in the log is dominating (one bad view is
cheaper to fix than a bigger server), and only then the plan's size. Presence
and sample tables prune themselves — a day of samples and two days of beats is
kept — so the feature that watches the disk cannot become the thing that fills it.

## 13. Signing in from an embedded preview

A development preview is usually shown inside an iframe of another host. That host is a
third-party context for the browser, and a `SameSite=Lax` cookie is never sent from one —
the shop answers the login with a session cookie, the browser keeps it to itself, and the
next request is a stranger again. The visitor sees «خطا» and is thrown back to the door;
five attempts in five seconds, each with a brand-new session row in `django_session`, and
no error anywhere in the log. Nothing is broken, which is exactly what makes this hard to
spot.

Three things cover it:

- **`GK_PREVIEW_IFRAME_COOKIES=1`** (settings: `PREVIEW_IFRAME_COOKIES`) moves the auth,
  session and CSRF cookies to `SameSite=None; Secure`, which an iframe can carry. It is a
  local switch: production keeps `Lax`, because widening cookie scope for nobody's benefit
  is a CSRF surface. Requires the preview to be served over HTTPS, as the sandbox's is.
- **`shop.W110`** warns at `manage.py check` if the flag is on while `DEBUG` is off — the
  misconfiguration is reported where it is set, not after the outage it prevents.
- **`preview_token`** is the second attempt, for the frames that refuse every cookie. While
  the switch is on *and* `DEBUG` is set, the auth responses carry the same key the HttpOnly
  cookie holds; `api/previewSession.ts` keeps it in that frame's own storage and the axios
  request interceptor sends it as `Authorization: Token …`. `has_operations_access()`
  recognises that header too — the operations endpoints are plain Django views, and without
  the lookup the console would answer its own signed-in operator with a 404. Neither half
  of this exists in production: with the switch off the response has no token field, so the
  cookie remains the only credential JavaScript cannot read.
- **Three tiers of keeping it.** The credential is held in memory first (so it survives a
  frame that denies every API of `localStorage`), then in that storage when it answers, and
  only when storage throws as well it is written into the address as `?gk_preview_token=…`
  and read back by `adoptPreviewTokenFromUrl()` before the router runs — which is what lets a
  reload in a storage-less frame still know who it is. The parameter is removed from the
  address as it is read, and nothing trusts it: an unknown key leaves the visitor a visitor.
  With no cookie at all, `AdmissionMiddleware` recognises the header too, so a signed-in
  operator is tallied as a user and is not queued behind their own shop. A proxy in front of
  the frame can pass the page and drop the header — it has no reason to keep an
  `Authorization` it does not use — so the same key is also sent as `?gk_token=…` on the
  request (`shop/preview.py`), which a rewriting proxy leaves alone because it is the
  address the page is already fetching. It is accepted only while the preview switch is on
  under DEBUG, and recorded nowhere: the error notebook and presence store paths without
  their query strings, and a key nobody recognises authenticates nobody.
- **`CookieJarNotice`** in the SPA verifies a sign-in actually stuck: after every password,
  OTP and registration success the store probes `/api/auth/session/` once, and if the
  session is anonymous — cookie and stored token both refused — it clears the half-logged
  state, keeps the visitor on the form, and says what to do (open the preview in its own
  tab, unblock third-party cookies for the address, leave strict private mode) instead of
  letting them repeat a correct password.

A sandboxed frame usually refuses `window.open` as well, so the notice does not rely on it:
when the call returns nothing, it reveals the address to copy instead of pretending the click
worked.

Two things are worth reading from the server log before blaming the shop: a `POST
/api/auth/login/` returning 200 followed one second later by `GET /api/auth/session/`
returning 401 is the frame refusing cookies, and five new rows in `django_session` inside
five seconds is the same fact seen from the database.

The workaround that needs no flag is the one to reach for first: open the preview in its own
browser tab, where the cookie is first-party and the flow is exactly the one the tests cover.
Django's own `/admin/` stays on that rule — it authenticates from the session cookie alone, so
it is not reachable inside a frame that will not keep one; the staff console at `/management`
is, because it can use the header.
