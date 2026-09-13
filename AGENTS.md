# AGENTS.md — گرین کود / garinkod

Working agreement for any AI agent on this repository. Read this before
changing anything. It records what the project is, what has actually been
verified, what is still open, and the rules that were learned the hard way.

**The single most important rule:** every claim you make about this codebase
must come from a command you ran in the current session. Do not quote a
previous run, a CI badge, or your own earlier reasoning as though it were a
measurement. If you could not check something, say so in the same sentence as
the claim.

---

## 1. What this project is

A Persian (RTL), agriculture-input commerce platform — fertiliser, pesticide,
seed, equipment — plus a farmer-to-buyer marketplace.

| Layer | Stack | Path |
|---|---|---|
| Backend | Django + DRF, SQLite in dev | `garinkood/` |
| Frontend | React 19, Vite, Tailwind, Zustand, react-router | `frontend/` |
| E2E | Playwright | `frontend/e2e/` |
| CI | GitHub Actions | `ci/workflows/` |

Note the doubled directory name: the Django project lives at
`garinkood/garinkood/`, and commands run from `garinkood/`.

---

## 2. Environment — the part that costs agents the most time

```bash
# Every Django command needs these, or settings will not import:
source /tmp/env.sh
# which sets: DEBUG=True DB_ENGINE=sqlite SECRET_KEY=ci-only-test-key-not-for-production

cd garinkood
../.venv/bin/python manage.py test          # NOT python3 — the venv has PyYAML, python3 does not
```

`npx tsc -b` fails with `TS6310: Referenced project 'tsconfig.node.json' may
not disable emit`. That is a pre-existing config quirk, not your change. Use
plain `npx tsc --noEmit`.

Frontend tests must run as `CI=true npx vitest run`. Without `CI=true` vitest
watches and never exits.

---

## 3. Test protocol — run all of it, every time

The standing instruction from the project owner is explicit: after every
change, review the code and then run the full matrix in detail.

| Suite | Command | Last verified |
|---|---|---|
| Backend unit + integration | `cd garinkood && source /tmp/env.sh && ../.venv/bin/python manage.py test` | **624 tests, OK** |
| Backend, tier module only | `... manage.py test shop.tests_price_tiers` | 41 tests, OK |
| Frontend unit + integration | `cd frontend && CI=true npx vitest run` | **190 tests / 24 files** |
| Type check | `cd frontend && npx tsc --noEmit` | clean |
| Build | `cd frontend && npm run build` | ✓ |
| Design linter | `.agents-tmp/node_modules/.bin/impeccable detect frontend/src` | 125 (see §6) |
| E2E | `cd frontend && npx playwright test` | **never run locally — see §7** |

`manage.py test` (all apps) and `manage.py test shop` are different scopes and
give different counts. Say which one you ran.

---

## 4. Pricing invariants — do not break these

Pricing is the part of this codebase where a silent change costs real money.
These were each found as an actual bug.

**One price, everywhere.** Every surface that shows a price and the cart that
charges it must read the same property: `discounted_price`.

- `Product.discounted_price` — `catalog.py:181`
- `ProductPackage.discounted_price` — `catalog.py:342`
- `MarketplaceListing.discounted_price` — `marketplace.py:237`

Three separate bugs came from a code path reading the raw `price` field
instead:

1. `CartItem.base_unit_price` charged the raw price, so the site advertised
   `discount_percent` on the product page and never applied it at checkout.
2. `PriceTierSerializer.get_unit_price` computed the ladder off the raw price
   while the cart applied it to the discounted one — the ladder table
   contradicted the checkout.
3. `ProductPage.tsx` published `product.price * 10` to schema.org while every
   human-readable screen showed the discounted figure.

If you add a new price surface, read `discounted_price` and add a test that
asserts it equals what the cart charges. `LadderMatchesCartTests` is the
template.

**Order of operations.** Site-wide `discount_percent` first, then the quantity
ladder off the result. That is the order a buyer reads them in, and it is the
cheaper of the two readings — the direction a pricing ambiguity should always
resolve in. Pinned by
`CartTierPricingTests.test_the_two_discounts_stack_in_a_defined_order`.

**The order ceiling must agree with the ladder.** A catalogue product is capped
at ten units per cart line (`max_order_quantity`, `catalog.py`) — a fat-finger
guard, not a business rule. `max_order_quantity` raises it to the product's top
rung when the product declares a ladder, because a merchant who sets a rung at
40 is explicitly saying the product sells in bulk. The client mirrors this in
`CartDrawer.productOrderCeiling`; if the two disagree the plus button stops
responding at ten and the ladder nudge becomes a control that does nothing.

**Never clamp a request silently.** The cart used to rewrite an over-ceiling
quantity down without responding, which is precisely how the ladder bug stayed
hidden: the buyer was offered 20 at a discounted price, got 10 at the full
price, and saw no message. An over-ceiling update now returns 409.

**Ladder semantics.** Rungs never stack; only the highest reached applies.
`min_quantity` is inclusive and ≥ 2. Rounding is down. A packaging row inherits
its product's ladder.

**Never change revenue-bearing behaviour silently.** If you find a pricing bug,
report it and wait for a decision. The one above was reported before being
fixed, and that was the correct sequence — fixing it moved every existing
order total.

---

## 5. Motion — GSAP

`gsap@3.15` with ScrollTrigger, SplitText and Draggable, all loaded
dynamically through `src/utils/motion/gsap.ts`. Components live in
`src/components/motion/`.

Rules:

1. **Content is present before the library arrives.** GSAP animates *from* a
   visible state; it never reveals a hidden one. This is the difference between
   a flourish and an outage: a dropped chunk must not blank the hero.
2. **One scroll clock.** ScrollTrigger is registered once, globally.
3. **Reduced motion disables the animation, never hides the content.**
4. **Every helper returns a teardown.** StrictMode mounts twice.
5. **One easing**, `power3.out`, set as a gsap default. Do not invent curves per
   component.

**ScrollSmoother is deliberately not wired up.** It reparents the DOM and
would break the `position:fixed` header, cart drawer and modals, plus the 227
e2e layout assertions. Do not enable it without rewriting that chrome.

Read `.agents/skills/sheleg-design/MOTION_DOCTRINE.md` before adding animation
— it answers "should this move at all" before "how".

---

## 6. The design linter — and its 124 false positives

`impeccable detect frontend/src` currently reports **125 findings**. Breakdown:

| Rule | Count | Status |
|---|---|---|
| `gray-on-color` | 124 | **All false positives. Do not "fix".** |
| `gradient-text` | 1 | Accepted exception (logo wordmark) |

`gray-on-color` pairs a light-mode `text-slate-*` with a `dark:bg-*` class on
the *same element*. Verified example, `ShopFilterBar.tsx:370`:

```
text-slate-700 ... bg-white ... dark:bg-emerald-950 dark:text-emerald-50
```

`slate-700` goes with `bg-white` (10.3:1); `emerald-50` goes with
`emerald-950`. Both real pairs pass. "Fixing" these would destroy the light
theme. The rule is unusable on any Tailwind codebase that uses `dark:`
variants.

The one remaining `gradient-text` is `Logo.tsx`'s wordmark — a fixed brand
mark on a known background, where the choice is deliberate and documented in
`index.css`.

Fixed in this pass: `ai-color-palette` ×4 (Affiliate page had a violet/indigo
ramp on an emerald brand), `bounce-easing` ×2, `overused-font` ×1 (Inter was
referenced but never loaded), `gradient-text` ×2 (one was on a **price**),
`side-tab` ×1. Count went 135 → 125.

---

## 7. Known gaps — stated plainly, not hidden

- **Playwright has never run in this sandbox.** There is no browser. `npx
  playwright install chromium` fails. The 227 specs are verified only by
  `--list` and CI. Any claim that e2e passes locally is false.
- **`ci/workflows/django.yml` still has `continue-on-error: true`**, so a red
  backend suite does not fail CI. Retained deliberately; it should be removed
  once the suite is trusted.
- **No visual verification is possible here.** No screenshot has ever been
  taken of any change in this repository by an agent. Layout and motion claims
  are reasoned, not observed.
- The `image-pipeline-demo` product and the `e2e-moderator` user do not exist
  in the local SQLite database.

---

## 8. Task ledger

### Done and verified

- CSRF cookie root-cause fix; duplicate `robots` meta removed; `min-w-11` touch
  targets; contrast fixes (emerald-600 → emerald-700, `--tap-min: 44px`);
  `E2E_IMAGE_PIPELINE` wiring.
- **Tiered discounts** (`PriceTier`, migration `0045_price_tiers`): model,
  constraints, `CartItem.unit_price`, both product serializers, cart
  serializer, buyer-facing `PriceLadder` table, schema.org
  `UnitPriceSpecification`. 30 backend tests + 6 frontend tests.
- **Discount-at-checkout bug fixed** (§4). 7 tests.
- **GSAP motion layer**: `SplitHeading`, `Parallax`, `Reveal`, `DragRail`,
  wired into `HomeHero`. 10 tests. Verified code-split — ScrollTrigger builds
  as its own 44 kB chunk and never enters the main bundle.
- **Three skills installed** under `.agents/skills/`: UI/UX Pro Max, Impeccable,
  SHELEG Design (272 files).
- **Competitor audit** — `docs/competitor-audit.md`.

### Done — latency, first pass

Measured with `CaptureQueriesContext`, before optimising anything.

| Endpoint | Before | After | ms |
|---|---|---|---|
| `/api/products/` (12 rows) | 70 queries | **43** | 42.7 → 30.5 |
| `/api/products/<slug>/` | 21 queries | 21 | ~19 |
| `/api/cart/` | 8 queries | 8 | ~4.7 |

Two causes, both found by **grouping queries by table** — the total looks
plausible either way and hides the shape:

- `price_tiers` went onto `ProductListSerializer` with no matching prefetch.
  One extra query per row. **This was introduced by the tiered-discount work.**
- `images` and `packages` were prefetched only on `retrieve`, but the list
  serializer's `image_url` / `image_srcset` / `image_alt_url` method fields
  reach into `obj.images`. 24 queries per twelve-row page, present long before
  the ladder.

`ListEndpointQueryCountTests` pins the list endpoint under 60 queries so the
per-row pattern cannot silently return.

### Open

- [ ] Latency, remaining: 43 queries for a list is still high (33 of them touch
      `shop_product`). Cache headers, gzip/brotli and connection pooling are
      untouched and unmeasured. No production-scale measurement has been taken —
      these are dev-SQLite numbers.
- [x] **Cart row UI** — `CartTierStrip` in every `CartDrawer` row. States the
      next price, not a percentage; suppresses the nudge when the next rung
      exceeds available stock; sets an absolute quantity.
- [x] **Admin surface** — `PriceTierInlineBase` with a read-only *resulting
      unit price* column, wired as inlines on both `ProductAdmin` and
      `AdminMarketplaceListing`. The computed price is read-only on purpose:
      it is derived from `discounted_price`, and letting it be typed in would
      recreate the drift that column exists to prevent.
      Note `extra = 0` renders no blank row, and admin tests need
      `force_login` (django-axes rejects `client.login`) plus a plain
      staticfiles backend (`CompressedManifestStaticFilesStorage` needs a
      manifest that only `collectstatic` writes).
- [ ] Remove `continue-on-error: true` from the Django workflow.
- [ ] Retighten the axe contrast ceilings that were relaxed.
- [ ] Visual/architecture review — **blocked on §7**; needs a browser.

### Blocked in this environment

- Anything needing a browser: Playwright, screenshots, Lighthouse, visual QA.
- `impeccable install` — `impeccable.style` is an unreachable host. The
  detector binary works offline; only the skill markdown cannot be fetched.

---

## 8b. Accessibility — check the DOM, never the source text

**A source-text scan for missing labels cannot work on this codebase.** Three
separate attempts produced false positives, and each is worth recording because
the next agent will be tempted to try the same shortcut:

1. `<img ... alt="…">` spans multiple lines, so a per-line grep reports 47
   images without `alt`. The real number is **0**.
2. `onChange={(event) => …}` contains a `>` character, so a regex tag match
   truncates mid-attribute and misses the `aria-label` further down.
3. `<Field label="…">` renders a `<label>` **at runtime**. No amount of regular
   expressions can see that, so every input inside `Field` / `LabeledField`
   looks unlabelled and is not. `LandFormModal` (11 inputs) and `ContentStudio`
   (7) are entirely false positives.

The only reliable check is the accessibility tree: render the component and ask
whether the control has a name. `LandCalendar.test.tsx` is the template — it
walks every `input, select, textarea` in the rendered DOM and asserts each
resolves a label through `aria-label`, `aria-labelledby`, a wrapping `<label>`,
or `label[for]`.

That DOM check found a `<textarea>` the `<input>`-only scan could not, and it
is the only reason the fix is complete.

Fixed in this pass: 9 controls named only by a placeholder (a placeholder
vanishes on input, renders at reduced contrast, and is announced inconsistently
— so such a control has no reliable accessible name at all, WCAG 4.1.2). The
worst was the review textarea on `ProductPage`, the highest-traffic page, whose
neighbouring file input already had an `aria-label`.

Note: `type="file"` inputs with `className="hidden"` are correct — they are out
of the accessibility tree and triggered by a styled `<button>`.

## 9. Reporting discipline

After every task, report:

1. **What changed**, naming the function or file.
2. **What you ran**, with the actual number it returned — not "tests pass".
3. **What you could not check, and why.** An honest gap costs nothing; a guess
   in the same voice as a verified fact costs a round trip.
4. **What you decided not to change, and why.** Silence about a skipped
   decision reads as an oversight.

Name the code path the test actually executed. A green exit code is not a pass
when the output is wrong, and a compile check executes no path at all.

---

## 10. Conventions worth knowing

- Persian copy in the UI; comments and identifiers in English.
- RTL throughout. `ms-`/`me-`/`ps-`/`border-s` rather than left/right. A
  start-edge accent sits on the **right** in RTL, next to the icon.
- Prices are **تومان** everywhere in code and UI. Only the schema.org
  structured data converts to ISO 4217 `IRR` by ×10. Never introduce ریال.
- One price formatter: `src/utils/formatPrice.ts`. It tolerates
  null/undefined by returning «—» rather than throwing.
- `discounted_price` is a server property, not a client computation.
- Migrations: `makemigrations` then `migrate`, then
  `makemigrations --check --dry-run` to prove no drift.
