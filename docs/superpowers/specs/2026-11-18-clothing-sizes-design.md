# Clothing sizes tool — design

**Date:** 2026-11-18
**Status:** Approved 2026-11-18
**Repo:** [fishese/shophelper](https://github.com/fishese/shophelper)
**Scope:** New offline Shophelper tool to record a few people's body measurements and clothing/bra/shoe sizes, and to convert those sizes across common regional systems.

## Goal

Add a shell-native **Sizes** tool so you can keep measurements (neck, shoulder, chest/bust, waist, hip, bra, shoes, and similar) for several people, and convert clothing, bra, and shoe labels between systems such as US, UK, EU, JP, and cm — without shopping-cart or file-format chrome, and without leaving the device.

## Context (this codebase)

Shophelper is a static PWA + Capacitor Android wrapper (`com.fishese.shophelper`). Newer tools are **shell-native**: a page under `tools/<name>/` that uses `shell.css`, `js/shell.js`, and EN/繁 strings in `js/i18n.js`. Persistent Shophelper data lives in `localStorage` key `shophelper_v1` (settings, prices, refunds, drafts). The Shopping List tool also has its own key (`shophelper_list_v1`) and mirrors into `shophelper_v1.shoppingList` so Home → Export/Import backup includes it.

`js/units.js` already converts length (`mm`, `cm`, `m`, `in`, `ft`, `yd`) with tests in `test/shophelper.test.js`. There is no clothing-size, bra, or shoe logic today.

Home currently lists eight tools (Shopping List, Cartulator, Coupons, Deal Checker, Units, Currency, Tax & Refund, Prices). Android long-press shortcuts are defined in `android/app/src/main/res/xml/shortcuts.xml`. The root service worker (`sw.js`, cache `shophelper-v17`) must precache any new assets and bump the cache name.

Languages in the shell are English and Traditional Chinese only.

## Approaches considered

| Approach | Trade-off |
| --- | --- |
| **A. New shell-native tool** (`tools/sizes/`) | Matches Units and Shopping List. Keeps personal data and conversion UI together, without overloading Units. **Recommended.** |
| **B. Fold into Units** | Units is a one-shot quantity converter and already publishes into the bottom result bar. Body profiles and bra/shoe labels do not belong there. |
| **C. Coupons-style mini-app** | Older tools keep separate storage, CSS, and service workers. Newer work has moved away from that, and home backup would be easy to miss. |

**Storage:** follow the Shopping List pattern — own key `shophelper_sizes_v1` as source of truth, mirrored into `shophelper_v1.sizes` for Home backup/restore. Do not invent a third pattern.

## Decisions

| Topic | Choice |
| --- | --- |
| Home-grid name | **Sizing** — short, and clearer than “Sizes”. “Clothing size” is longer and undersells bra and shoes. If this still feels soft, keep the name and lean on the icon + description. |
| Tile description | “Body measurements, clothing, bra, and shoe conversions.” |
| Architecture | Shell-native tool, like Units / Shopping List, not a Coupons-style mini-app |
| Storage | Own key `shophelper_sizes_v1`, mirrored into `shophelper_v1.sizes` |
| People | Any number of named profiles (built for a handful; no artificial cap of 3) |
| Canonical body units | Centimetres, one decimal allowed (e.g. `37.5`); foot length also stored as mm internally (`cm * 10`) |
| Display units | Per-profile preference: centimetres or inches; conversion uses existing `ShophelperUnits` |
| Conversion honesty | Clothing, bra, and shoe label conversion is a **guideline**. Brands and last shapes vary. Show a short persistent disclaimer. Body cm↔in is exact. |
| Clothing systems (v1) | Letter (XS–3XL), US, UK, AU (same numbers as UK for garments), EU-DE (DE/NL/Nordic), EU-FR (FR/ES/BE), IT, JP. China is measurement-based (see below), not a fake US↔CN dress number. |
| Bra systems (v1) | US, UK, EU, FR, AU, JP |
| Shoe systems (v1) | Foot length (mm / cm), Mondopoint, JP (cm), EU, UK, US men, US women. Method: [ISO 19407:2023](https://www.iso.org/standard/83106.html) (foot length as the common reference). |
| Brand charts | **Out of scope** for v1 (Uniqlo, Nike, etc. can be a later add-on) |
| Children's sizes | **Out of scope** for v1 |
| Share / QR of profiles | **Out of scope** for v1 (body data is personal; no share URL) |
| Result bar | Do **not** publish into the bottom totals bar |
| Suggested size from measurements | Yes, as an approximate range only, when the needed girths are filled in |

## Tool behaviour

The page has two sections (tabs or stacked cards):

1. **People** — pick or add a person, edit measurements, and jot down sizes that already fit them.
2. **Convert** — four converters, all in v1: women’s clothing, men’s clothing, **bra** (band, cup, and sister sizes), and **shoes**. Body lengths (cm ↔ in) sit on the measurement fields themselves. Works with or without a selected person. A “Use [name]” control can pre-fill from the selected profile (foot length for shoes, underbust + bust for bra, chest/bust/waist/hip for clothing).

### People

- Add, rename, delete (delete asks for confirmation).
- Remember the last selected person.
- Optional short note (e.g. “prefers relaxed fit”).
- Core measurements, each optional:

  | Id | Label | How to measure (short hint in the UI) |
  | --- | --- | --- |
  | `height` | Height | Standing, no shoes |
  | `neck` | Neck | Around the base of the neck |
  | `shoulder` | Shoulder width | Acromion to acromion, across the back |
  | `chest` | Chest / bust | Fullest part, tape level |
  | `underbust` | Underbust | Tight around the ribcage, under the bust |
  | `waist` | Waist | Narrowest natural waist |
  | `hip` | Hip | Fullest part of the hips/seat |
  | `inseam` | Inseam | Crotch to floor (or to preferred hem) |
  | `sleeve` | Sleeve | Shoulder point to wrist, arm slightly bent |
  | `footLength` | Foot length | Heel to longest toe, standing |
  | `footWidth` | Foot width | Widest part of the foot, standing |

- Custom rows: the user can add extra named measurements (e.g. thigh, wrist) so “etc.” is covered without inventing a huge default list.
- **Saved labels** (optional, free to leave blank): what already fits this person, as a reminder when shopping:
  - Tops / dresses: system + size
  - Bottoms: system + size
  - Bra: system + band + cup
  - Shoes: system + size, optional width letter (A, B, D, E, EE, or free text)
  - Optional one-line note per category (e.g. “Uniqlo tops: M”)

### Convert

**Body length** is not a separate product: any measurement field can show the other unit (cm ↔ in) using `ShophelperUnits`.

**Women's and men's clothing** (separate categories, because letter and numeric mappings differ):

- User enters a size in one system (letter or number).
- Tool shows the equivalent row in every other clothing system, plus a typical bust/chest (and waist/hip when the table has them) range in cm and in.
- If the selected person has the relevant girths, highlight whether they sit in that range, below, or above — still as a hint, not a guarantee.
- **EU is two columns**, because “US 8 = EU 38” and “US 8 = EU 40” are both used in the wild:
  - **EU-DE:** Germany, Netherlands, Nordics (US + 30 for women’s numeric sizes)
  - **EU-FR:** France, Spain, Belgium (US + 32)
  - **IT:** Italy (US + 36)
- UK and AU garment numbers match each other (US + 4 for women).
- JP women’s sizes are the odd 号 numbers (5, 7, 9, …) under the usual JIS L 4005 retail mapping; 9 is the middle size. Letter sizes on Japanese brands often run about one size smaller than US letters — the converter still uses the numeric/letter table below, and the disclaimer covers brand cut.
- **China (GB/T 1335):** do not invent a US-8-to-`165/88A` shortcut. If height and bust/chest are present, show a suggested `height/girth` + body-type letter **A** (standard) only as a starting point; otherwise tell the user to compare height and girth on the shop’s chart.

**Bra:**

- Convert band and cup independently, then combine.
- Band: US/UK even inches; EU and JP in 5 cm steps (US/UK 32 = EU/JP 70); FR = EU + 15 (32 = 85); AU is the dress-like number (32 = 10). **Do not treat AU bra numbers as inches, and do not mix them with AU garment sizes.**
- Cup letters agree through D. After that, map by cup *step*, not by letter. Locked mapping (v1):

  | Step | US | UK | EU / FR / JP | AU |
  | --- | --- | --- | --- | --- |
  | 0 | AA | AA | AA | AA |
  | 1 | A | A | A | A |
  | 2 | B | B | B | B |
  | 3 | C | C | C | C |
  | 4 | D | D | D | D |
  | 5 | DD / E | DD | E | DD |
  | 6 | DDD / F | E | F | E |
  | 7 | G | F | G | F |
  | 8 | H | FF | H | FF |
  | 9 | I | G | I | G |
  | 10 | J | GG | J | GG |
  | 11 | K | H | K | H |

  US input accepts both `DD` and `E` for step 5, both `DDD` and `F` for step 6. Output prefers `DD` / `DDD` and also shows the alternate letter in parentheses.
- Japanese cup *increments* are not identical to EN 13402 (often 2.5 cm vs 2 cm). JP cup letters are therefore approximate; the disclaimer must say so.
- **Sister sizes** follow [r/ABraThatFits](https://www.reddit.com/r/ABraThatFits/) and the [ABTF calculator](https://www.abrathatfits.org/): same cup *volume* on a different band. Move the band and the cup by the same number of steps in opposite directions, using our cup-step ladder (UK letters are the volume reference, as ABTF recommends).
  - Show **immediate sisters (±1)** first and most clearly: UK 32C → 30D and 34B. These are the only ones ABTF generally treats as practical.
  - Also list a quieter **wider chain (±2)** (32C → 28DD and 36A), labelled as less reliable. Cup shape and band tension change as you move further from the starting size, so ±2 is a fallback, not a match.
  - Render sisters in the system the user is converting to, and also show the UK pair when that system is not UK.
  - Short note in the UI: sister sizes keep cup volume, not the same fit. They are most useful when a brand’s band runs tight or loose.
  - v1 does **not** include the full six-measurement ABTF calculator (loose / snug / tight underbust + standing / leaning / lying bust). Link the official calculator as a reference. That method can be a later add-on.

**Shoes:**

- Canonical value: foot length in millimetres.
- JP display: centimetres (`245 mm` → `24.5`).
- Mondopoint: the same millimetre value (ISO 9407).
- EU / UK / US men / US women: look up the locked table derived from ISO 19407:2023 (foot length as the common reference; Table 2 “recommended marking” is the implementation source). Half sizes are included where the table has them.
- If the input is a regional size, convert via foot length, then out to every other system. If the input is a measured foot length, show recommended markings in every system.
- Width is stored and shown, not converted (there is no reliable cross-system width chart worth trusting in v1).
- Kids’ shoe scales are out of scope; adult table only.

## Clothing conversion table (v1, conventional retail mapping)

This is **not** an ISO or ASTM standard. ISO 8559 / EN 13402 define *how* to label from body measurements, not a fixed “US 8 = EU 38” rule. The table below is a conventional retail mapping (same structure as common international charts such as [thesize.net’s clothing chart](https://thesize.net/clothing/)). Tests lock these rows so the UI cannot drift.

### Women’s numeric / letter

| Letter | US | UK / AU | EU-DE | EU-FR | IT | JP | Typical bust |
| --- | --- | --- | --- | --- | --- | --- | --- |
| XS | 0 | 4 | 30 | 32 | 36 | 5 | 78–81 cm |
| XS | 2 | 6 | 32 | 34 | 38 | 7 | 82–84 cm |
| S | 4 | 8 | 34 | 36 | 40 | 9 | 85–87 cm |
| S | 6 | 10 | 36 | 38 | 42 | 11 | 88–90 cm |
| M | 8 | 12 | 38 | 40 | 44 | 13 | 91–94 cm |
| M | 10 | 14 | 40 | 42 | 46 | 15 | 95–98 cm |
| L | 12 | 16 | 42 | 44 | 48 | 17 | 99–102 cm |
| L | 14 | 18 | 44 | 46 | 50 | 19 | 103–107 cm |
| XL | 16 | 20 | 46 | 48 | 52 | 21 | 108–112 cm |
| XL | 18 | 22 | 48 | 50 | 54 | — | 113–117 cm |
| XXL | 20 | 24 | 50 | 52 | 56 | — | 118–122 cm |

Unknown or in-between labels: if a value sits between two rows, show both neighbours (e.g. “US 9 → around UK 12–14”). Do not invent a fake mid-row.

### Men’s letters and jackets

Men’s jackets/tops are driven by **chest**. US/UK jacket size ≈ chest in inches. EU/IT jacket size ≈ half the chest in centimetres (about US + 10, drifting at the large end because EU steps 4 cm and US steps 2 in).

| Letter | Chest | US/UK jacket | EU/IT jacket | JP letter (typical) |
| --- | --- | --- | --- | --- |
| XS | 81–86 cm (32–34 in) | 34 | 44 | S |
| S | 86–91 cm (34–36 in) | 36 | 46 | M |
| M | 97–102 cm (38–40 in) | 38–40 | 48–50 | L |
| L | 107–112 cm (42–44 in) | 42–44 | 52–54 | LL / XL |
| XL | 117–122 cm (46–48 in) | 46–48 | 56–58 | 3L |
| XXL | 127–132 cm (50–52 in) | 50–52 | 60–62 | 4L |
| 3XL | 137–142 cm (54–56 in) | 54–56 | 64–66 | 5L |

The gap between S and M (a 94 cm / 37 in chest) is real: show “between S and M” rather than forcing a pick.

**Men’s trousers:** convert the waist measurement itself (inches ↔ cm) and, when present, the saved waist label. Do not invent a separate formal-EU trouser number in v1; many jeans already use the same inch waist worldwide. Inseam is a length conversion only.

UK men’s clothing numbers match US for jackets and shirts.

## Bra band table (v1)

Each row is the same underbust, labelled differently.

| Underbust (approx.) | US / UK | EU / JP | FR | AU |
| --- | --- | --- | --- | --- |
| 68–72 cm (27–28 in) | 28 | 60 | 75 | 6 |
| 73–77 cm (29–30 in) | 30 | 65 | 80 | 8 |
| 78–82 cm (31–32 in) | 32 | 70 | 85 | 10 |
| 83–87 cm (33–34 in) | 34 | 75 | 90 | 12 |
| 88–92 cm (35–36 in) | 36 | 80 | 95 | 14 |
| 93–97 cm (37–38 in) | 38 | 85 | 100 | 16 |
| 98–102 cm (39–40 in) | 40 | 90 | 105 | 18 |
| 103–107 cm (41–42 in) | 42 | 95 | 110 | 20 |
| 108–112 cm (43–44 in) | 44 | 100 | 115 | 22 |
| 113–117 cm (45–46 in) | 46 | 105 | 120 | 24 |
| 118–122 cm (47–48 in) | 48 | 110 | 125 | 26 |

When suggesting a band from a measured underbust, pick the closest row (ties: the larger band, which is the usual comfort bias). Cup from measurements: bust minus underbust, using a 2 cm (about 1 in) step per cup starting at A ≈ 12–13 cm difference, *only as a hint*, and only alongside the “brands vary” note. Prefer a saved bra label over a guess when both exist.

## Shoe conversion (v1)

- Source of truth for *method*: ISO 19407:2023, using foot length.
- Implementation: a single adult table, locked by tests, taken from ISO 19407:2023 Table 2 (simplified recommended marking). Do not paste the copyrighted standard into the repo; store our compact lookup (`footMm → eu, uk, usMen, usWomen, jpCm, mondopoint`) and cite the standard in a code comment and in this spec.
- Worked examples the tests must keep stable once the table is entered (replace the numbers below with the ISO Table 2 values during implementation if they differ):

  The public ISO preview and ISO-oriented charts agree that Mondopoint / JP centimetres follow foot length (`260` / `26.0` for a 260 mm foot). EU, UK, and US columns must be copied from Table 2, not from a random retailer chart — those charts disagree with each other (e.g. 260 mm is variously EU 40, 41, or 41).
- Adult sizes only. If an input would be a children’s UK/US size, return “out of range for the adult table” rather than a wrong adult size.

## Data model

### Root document (`shophelper_sizes_v1`)

```json
{
  "version": 1,
  "selectedPersonId": "<uuid or null>",
  "displayUnit": "cm",
  "people": [
    {
      "id": "<uuid>",
      "name": "Alex",
      "note": "",
      "displayUnit": "cm",
      "measurements": {
        "height": "170",
        "neck": "36",
        "shoulder": "42",
        "chest": "92",
        "underbust": "80",
        "waist": "74",
        "hip": "98",
        "inseam": "78",
        "sleeve": "58",
        "footLength": "24.5",
        "footWidth": "9.5"
      },
      "custom": [
        { "id": "<uuid>", "label": "Thigh", "valueCm": "56" }
      ],
      "saved": {
        "tops": { "system": "jp", "size": "M", "note": "Uniqlo tops: M" },
        "bottoms": { "system": "us", "size": "6", "note": "" },
        "bra": { "system": "uk", "band": "32", "cup": "C", "note": "" },
        "shoes": { "system": "eu", "size": "38", "width": "", "note": "" }
      },
      "updatedAt": 1731890000000
    }
  ]
}
```

All core measurement values are stored as **centimetre strings** (same decimal helper as the rest of Shophelper). `footLength` is stored in cm; converters multiply by 10 to get mm. Empty or omitted keys mean “not recorded”. `displayUnit` on the person overrides the document default when set.

`saved.*.system` uses the converter ids: `us`, `uk`, `au`, `eu-de`, `eu-fr`, `it`, `jp`, `eu`, `fr`, `us-m`, `us-w`, `mondo`, `cm`, `letter`, `waist-in`, `waist-cm`.

### Home backup mirror

- On every sizes save, write a clone of `shophelper_sizes_v1` into `shophelper_v1.sizes`.
- On Home import, if the bundle contains `sizes`, write it back to `shophelper_sizes_v1` as well as into the merged store (same as Shopping List).
- Extend `ShophelperStore.defaults` / `merge` / `readBundle` so `sizes` round-trips.
- Update the backup note and import preview counts to mention people/profiles.
- Backup remains on-device JSON; no account, no network.

## UI

Shell tool page using existing tokens (`.sh-page`, `.sh-card`, `.sh-btn`, `.sh-label`, `.sh-note`, …). EN/繁 via `js/i18n.js`. Hardware back: `Shophelper.pushBack` for any confirm/delete dialog.

- Home tile: **Sizing**, description “Body measurements, clothing, bra, and shoe conversions.” SVG mark in the same stroke style as the other tiles (a simple measuring-tape / person-outline is enough — the description, not the name alone, is what makes bra and shoes obvious).
- Persistent one-line disclaimer on the Convert section: brand cuts and last shapes vary; use this as a starting point and check the shop’s own chart.
- People: a compact switcher (select or chips) + Add. The form is a list of labelled inputs, not a fashion illustration. Custom rows have add/remove. Saved labels sit in a second card under the measurements.
- Convert: category tabs (Women’s clothing, Men’s clothing, Bra, Shoes). From-system + value → a result list of the other systems. Invalid or unknown labels show a clear “Cannot convert” note, never a guessed value.
- Units toggle (cm / in) affects measurement display only.

## Integration checklist

- `index.html` — new home tile.
- `js/i18n.js` — all new strings, English and 繁.
- `sw.js` — precache `js/sizes.js`, `js/sizes-store.js`, `tools/sizes/index.html`, `tools/sizes/page.js`; bump `CACHE` to `shophelper-v18`.
- `README.md` and `docs/m0-inventory.md` — list the ninth tool and the new storage key / mirror.
- Android: add a Sizes shortcut next to the existing ones (`shortcuts.xml` + string resources). Launchers may still show only a subset; that is acceptable.
- `manifest.webmanifest` shortcuts: optional follow-up, not required (Shopping List left PWA shortcuts as optional too).
- Tests: Node runner, same style as `test/shophelper.test.js`. Conversion and store logic must be testable without a browser (`withStorage` override, like the list store).

## Module shape

| Module | Global | Responsibility |
| --- | --- | --- |
| `js/sizes.js` | `ShophelperSizes` | Tables + `convertClothing`, `convertBra`, `convertShoe`, `suggestFromMeasurements`, cm/in helpers wrapping `ShophelperUnits` |
| `js/sizes-store.js` | `ShophelperSizesStore` | Load/save, person CRUD, measurement/saved updates, mirror to `ShophelperStore` |
| `tools/sizes/index.html` + `page.js` | — | UI only |

`ShophelperSizes` must not touch `localStorage`. `ShophelperSizesStore` must not contain conversion tables.

## Out of scope (this pass)

- Brand- or shop-specific charts
- Children’s clothing or shoe sizes
- Sharing, QR, or export of a person (privacy)
- Publishing into the bottom result bar
- Folding Cartulator / Coupons into home backup
- Korean, Mexican, or other extra clothing systems (KR shoe cm can come later; JP already covers the common centimetre shoe label)
- Fit advice beyond a measurement-vs-range hint and bra sister sizes
- Photos, body scanners, or accounts

## Success criteria

1. User can add a few named people, record the core measurements (and custom ones), and save everyday clothing / bra / shoe labels. Data survives restart and appears in Home JSON backup.
2. User can convert women’s and men’s clothing, **bra** (post-D cup letters, plus ABTF-style sister sizes), and **adult shoes** across the v1 systems, including cm/in for body and foot length. Bra and shoes are first-class converters, not afterthoughts.
3. EU clothing shows both DE and FR conventions; AU bra numbers are not confused with AU garment numbers; unknown sizes are refused rather than invented.
4. A short disclaimer is visible on conversion. Suggested sizes from measurements are clearly approximate.
5. Works offline in the PWA and in the Capacitor APK after `cap:sync`. EN and 繁 both work.
6. Unit tests cover conversion tables, bra cup-step mapping, store CRUD, and backup mirror.

## Open points for review

The v1 cut (no brand charts, no kids’ sizes) is approved. Remaining optional tweak:

1. Home-grid name is **Sizing**, with description “Body measurements, clothing, bra, and shoe conversions.” Say if you’d rather keep **Sizes** and let that description do the work, or prefer another short label.
