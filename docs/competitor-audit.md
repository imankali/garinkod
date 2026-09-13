# Competitor audit — «اگر خریدار یک AI بود، چرا از آن‌ها نمی‌خرید؟»

Five competitor sites in the Iranian agriculture-input space, examined for the
question that matters here: **if the buyer were a machine — a crawler, an LLM
agent, a price-comparison bot — what would stop it buying?**

A machine buyer differs from a human one in one decisive way: it cannot
recover. A human who sees a broken page squints, calls the shop, tries again.
A machine that cannot extract `price` + `currency` + `availability` from a page
returns nothing, and the shop does not exist for it. Every finding below is
either (a) something that makes the price unreadable to a machine, or (b)
something that destroys the trust signal a machine uses to rank.

Evidence is quoted from the pages as fetched on 2026-09-13.

---

## 1. irankeshavarzi.com — prices in ریال on a تومان market

**The finding.** Product prices are published in **ریال**:

> `پک هورتی گرو صد گرمی` — `18,000,000 ریال`

Every other shop in this space prices in تومان. ریال is 1/10 of a تومان.

**Why an AI would not buy.** This is the single most dangerous defect in the
whole audit. A machine that assumes تومان — and every other Iranian shop
trains it to assume تومان — prices this product **ten times too high**. It
does not error; it produces a confidently wrong number, which is worse than
failing. A comparison bot would rank the shop last on price. A purchasing
agent would reject it. The shop loses the sale and never learns why.

**The second finding.** The entire «فروش شگفت انگیز» (amazing sale) section —
the most prominent block on the homepage — is out of stock on every item, and
every one of them still carries a `[خرید]` button:

> `فروش شگفت انگيز پکیج کاشت و تقویت گل` — `ناموجود` — `[خرید]`
> `فروش شگفت انگیز پکیج سبزی کاری` — `ناموجود` — `[خرید]`
> `فروش شگفت انگیز پکیج ابزار هرس درختان` — `ناموجود` — `[خرید]`

A machine reading `availability: OutOfStock` next to a buy button gets two
contradictory signals and cannot tell which is true. Product images in the same
block are dated 2019–2020 (`/uploads/2020-02-24_…`, `/uploads/2019-06-23_…`).

---

## 2. keshavarzionline.com — a broken discount badge on every product

**The finding.** Every single product card on the homepage renders a literal
zero-percent discount badge:

> `0٪` — `کود کامل 20.20.20 بالانس نوتری تک` — `1,960,000 تومان`
> `0٪` — `کود مایع سالت گان ضدشوری` — `5,950,000 تومان`
> `0٪` — `آمیفورت همیار دشت آبرون` — `3,080,000 تومان`

Nine for nine. The discount computation returns 0 and the badge is rendered
without a guard.

**Why an AI would not buy.** A discount field that is always zero is worse
than no discount field: it tells a machine the discount data exists and is
unusable, so it discards the whole signal rather than falling back to the
price. And to a human it reads as a shop whose sale is a lie.

**Second finding — the out-of-stock label is misspelled.** `نامورد` instead of
`ناموجود`, on the homepage, on multiple cards.

**Third finding — the image pipeline is producing garbage filenames.** Real
URLs from the homepage:

```
/categories/12743/%3B.JPG                       ← a literal semicolon
/categories/12737/Capture.jJPG.JPG              ← double extension
/products/11812/conversions/v%2Cyk-20%5Bg%2C-thumb_300.webp
/categories/12741/گالانیس جلو.jpg               ← raw Persian + space in the path
```

**Why an AI would not buy.** These are not cosmetic. A crawler that cannot
fetch the product image cannot verify the product exists, and image-based
matching against a catalogue fails outright.

---

## 3. sam-bazr.com — placeholder text shipped to production

**The finding.** The homepage renders template placeholders verbatim, mixed
into real navigation:

> `Slide خرید کنید dummy در سم بذر`
> `بذر 31 در سم بذر`
> `dummy در سم بذر dummy در سم بذر dummy در سم بذر`

Repeated dozens of times. The word `dummy` appears in the live page text.

**Second finding.** The About page states the catalogue size:

> `34 — تعداد محصولات در حال فروش`

**Why an AI would not buy.** Thirty-four products. A machine comparing
suppliers on coverage ranks this last before it reads a single price. And
`dummy` in the page body is an unambiguous signal that nobody reviewed the
site — which is exactly the inference a ranking system should draw.

---

## 4. mangrow.ir — empty categories and leaked admin pages

**The finding.** The homepage advertises category counts, including zeros:

> `بذر — +0 محصول`
> `کود خانگی — +0 محصول`

A category with zero products, linked, on the homepage.

**Second finding.** The navigation and sitemap expose WordPress/WooCommerce
internals as customer-facing pages:

> `تاریخچه بن ها` (coupon history) · `بلک فرایدی` · `کمبود مواد مغذی _باغی`
> `کمبود مواد مغذی- زراعی` · `کمبود مواد مغذی-صیفی و سبزی`

**Why an AI would not buy.** An empty category is a broken promise the machine
follows and finds nothing behind. Worse, exposed admin taxonomy tells a
crawler the catalogue structure is unmaintained, and tells an attacker where
the coupon system is.

---

## 5. parsiano.ir — a marketplace with no machine-readable price

**The finding.** This is the closest structural competitor to garinkod's
marketplace: farmer-to-buyer, direct, no middleman. Its pricing model is:

> `استعلام قیمت روز محصولات کشاورزی به صورت آنلاین و تماس تلفنی، توسط قیمت‌های
> پیشنهادی کشاورزان انجام می‌شود`

Prices are obtained **by telephone**. There is no cart and no published price.

**Why an AI would not buy.** Total exclusion. A machine cannot make a phone
call. This marketplace is invisible to every automated buyer, price comparison
service and AI procurement agent in existence — which is a structural ceiling
on its addressable market, not a minor UX flaw.

---

## Audit of this site against each finding

Checked by command in this repository, not assumed.

| Competitor flaw | Present here? | Evidence |
|---|---|---|
| Currency ambiguity (ریال vs تومان) | **No** | 0 occurrences of `ریال` in `garinkood/shop` + `frontend/src`; 57 of `تومان`; a single `formatPrice()` helper. Only schema.org converts to ISO 4217 `IRR` (×10), which is correct. |
| `0٪` discount badge | **No** | `ProductCard.tsx:93` guards with `{discountPercent > 0 && …}` |
| Out-of-stock item with a buy button | **No** | `ProductCard.tsx:296` `disabled={!product.inStock}`, and the label switches to `اطلاع از موجودی` |
| Placeholder / `dummy` text | **No** | — |
| Empty linked categories | Not verified | Requires a running catalogue; no browser here |
| Broken image filenames | Not verified | Requires inspecting generated renditions in a browser |
| Price only by phone | **No** | Prices are on the page and in structured data |
| **Machine can read price + currency + availability** | **Was NO — now yes** | See below |

### The one flaw we did have, and it was the worst kind

`ProductPage.tsx` published the **raw** price to schema.org:

```js
price: product.price * 10,   // ← not the discounted price
```

Every human-readable screen showed `discounted_price` while the one thing a
machine reads declared the full amount. That is finding #1 from
irankeshavarzi.com in a subtler form: the structured data disagreed with the
visible page. Google flags it as a price mismatch; an AI buyer prices the
order wrong.

**Fixed**, and while fixing it the quantity ladder was published as data rather
than as Persian prose, using the schema.org-native form:

```js
price: (product.discounted_price ?? product.price) * 10,
priceSpecification: {
  '@type': 'UnitPriceSpecification',
  priceCurrency: 'IRR',
  price: (product.discounted_price ?? product.price) * 10,
  eligibleQuantity: { '@type': 'QuantitativeValue', minValue: cheapestRung.min_quantity, unitCode: 'C62' },
}
```

This is the direct answer to the question this audit was built around. A
tiered discount drawn as a table of Persian text is invisible to a machine —
it has to *guess* the price at 40 units, and a guess about a price is the one
guess it must never be allowed to make. `UnitPriceSpecification` +
`eligibleQuantity` is the standard way to say "40 of these cost this each", and
now the ladder is machine-readable.

Two further instances of the same raw-vs-discounted bug were found and fixed in
the same pass — `CartItem.base_unit_price` and `PriceTierSerializer.get_unit_price`
— with a regression test (`LadderMatchesCartTests`) asserting that the ladder a
buyer is shown equals what the cart charges.

---

## What this changes about the roadmap

1. **A price must exist as data on every page that sells something.** No
   «تماس بگیرید» on a purchasable product. Where a price genuinely cannot be
   published, publish `priceSpecification` with no price and say why, rather
   than omitting the offer entirely.
2. **Structured data must be tested, not just emitted.** The `price` field was
   wrong for an unknown period and nothing caught it. It should have a test
   asserting it equals the discounted price.
3. **Empty states must not be linked.** A category with no products should not
   appear in navigation.
4. **Image filenames are part of the product record.** Generated renditions
   need a slugifier, not raw `basename()`.
