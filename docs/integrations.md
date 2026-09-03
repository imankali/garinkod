# Optional integrations and operating cost

Every integration is **disabled by default**. Configuration makes code eligible
to run; it does not prove that a merchant/carrier/provider account is approved,
funded, legally usable, or successfully verified.

## Activation model

Use this order for every provider:

1. Complete the provider contract, privacy/security review and account approval.
2. Store credentials in the deployment secret manager.
3. Enable the backend setting in staging only.
4. Run provider sandbox/test-destination checks and document evidence.
5. Synchronize data if needed (for example, search index).
6. Enable the corresponding Waffle flag for staff or a small cohort.
7. Monitor errors, latency and cost before expanding rollout.
8. Keep a tested kill switch and local fallback.

## Integration matrix

| Capability | Packages/API | Kill switch / rollout | Recurring operator work and cost |
|---|---|---|---|
| Zarinpal | official v4 HTTPS API, `requests` | `PAYMENT_ENABLE_ZARINPAL`; no Waffle flag for money safety | Merchant fees, reconciliation, refunds/disputes, callback monitoring and credential rotation. **High business criticality.** |
| SMS.ir / Kavenegar | official provider APIs | `MESSAGING_ENABLE_SMS`, `SMS_PROVIDER` | Per-message charge, approved OTP template, sender line, delivery monitoring and abuse spend caps. |
| Bale | official Safir + Bot API | `MESSAGING_ENABLE_BALE` | Template/account maintenance and delivery support; OTP availability must have a fallback. |
| Telegram | official Bot API | `MESSAGING_ENABLE_TELEGRAM` | Bot token rotation and chat membership; intended for controlled administrative alerts. |
| WhatsApp | Meta Cloud API | `MESSAGING_ENABLE_WHATSAPP` | Conversation fees, business verification, approved templates, API version upgrades, webhook/HMAC monitoring. |
| Web Push | `pywebpush`, browser Push API, Workbox | `WEBPUSH_ENABLED` + `web_push` flag | Low provider cost, but browser compatibility, expired subscriptions, key rotation and worker monitoring remain. |
| Meilisearch | `meilisearch` SDK/server | `MEILISEARCH_ENABLED` + `external_search` flag | Hosted fee or server/RAM, upgrades, backups and index rebuilds. ORM fallback means it is optional. |
| S3-compatible media | `django-storages`, `boto3` | `MEDIA_STORAGE_BACKEND=local|s3` | Storage, requests/CDN/egress, IAM/CORS, lifecycle and backup. Readiness is only a basic probe. |
| Sentry | official Django/React SDKs | blank DSN disables each side | Event quota, source-map/release process, alert tuning, retention and privacy review. PII is off by default. |
| Aggregate analytics | consent component + Plausible-compatible manual script | frontend values + `privacy_analytics` flag | Hosted/self-host cost, consent/policy upkeep and data-retention review. No script loads before opt-in. |

## Zarinpal

Backend settings:

```env
PAYMENT_ENABLE_ZARINPAL=False
ZARINPAL_MERCHANT_ID=
ZARINPAL_SANDBOX=True
PAYMENT_CALLBACK_BASE_URL=https://staging.example.com
PAYMENT_HTTP_TIMEOUT=10
```

The implementation derives amount from the persisted order, sends `IRT`, stores
the authority before redirect, verifies authority/amount/currency server-side,
and treats provider codes 100 and 101 through one locked local idempotency
boundary. Do not alter catalogue تومان amounts by a factor of ten.

Before production:

- use a provider-issued sandbox merchant identity;
- verify accepted, cancelled, rejected, timeout and replayed callbacks;
- verify the exact HTTPS callback in provider settings and reverse proxy;
- reconcile provider reference IDs to local attempts;
- define an audited refund and support procedure.

## Shipping and tracking

`FlatRateShippingProvider` is deterministic and makes no carrier claim. Checkout
persists a `Shipment`; customers see only shipments attached to orders they can
access. Staff with `add_shipmenttrackingevent` or `change_shipment` can append a
validated event through:

```text
POST /api/management/shipments/{uuid}/events/
```

The write is audit logged and `provider_event_id` is idempotent. Direct admin
events use the same signal path. Older events remain visible for audit but do
not regress shipment/order status.

No live Postex/Tipax/Chapar adapter is enabled because a complete authoritative
contract, credentials and provider-side verification are not present. Add one
only behind the existing `ShippingProvider` contract, with signed callbacks,
provider ID uniqueness, timeouts, retry policy and contract fixtures.

## Messaging and OTP

See [messaging-hub.md](messaging-hub.md) for exact channel settings and webhook
behavior. Key rules:

- OTP is immediate but per-phone/IP/cooldown limited.
- Commerce messages are outbox rows and never provider calls inside checkout.
- Customer status channels are opt-in.
- `MESSAGING_FAKE` is local-test-only and fails production checks.
- A provider “accepted” response is not the same as delivered; delivery state is
  retained separately where the provider supplies callbacks.

## Meilisearch

```env
MEILISEARCH_ENABLED=False
MEILISEARCH_URL=https://search.example.com
MEILISEARCH_API_KEY=
MEILISEARCH_PRODUCTS_INDEX=products
MEILISEARCH_TIMEOUT_SECONDS=1.5
```

After credentials/network policy are ready:

```bash
python manage.py sync_search_index --batch-size 500
```

The database remains authoritative for published/available filtering. Timeout,
invalid responses and SDK/network failure transparently use ORM search and emit
a metric/log rather than breaking the catalogue.

## Web Push

Generate a dedicated VAPID keypair outside source control:

```env
WEBPUSH_ENABLED=False
WEBPUSH_VAPID_PUBLIC_KEY=
WEBPUSH_VAPID_PRIVATE_KEY=
WEBPUSH_VAPID_SUBJECT=mailto:ops@example.com
```

Then enable Waffle flag `web_push`. API responses expose only a SHA-256 endpoint
fingerprint; endpoint/key material is write-only. Unsubscribe is scoped to the
current user's subscription ID, so disabling one browser does not remove every
device. Push dispatch reuses the notification outbox.

## S3-compatible media

```env
MEDIA_STORAGE_BACKEND=s3
S3_BUCKET_NAME=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_ENDPOINT_URL=
S3_REGION_NAME=
S3_CUSTOM_DOMAIN=
S3_QUERYSTRING_AUTH=True
```

Runtime IAM roles are preferred where available, so static access keys may be
blank. The deployment must still validate bucket policy, signed/public URL
behavior, CORS, upload limits, encryption, lifecycle and restore capability.
Static assets remain on WhiteNoise; this switch concerns user/media files.

## Error reporting

Backend:

```env
SENTRY_DSN=
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0
```

Frontend (public build settings):

```env
VITE_SENTRY_DSN=
VITE_SENTRY_ENVIRONMENT=production
VITE_SENTRY_TRACES_SAMPLE_RATE=0
```

Start traces at zero or a very small measured sample. Never put auth tokens,
Push endpoints, full addresses or provider secrets in tags/breadcrumbs.

## Consent-based aggregate analytics

Frontend:

```env
VITE_ANALYTICS_DOMAIN=example.com
VITE_ANALYTICS_SCRIPT_URL=https://plausible.io/js/script.manual.js
```

Both values and Waffle flag `privacy_analytics` are required. Invalid/non-HTTPS
script URLs are rejected by the client, the default state is no consent, and a
visitor can reopen privacy settings from the footer. Review the legal text,
provider hosting region and retention before enabling it.

## Packages deliberately not added

- A second auth/JWT/social-auth stack: the HttpOnly token/OTP system already
  owns authentication; another stack would increase account/linking risk.
- Celery: the project already has a durable, locked outbox worker. Celery would
  be justified only when multiple unrelated background workloads and scheduler
  needs exceed this worker, and would add broker/result/worker operations.
- Elasticsearch/OpenSearch: Meilisearch plus ORM fallback meets the observed
  catalogue need with lower operational weight.
- A second audit/event system: `AdminAuditLog` covers business actions and
  simple-history covers selected snapshots/reversion.
- Carrier aggregator SDKs based only on third-party documentation: they cannot
  establish an official, supportable provider contract.
- Google Analytics by default: optional aggregate analytics with explicit
  consent is narrower and avoids an overlapping analytics path.
