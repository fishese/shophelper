# Shophelper — Implementation Plan

**Status:** Planning / developer handoff  
**Updated:** 2026-11-17  
**Product:** Mobile-friendly collection of small shopping utilities  
**Working principle:** Fast, independent tools with a consistent frame; useful offline; no unnecessary account or back-end requirements.

## 1. Decisions and scope

### Confirmed decisions

- **Home screen:** A grid/list of simple buttons, each with an icon and short tool name. Each tool has its own screen, with a consistent header and Back/Home control. **Do not** merge the tools into one dashboard.
- **Keep the three existing tools' behavior:** Cartulator, Coupon Keeper, and Deal Checker should work as they currently do. Integrate them via a shared frame and narrowly scoped interoperability changes, not a rewrite.
- **Seven tools in the initial release:**
  1. **Cartulator** — trip tally and supermarket deals.
  2. **Coupon Keeper** — coupons, gift cards, and loyalty cards.
  3. **Deal Checker** — compare prices per unit across options.
  4. **Units** — weight, volume, length, temperature, and area conversions; reuse Deal Checker's pack-size units/conversion definitions.
  5. **Currency** — live exchange rates with offline cache, mental-math estimate, and a scratchpad that totals math lines while preserving plain-text notes. Default home currency: **HKD**, user-changeable.
  6. **Tax & Refund** (formerly **Shelf Tax**) — inclusive/exclusive tax calculations, estimated tourist tax refund, **plus built-in refund tracking**.
  7. **Prices** — lightweight product price reference cards fed by Cartulator, Deal Checker, or manual entry.
- **Skip Discount Stack** for now. Do not introduce a separate Discount Stack tool or expand the scope to build one. Keep any already supported promotion calculations in Cartulator unchanged.
- **Refund Tracker is part of Tax & Refund**, not an eighth home-screen tool.
- **Payment Compare** is the leading candidate for an **optional eighth tool, after the seven-tool release**. Design shared currency data to make it easy to add, but do not block the initial launch on it.
- **Bottom results bar** is shared across tools; only results, not complete tool interfaces, move between screens.

### Product boundaries

This is not intended to become a full inventory manager, receipt scanner, household budget, expense ledger, or general shopping-list app. Avoid compulsory logins, unnecessary server storage, and hard dependencies on network access for calculations or local records.

## 2. User experience and navigation

### 2.1 Home screen

- Responsive grid of seven tool entries, with legible icon and name.
- Consistent visual language, typography, spacing, and keyboard behavior across all tools.
- Tapping an entry opens that tool directly; Back/Home returns to Shophelper home.
- Preserve each tool's current working state when navigating away and returning, until explicitly cleared; do not accidentally lose entered calculations.
- The primary tool action should be reachable without extra setup or navigation.

### 2.2 Shared shell

- Same header, title, back navigation, tool content area, and bottom results bar.
- Tool-specific options and Clear/Reset stay inside the individual tool.
- Keep original tool functionality available during integration; use a wrapper or adapter where practical.
- When the on-screen keyboard is visible, the results bar must not obscure the focused input or primary action. Consider collapsing it to a compact trigger while typing.
- Support touch targets, readable labels, accessible navigation, and narrow mobile screens.

### 2.3 Shared settings

- Home currency (default HKD), recent currencies, currency display precision.
- Preferred units and number formatting; do not assume all numeric fields represent money.
- Cached exchange-rate status and manual rate override controls.
- Data backup/restore and exports.
- Avoid shared settings that force unrelated tools to adopt a single behavior.

## 3. Shared result handoff

### 3.1 What appears

The bar includes the latest **main result** for each eligible calculation:

| Tool / calculation | Result available to insert |
| --- | --- |
| Cartulator | Cart total to pay |
| Deal Checker | Best option's total price (not its per-unit price, unless explicitly selected) |
| Units | Converted quantity, with unit |
| Currency | Converted amount, with currency |
| Currency scratchpad | Scratchpad calculated total |
| Tax & Refund | Tax-inclusive / checkout price |
| Tax & Refund | Net estimated refund |

**Coupon Keeper and Prices do not contribute numerical results.** All tools may *consume* compatible results in their amount fields.

### 3.2 Display behavior

- Show the **two or three most recently used** results in the compact bar; allow expanding to the full set.
- Label each result by its source, and display the **currency or measurement unit**; never show only an unqualified bare number where ambiguity matters.
- Results are tap-to-insert into the currently focused **compatible input**.
- Preserve the original number and metadata even if formatting changes on display.
- When a tool's inputs change, mark its last result stale or replace it with a fresh recalculation; do not silently present outdated totals as current.
- If no compatible input has focus, do not paste into an arbitrary field. Either disable insertion with a clear explanation or let the user choose a destination field.
- Respect cursor position/selection and provide a straightforward Undo path.

### 3.3 Typed result contract

Use a common internal shape (illustrative, not a prescribed language or schema):

```text
CalculationResult {
  id
  sourceTool
  kind: money | quantity | temperature | percentage | scalar
  value: decimal-compatible representation
  currency?: ISO currency code
  unit?: canonical unit code
  label
  calculatedAt
  sourceRevision / freshness status
  optional original value and conversion-rate snapshot
}
```

**Safety rules:**

- Do **not** silently paste `JPY 580` as `HKD 580`. Require an explicit conversion or an explicit user choice; if converting, show the rate and its timestamp.
- Do **not** paste `750 mL` into a monetary amount field, or a monetary amount into a quantity-only field.
- For unit-aware fields, convert compatible units using the shared conversion engine before insertion, with predictable rounding.
- Use decimal-safe money calculations and explicit rounding rules. Avoid relying on binary floating-point equality for price decisions.
- For comparisons, retain raw precision internally and round only for display or at jurisdiction-specific currency rounding steps.

## 4. Individual tool requirements

### 4.1 Cartulator — preserve existing behavior

- Retain trip tally and existing supermarket-deal functions as-is.
- Publish the latest cart **payable total** to the shared result bar.
- Allow an explicit **Save to Prices** action for a recognized product/line item where enough information exists. Do not auto-save prices merely because the cart was calculated.
- Where applicable, pass the item name, pack size, currency, observed price, shop, date, and source. If required details are missing, ask only for those fields.
- Keep existing promotion logic; **do not** build Discount Stack.

### 4.2 Coupon Keeper — preserve existing behavior

- Retain coupon, gift card, and loyalty card features without redesigning their workflows.
- Apply the shared navigation and styling frame.
- Does not publish a result to the bottom bar.
- Do not introduce automatic coupon redemption, shop integrations, or extra coupon calculations in this phase.

### 4.3 Deal Checker — preserve existing behavior

- Retain its existing price-per-unit comparison workflow.
- Reuse a **single canonical set of units and pack-size conversion rules** with Units.
- Publish the winning option's **actual option price** to the result bar; keep its calculated unit price available in Deal Checker, with separate labeling to avoid confusion.
- Add an explicit **Save to Prices** path for a selected product/option.
- Preserve pack size, quantity, price basis, currency, shop (if known), and date.

### 4.4 Units

- Convert **weight, volume, length, temperature, and area**.
- Support the pack-size units already understood by Deal Checker; don't maintain independent conflicting conversion tables.
- Make swapping units and copying/inserting the result easy.
- Remember the last-used category and from/to units if it improves repeated use.
- Guard dimensional compatibility: weight-to-volume conversion requires an explicit product density and should **not** occur automatically.
- Handle temperature via affine conversion rather than treating it as ordinary multiplication.
- Define display precision sensibly; preserve underlying precision for handoffs.

### 4.5 Currency

**Core conversion**

- Select source and destination currencies; default home currency **HKD**, user-changeable.
- Fetch current rates when online and **cache the last successful rates** for offline use.
- Always show an **as-of timestamp** or age next to a cached rate. Never describe stale cached data as live.
- Permit a **manual rate override** for cash exchange rates or offline estimates; distinguish manual rates clearly from fetched rates.
- Show converted amount and a one-line **mental-math approximation** (e.g. a rounded multiplier or simple `divide by N` estimate, labeled approximate).
- Remember recently used currency pairs. Do not alter recorded historical prices when a newer rate arrives.

**Scratchpad / scribble box**

- Accept multiple lines mixing expressions and plain notes.
- Calculate recognized arithmetic expressions (including `x`, `×`, `*`, `/`, `÷`, parentheses, and decimals) and add eligible math lines to one scratchpad total.
- Accept shopping shorthand such as `32 x 5`; define explicitly which `per` / unit annotations are recognized, e.g. `30 per bottle / 5`, and treat ambiguous input as notes rather than inventing a calculation.
- Show each recognized line's result and whether it contributes to the total; plain notes remain visibly unchanged.
- Decide and document whether a bare number line contributes (recommended: yes, unless marked as a note), with a way to exclude a line.
- Preserve text when navigating away. Include a deliberate Clear action.
- Evaluate expressions using a **restricted arithmetic parser**, not code `eval` or arbitrary JavaScript execution.
- Publish both the last converted amount and scratchpad total as separate results.
- Define the scratchpad's currency explicitly; don't mix totals with different currencies invisibly.

### 4.6 Tax & Refund (formerly Shelf Tax)

**A. Tax calculator**

- Input shelf price, currency, tax rate, and a switch for **tax included / tax added on top**.
- For tax-inclusive prices, extract the tax portion via `gross × rate / (1 + rate)`, not `gross × rate`.
- For tax-exclusive prices, compute tax and final checkout amount.
- Show shelf amount, taxable portion as applicable, tax amount, and checkout total.
- Publish the **tax-inclusive/checkout amount** to the results bar.

**B. Tourist refund estimator**

- Start with the correct tax amount, then apply a user-entered **fee percentage taken out of that tax** (plus optional fixed fee only if supported explicitly).
- Display expected gross refund, fee deducted, **net refund**, and effective cost after expected refund.
- Do not assume the entire tax portion is refundable, that every item or traveler is eligible, or that a jurisdiction uses identical rules.
- Any country presets should be separately maintainable, visibly dated, and verified against current official rules before implementation. Offer manual/custom rates as the safe baseline.
- Clearly label all calculations **estimates**, not guaranteed refunds. Refund eligibility, provider fees, rounding, exchange rates, and processing timelines may vary.
- Publish **net estimated refund** to the results bar.

**C. Integrated Refund Tracker**

- Add a **Refunds** section/tab **within Tax & Refund**; no separate home-screen button.
- From an estimator result, offer **Save refund** to create an expected refund record.
- Suggested minimal fields: retailer/description, purchase date, country, original currency, paid price, tax rate or tax amount, estimated refund, fee/assumptions, and status.
- Recommended statuses: **Expected**, **Submitted**, **Received**, **Cancelled / Not received**. Keep status edits simple.
- Allow entry of actual received amount and date; retain expected and actual separately so differences remain visible.
- Summary: pending/expected refund total and received total, **grouped by currency** unless the user explicitly chooses a converted view and rate.
- Let users edit or delete entries, and export/restore them with other local app data.
- Receipt attachments, reminders, provider integrations, and automated customs workflows are **not part of the first release**.

### 4.7 Prices

**Card presentation**

- One card per product identity, with at least: product name, optional brand/variant, pack size/unit, **Usual price**, **Best price**, **Last seen price**, last-seen shop, and last-seen date.
- Keep the cards compact; show full accepted observation history only in product details.
- A product can be added manually or through explicit Save actions in Cartulator or Deal Checker.
- Store the originally observed currency, pack size, and pricing basis. Compare compatible prices only.

**Update rules — retain the user's original semantics**

1. **Same as current usual price:** Accept observation and immediately refresh last-seen shop/date/price. Best remains the lowest accepted price (or updates on the first observation).
2. **Different from current usual price:** Before writing anything, show **higher/lower and by how much**, then offer:
   - **Update last seen only** — write a new observation and update last-seen fields; **also update Best** if this is the lowest accepted comparable price; leave Usual unchanged.
   - **Update usual too** — write the new observation, set it as Usual and Last seen, and update Best if applicable.
   - **Cancel** — write **nothing**.
3. **New product:** Create card and first observation; initialize Usual, Best, and Last seen from the first accepted price unless user specifies another baseline.
4. Avoid silent updates when matched identity or pack size is uncertain; ask the user to choose an existing card or create a new variant.

**Observations and promotions**

- Save each **accepted** observation as a compact record with price, currency, pack size, shop, timestamp/date, source (`manual`, `Cartulator`, `Deal Checker`), and optional **promotion/clearance** marker.
- Best is the minimum comparable accepted price; a promotional price may update Best without automatically changing Usual.
- Allow an explicit **Mark as usual** action to choose an observation as the normal reference price.
- If pack sizes differ, either create distinct product variants or explicitly compare by canonical unit price. Do not silently compare package totals of different sizes.
- If currencies differ, retain the original prices. A comparable converted view must show the exchange rate/date used and must not rewrite the originals or silently adjust historical Best.
- Prevent accidental duplicates (same product, shop, date, price, and source) where feasible without suppressing legitimate repeated observations.
- Offer optional search/filter by product and shop. Barcode assignment/lookup can be later work; no mandatory barcode or scanning in v1.

**Card example (illustrative)**

```text
Shampoo · 500 mL
Usual: HK$42    Best: HK$35    Last seen: HK$39
Last seen at Wellcome · 2026-11-15
[History] [Add price] [Mark usual]
```

## 5. Storage and data model

Choose storage appropriate to the existing app stack, prioritizing **local, offline-first operation**. Suggested logical collections:

| Collection | Purpose |
| --- | --- |
| `settings` | Home currency, formatting, preferred units, display/UX options |
| `exchangeRateCache` | Currency pairs or base-rate snapshots, fetched-at time, source, manual overrides |
| `toolDrafts` | Independent per-tool working state and scratchpad notes |
| `calculationResults` | Recent typed results for cross-tool insertion (bounded / clearable) |
| `products` | Price-card identity, name, variant, pack-size basis, selected usual-price observation |
| `priceObservations` | Append-only or auditable accepted observations; prices, sources, flags, shop, date |
| `refunds` | Tax/refund assumptions, expected and actual amounts, statuses and dates |

Implementation notes:

- Give records stable IDs, explicit currency and unit codes, timestamps, and a schema version.
- Store monetary values in a decimal-safe representation (e.g. integer minor units where appropriate or decimal strings) and retain sufficient precision for rates and unit prices.
- Avoid storing mutable foreign-exchange conversions in place of source values.
- Keep new and old data migratable; do not overwrite the existing three tools' stored data blindly.
- Export **complete local data as versioned JSON**; offer **Prices CSV export** for inspection/portability. Consider optional Refunds CSV export as a small follow-up.
- Validate imports, preview counts/conflicts, and offer restore safeguards; export-before-migration where feasible.
- No cloud account or synchronization is required for v1.

## 6. Implementation phases

### M0 — Existing tool inventory and integration contract

- Inspect current Cartulator, Coupon Keeper, and Deal Checker code/data schemas and document what must remain unchanged.
- Identify duplicate conversion code, shared components, data persistence, and existing export/import mechanisms.
- Define the calculation-result shape, product-observation payload, and migration strategy before changing data.

**Done when:** A brief inventory and behavior checklist exists; existing tests/baselines are available; the integration plan avoids rewriting existing tool logic.

### M1 — Shophelper home and shared shell

- Create the seven-entry home screen and per-tool navigation.
- Wrap the existing three tools; create placeholders/routes for four new tools.
- Implement consistent header, back controls, persistence of draft state, and responsive layout.
- Implement the typed result bus/store and compact expandable recent-results bar, including compatible insertion rules.

**Done when:** All seven destinations work, existing tools are behaviorally unchanged, drafts survive navigation, and currency/unit mismatches cannot silently paste.

### M2 — Shared conversions, Units, and Currency

- Extract/reuse canonical pack-size conversions from Deal Checker.
- Build Units with dimensional checks and tested conversion factors.
- Add currency fetch/cache/manual override, as-of timestamp, home-currency setting, estimate line, and last-used currencies.
- Add restricted-expression scratchpad with notes, per-line results, and total.
- Publish typed outputs from these tools.

**Done when:** Units and Currency function offline where possible; cached-rate provenance is visible; math cannot execute arbitrary code; cross-tool output insertion is correct.

### M3 — Prices integration and history

- Build cards, manual add/edit, price observation store, comparison prompt, and history view.
- Add explicit Save to Prices to Cartulator and Deal Checker with review of source fields.
- Implement usual/best/last-seen rules, promotion markers, pack-size identity/normalization, and cross-currency safeguards.

**Done when:** Same-price observations update immediately; different-price observations require a choice; Cancel performs no write; Last seen only can still update Best; source tools are unaffected.

### M4 — Tax & Refund with Refund Tracker

- Implement inclusive/exclusive tax and net-refund estimator with clear formulas and labels.
- Add a Refunds section inside this tool with Save refund, status tracking, expected vs actual, and edit/delete.
- Publish checkout/tax-included result and net refund to results bar.
- Add clear disclaimers/dated preset architecture where appropriate; avoid hard-coded unverified jurisdiction assumptions.

**Done when:** Calculation examples pass, tracker totals are currency-safe, and tracking is accessible within Tax & Refund without a separate tool.

### M5 — Quality, data portability, and release

- Cross-tool integration tests, mobile layout/keyboard tests, accessibility pass, calculations/rounding tests.
- Schema migration, JSON backup/restore, Prices CSV export, errors/empty states, and offline-start testing.
- Regression test all three original tools against M0 behavior checklist.
- Review labels, units, display precision, and whether the compact results bar fits small screens.

**Done when:** Seven-tool release is stable, offline-capable, portable, and does not regress existing tools.

### M6 — Optional after release: Payment Compare

Only after M5, consider adding an **eighth** home-screen tool:

- Input local-currency purchase price.
- Compare cash rate (manual), card/network exchange estimate, percentage FX fees, cashback/points value (manual valuation), and effective home-currency cost.
- Display assumptions clearly and avoid implying exact card settlement rates; allow multiple saved payment methods only if worthwhile.
- Reuse Currency's rate/cache data and result handoff.

**Not part of seven-tool release.** Do not start Discount Stack as a substitute.

## 7. Acceptance tests / edge cases

| Scenario | Required behavior |
| --- | --- |
| Leave Currency with an unfinished scratchpad and return | Notes, expressions, and selected currencies remain intact |
| Use the results bar while keyboard is open | Focused input stays usable and the bar does not cover it |
| Insert ¥580 into an HKD amount field | No silent `580 HKD`; explicit conversion/choice required |
| Insert `750 mL` into a price field | Refused as incompatible |
| Change Deal Checker input after a result was calculated | Old result is refreshed or visibly stale |
| Compare a 500 mL bottle against a 1 L bottle | Correct per-unit comparison; no accidental raw-package-price substitution |
| Price matches existing usual | Last seen shop/date update immediately; historical Best is preserved |
| Price differs from usual and user chooses Cancel | No new observation or changed metadata |
| Price differs and user chooses Last seen only | Last seen updated; Usual unchanged; Best updated if lower |
| Promotional low price saved | Best may decrease; Usual not automatically overwritten |
| Same item observed in different currencies | Original currencies retained; comparison requires explicit conversion basis |
| Currency refresh fails | Offline cached/manual rate remains usable with visible age/source |
| Scratchpad contains `32 x 5` plus plain text | Math contributes 160; plain text stays a note |
| Scratchpad contains unknown/ambiguous expression | No guessed math or arbitrary code execution |
| Inclusive tax: 1,100 at 10% | Tax portion = 100; price paid = 1,100 |
| Exclusive tax: 1,000 at 10% | Tax = 100; price paid = 1,100 |
| Estimated tax refund with 20% fee on 100 tax | Expected net refund = 80, before any separately modeled fixed fees |
| Refund received differs from estimate | Preserve both expected and actual, with received date |
| Pending refunds in JPY and HKD | Totals remain separate unless converted explicitly |
| Reopen Coupon Keeper or Cartulator after integration | Existing features and saved data still work |
| Backup and restore on a fresh installation | Prices, refunds, settings, and other included records restore without data loss |

## 8. Scope-control checklist

**Include in the initial release:** seven screens; existing tool preservation; shared shell/results bar; Units; Currency with offline cache/scratchpad; Tax & Refund with integrated tracking; Prices with observations and safe update flow; lightweight portability.

**Defer:** Payment Compare (possible eighth tool); barcode scanning/lookup; saved payment-method profiles; tax-country preset library if not verified; receipt images/scanning; refund reminders; cloud sync; advanced price analytics; any separate Discount Stack.

**Explicitly out of scope for now:** Rebuilding the existing deal logic, mandatory registration, full inventory, budgeting, expense tracking, or automated tax-refund filing.

## 9. Recommended developer handoff order

1. Audit existing tools and record current behavior, including data formats.
2. Agree on shared typed calculations, decimal/currency/unit rules, and local data schemas.
3. Integrate home/navigation and results bar without changing existing calculations.
4. Build Units/Currency; then Prices; then Tax & Refund / refund tracking.
5. Validate acceptance tests and migration; release seven tools.
6. Evaluate Payment Compare using real usage feedback, separately from the initial release.

**North-star test:** A shopper should be able to open the app, do one calculation or reference a saved price, and leave within seconds. Additional features should support that speed rather than complicate it.
