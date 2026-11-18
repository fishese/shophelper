# Clothing Sizes Implementation Plan

> Approved 2026-11-18.
> Spec: `docs/superpowers/specs/2026-11-18-clothing-sizes-design.md`.

**Goal:** Ship an offline **Sizing** tool that stores a few people's body measurements and clothing, bra, and shoe labels, and converts those labels — including bra sister sizes — across the v1 regional systems.

**Architecture:** Shell-native page at `tools/sizes/` with a pure conversion module (`js/sizes.js`) and a store module (`js/sizes-store.js`). Own key `shophelper_sizes_v1`, mirrored into `shophelper_v1.sizes` for Home backup. No result-bar publish, no share/QR.

**Tech Stack:** Existing PWA shell (vanilla JS, `ShophelperUnits` + `ShophelperDecimal`), Node test runner in the same style as `test/shophelper.test.js`, Capacitor 7 Android shortcut XML.

## Global Constraints

- The home-grid label is **Sizing**; paths and keys stay `sizes` (`tools/sizes/`, `shophelper_sizes_v1`, shortcut id `sizes`).
- Conversion of clothing, bra, and shoe *labels* is a guideline; body cm↔in is exact via `ShophelperUnits`.
- Bra and shoe converters are required in v1, same as clothing. Bra includes ABTF-style sister sizes (see below).
- EU women’s clothing has two columns (EU-DE and EU-FR), plus IT. Never collapse them into one “EU”.
- AU garment numbers = UK. AU bra numbers are a different scale (32 band = AU 10), never inches.
- After cup D, map by cup step, not by letter. US accepts DD or E, DDD or F.
- Bra sister sizes follow r/ABraThatFits: same cup volume, band and cup move in opposite directions by the same number of steps. Immediate ±1 sisters are primary (32C → 30D, 34B). Also compute ±2, marked less reliable. Do not ship the six-measurement ABTF calculator in this pass.
- Shoe conversions go through foot length (mm). Adult ISO 19407:2023 Table 2 is the source; do not copy the standard text into the repo, only a compact lookup cited in a comment.
- No brand charts, no children’s sizes, no profile sharing in this pass.
- Match shell tokens / i18n EN+繁; bump `sw.js` cache when adding assets.
- Conventional commits (`feat`, `test`, `docs`, `chore`).
- APK updates: `adb install -r` only (never uninstall-first unless the user asks).

## File map

| File | Responsibility |
| --- | --- |
| `js/sizes.js` | Tables + convert/suggest APIs (no I/O) |
| `js/sizes-store.js` | `shophelper_sizes_v1` CRUD + mirror to `ShophelperStore` |
| `test/sizes.test.js` | Unit tests (own runner, same helpers as `test/shophelper.test.js`) |
| `js/store.js` | Round-trip `sizes` in defaults / merge / readBundle |
| `js/home.js` | After backup restore, also write `sizes` → `shophelper_sizes_v1` |
| `tools/sizes/index.html` | Markup |
| `tools/sizes/page.js` | UI wiring |
| `index.html` | Home tile |
| `js/i18n.js` | EN + 繁 strings |
| `sw.js` | Precache + cache bump to `shophelper-v18` |
| `README.md`, `docs/m0-inventory.md` | Ninth tool + storage key |
| `android/app/src/main/res/xml/shortcuts.xml` | Sizes shortcut |
| `android/app/src/main/res/values/strings.xml` (and `values-zh` if present) | Shortcut labels |

---

### Task 1: Conversion module (TDD)

**Files:**
- Create: `js/sizes.js`
- Create: `test/sizes.test.js`

**Interfaces:**
- Produces `ShophelperSizes`:
  - `clothingSystems()` / `braSystems()` / `shoeSystems()` — arrays of `{ id, label }`
  - `convertClothing({ category: 'women'|'men', from, size })` → `{ ok: true, row, equivalents: { [systemId]: string }, range?: { bustCm?, chestCm?, waistCm?, hipCm? } }` or `{ ok: false, reason }`
  - `convertBra({ from, band, cup })` → `{ ok: true, equivalents: { [systemId]: { band, cup, label } }, sisters: [ { steps: 1, equivalents } ], sistersMore: [ { steps: 2, reliable: false, equivalents } ] }` or `{ ok: false, reason }`
  - `convertShoe({ from, size })` → `{ ok: true, footMm, equivalents: { mondo, jp, eu, uk, usMen, usWomen } }` or `{ ok: false, reason }` (`from` may be `mm`, `cm`, `mondo`, `jp`, `eu`, `uk`, `us-m`, `us-w`)
  - `suggestFromMeasurements({ category, measurements })` → approximate size range or `{ ok: false, reason: 'missing-measurements' }`
  - `displayLength(cm, unit)` / `parseLength(value, unit)` — wrappers around `ShophelperUnits` + `ShophelperDecimal`
  - `braCupStep(system, cup)` / `braCupLetter(system, step)` including US aliases
- Consumes: `ShophelperUnits`, `ShophelperDecimal` (CommonJS require in Node, globals in the browser — same UMD wrapper as `js/units.js`).

- [ ] **Step 1: Write failing tests** in `test/sizes.test.js` (copy the `test` / `assert` harness from `test/shophelper.test.js`). Required cases:

```javascript
const assert = require('assert');
const sizes = require('../js/sizes');

test('women US 8 is UK 12, EU-DE 38, EU-FR 40, IT 44, JP 13, letter M', () => {
  const out = sizes.convertClothing({ category: 'women', from: 'us', size: '8' });
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.equivalents.uk, '12');
  assert.strictEqual(out.equivalents.au, '12');
  assert.strictEqual(out.equivalents['eu-de'], '38');
  assert.strictEqual(out.equivalents['eu-fr'], '40');
  assert.strictEqual(out.equivalents.it, '44');
  assert.strictEqual(out.equivalents.jp, '13');
  assert.strictEqual(out.equivalents.letter, 'M');
});

test('women in-between size returns neighbours, not a fake row', () => {
  const out = sizes.convertClothing({ category: 'women', from: 'us', size: '9' });
  assert.strictEqual(out.ok, true);
  assert.ok(out.neighbours);
  assert.deepStrictEqual(out.neighbours.map((n) => n.equivalents.us), ['8', '10']);
});

test('unknown clothing size fails closed', () => {
  const out = sizes.convertClothing({ category: 'women', from: 'us', size: '99' });
  assert.strictEqual(out.ok, false);
});

test('men 40 in chest suggests M / US 38-40 / EU 48-50', () => {
  const out = sizes.suggestFromMeasurements({
    category: 'men',
    measurements: { chest: '101' }
  });
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.equivalents.letter, 'M');
});

test('men 94 cm chest is between S and M', () => {
  const out = sizes.suggestFromMeasurements({
    category: 'men',
    measurements: { chest: '94' }
  });
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.between, true);
});

test('bra US 32C is UK 32C, EU 70C, FR 85C, AU 10C, JP 70C', () => {
  const out = sizes.convertBra({ from: 'us', band: '32', cup: 'C' });
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.equivalents.uk.label, '32C');
  assert.strictEqual(out.equivalents.eu.label, '70C');
  assert.strictEqual(out.equivalents.fr.label, '85C');
  assert.strictEqual(out.equivalents.au.label, '10C');
  assert.strictEqual(out.equivalents.jp.label, '70C');
});

test('bra cups after D map by step, not letter (US DDD = UK E = EU F)', () => {
  const out = sizes.convertBra({ from: 'us', band: '34', cup: 'DDD' });
  assert.strictEqual(out.equivalents.uk.cup, 'E');
  assert.strictEqual(out.equivalents.eu.cup, 'F');
  const alt = sizes.convertBra({ from: 'us', band: '34', cup: 'F' });
  assert.deepStrictEqual(alt.equivalents.uk, out.equivalents.uk);
});

test('bra sister sizes of 32C include 30D and 34B', () => {
  const out = sizes.convertBra({ from: 'uk', band: '32', cup: 'C' });
  const labels = out.sisters.map((s) => s.equivalents.uk.label).sort();
  assert.deepStrictEqual(labels, ['30D', '34B']);
  assert.ok(out.sisters.every((s) => s.steps === 1));
});

test('bra wider sisters of 32C are 28DD and 36A and marked less reliable', () => {
  const out = sizes.convertBra({ from: 'uk', band: '32', cup: 'C' });
  const labels = out.sistersMore.map((s) => s.equivalents.uk.label).sort();
  assert.deepStrictEqual(labels, ['28DD', '36A']);
  assert.ok(out.sistersMore.every((s) => s.steps === 2 && s.reliable === false));
});

test('AU bra 10 is not treated as a 10-inch band', () => {
  const out = sizes.convertBra({ from: 'au', band: '10', cup: 'C' });
  assert.strictEqual(out.equivalents.us.band, '32');
});

test('shoe convert goes through foot length; JP 24.5 is 245 mm', () => {
  const out = sizes.convertShoe({ from: 'jp', size: '24.5' });
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.footMm, '245');
  assert.strictEqual(out.equivalents.mondo, '245');
});

// After entering ISO 19407 Table 2 values, lock one mid-size adult row:
test('ISO Table 2 reference row is stable', () => {
  const out = sizes.convertShoe({ from: 'mm', size: '260' });
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.equivalents.mondo, '260');
  assert.strictEqual(out.equivalents.jp, '26.0');
  // Fill eu / uk / usMen / usWomen from Table 2 during implementation and assert them here.
});

test('cm and inches round-trip a waist of 74 cm', () => {
  const inches = sizes.displayLength('74', 'in');
  const back = sizes.parseLength(inches, 'in');
  assert.ok(Math.abs(Number(back) - 74) < 0.1);
});
```

- [ ] **Step 2: Run tests and confirm they fail**

```bash
node test/sizes.test.js
```

Expected: FAIL because `js/sizes.js` is missing (or exports are missing).

- [ ] **Step 3: Implement `js/sizes.js`**

UMD wrapper like `js/units.js`. Put clothing and bra tables in the file as plain objects (the spec’s women’s and bra-band tables, men’s chest ranges, cup-step map). For shoes, add a compact `SHOES` array of `{ footMm, eu, uk, usMen, usWomen }` built from ISO 19407:2023 Table 2, with a comment:

```javascript
// Adult recommended markings from ISO 19407:2023 Table 2 (foot length in mm).
// Guideline only; lasts and brands vary. Not a reproduction of the standard text.
```

Conversion rules:

- Clothing: exact row match on the from-system column (string compare after trim; accept `8` and `08`). In-between numeric values → `{ ok: true, neighbours: [lower, upper] }` when both exist, else `{ ok: false }`.
- Bra band: exact row match. Cup: `braCupStep` then `braCupLetter`. Immediate sisters (`sisters`): band ± 1 row, cup step ∓ 1. Wider sisters (`sistersMore`): ± 2, each with `reliable: false`. Skip a side if the band row or cup step does not exist. This is the r/ABraThatFits volume rule, not a bust-circumference match.
- Shoes: if `from` is `mm`/`cm`/`mondo`/`jp`, snap to the nearest table `footMm` (5 mm grid) and label the result as nearest. If `from` is a regional size, find the matching table row (exact, including halves like `7.5`). Out of adult range → `{ ok: false, reason: 'out-of-range' }`.
- `suggestFromMeasurements`: women’s bust (then waist/hip if present) against typical ranges; men’s chest against the men’s table; bra from underbust (closest band, tie → larger) plus optional cup hint from bust − underbust. Always set `approximate: true`.

- [ ] **Step 4: Run tests until they pass**

```bash
node test/sizes.test.js
```

Expected: `all passed`. Fill the ISO shoe reference assertion with the real Table 2 numbers in the same change.

- [ ] **Step 5: Commit**

```bash
git add js/sizes.js test/sizes.test.js
git commit -m "feat: add clothing, bra, and shoe size conversion tables"
```

---

### Task 2: People store + home backup mirror (TDD)

**Files:**
- Create: `js/sizes-store.js`
- Modify: `test/sizes.test.js`
- Modify: `js/store.js`
- Modify: `js/home.js`

**Interfaces:**
- Produces `ShophelperSizesStore`:
  - `KEY` = `'shophelper_sizes_v1'`
  - `defaults()`, `load()`, `save(doc)`, `withStorage(ls)`
  - `addPerson({ name, note })` → person (uuid, empty measurements/saved)
  - `renamePerson(id, name)`, `setNote(id, note)`, `deletePerson(id)`
  - `selectPerson(id|null)`
  - `setMeasurement(id, field, valueCm)` — `field` is a core id; empty string deletes the key
  - `addCustom(id, { label, valueCm })`, `removeCustom(id, customId)`, `setCustom(id, customId, { label, valueCm })`
  - `setSaved(id, kind, payload)` — `kind` is `tops` | `bottoms` | `bra` | `shoes`; `payload` null clears
  - `setDisplayUnit(idOrNull, 'cm'|'in')` — person id, or document default when null
  - `mirrorToHome()`
- Consumes: `ShophelperStore` (optional; mirror is a no-op if absent). UUID helper copied from `js/list-store.js`.

- [ ] **Step 1: Write failing store + backup tests**

```javascript
const sizesStore = require('../js/sizes-store');
const shopStore = require('../js/store');

function mem() {
  const data = {};
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; }
  };
}

test('sizes store defaults to no people', () => {
  const d = sizesStore.defaults();
  assert.strictEqual(d.version, 1);
  assert.strictEqual(d.selectedPersonId, null);
  assert.deepStrictEqual(d.people, []);
  assert.strictEqual(d.displayUnit, 'cm');
});

test('add, measure, and delete a person', () => {
  const api = sizesStore.withStorage(mem());
  const p = api.addPerson({ name: 'Alex' });
  api.setMeasurement(p.id, 'waist', '74');
  api.setSaved(p.id, 'shoes', { system: 'eu', size: '38', width: '', note: '' });
  const loaded = api.load().people[0];
  assert.strictEqual(loaded.measurements.waist, '74');
  assert.strictEqual(loaded.saved.shoes.size, '38');
  api.deletePerson(p.id);
  assert.strictEqual(api.load().people.length, 0);
});

test('sizes document mirrors into shophelper_v1.sizes', () => {
  const ls = mem();
  const api = sizesStore.withStorage(ls);
  const shop = shopStore; // point both at the same ls in the implementation (injectable storage, same as list-store)
  // Implementation: sizes-store and store must accept withStorage or read the injected ls
  const p = api.addPerson({ name: 'Alex' });
  const home = JSON.parse(ls.getItem('shophelper_v1'));
  assert.strictEqual(home.sizes.people[0].id, p.id);
});

test('store merge keeps sizes on round-trip', () => {
  const merged = shopStore.readBundle({
    app: 'shophelper',
    v: 1,
    data: { settings: {}, sizes: { version: 1, selectedPersonId: null, displayUnit: 'cm', people: [{ id: 'p1', name: 'Alex', measurements: { waist: '74' }, custom: [], saved: {} }] } }
  });
  assert.strictEqual(merged.sizes.people[0].name, 'Alex');
});
```

Adapt the mirror test to however `ShophelperStore` storage is injected. If `js/store.js` has no `withStorage` today, add a small `withStorage` (or a test-only hook) rather than stubbing `global.localStorage` in a fragile way. Prefer matching `list-store`’s `withStorage` pattern, and if `js/store.js` needs the same hook for this test, add it here (keep the public API backward compatible).

- [ ] **Step 2: Run and confirm new tests fail**

```bash
node test/sizes.test.js
```

- [ ] **Step 3: Implement the store and wire the home bundle**

`defaults` / `merge` in `js/sizes-store.js` must ignore unknown future keys on a person but drop malformed people (missing `id` or `name`). `deletePerson` clears `selectedPersonId` if it was that id.

In `js/store.js`:

- `defaults()` includes `sizes: null`
- `merge()` copies `raw.sizes` when it is a non-null object
- `readBundle()` still accepts a backup that has no `sizes`

In `js/home.js` restore path, after `Store.save(pending)`, also write `pending.sizes` to `localStorage['shophelper_sizes_v1']` when present (same pattern as `pending.shoppingList` → `shophelper_list_v1`).

Update the import preview text to mention how many people are in the backup, and extend `backupNote` in i18n in Task 3 (can land with the strings).

- [ ] **Step 4: Tests pass**

```bash
node test/sizes.test.js
node test/shophelper.test.js
```

Expected: both exit 0. Existing shopping-list backup tests must still pass.

- [ ] **Step 5: Commit**

```bash
git add js/sizes-store.js js/store.js js/home.js test/sizes.test.js
git commit -m "feat: store people measurements and mirror them in home backup"
```

---

### Task 3: Tool page, home tile, i18n, service worker

**Files:**
- Create: `tools/sizes/index.html`, `tools/sizes/page.js`
- Modify: `index.html`, `js/i18n.js`, `sw.js`, `README.md`, `docs/m0-inventory.md`

**Interfaces:**
- Consumes: `Shophelper`, `ShophelperSizes`, `ShophelperSizesStore`, `ShophelperUnits`, `ShophelperI18n`
- Produces: a working `/tools/sizes/index.html` page and a home-grid tile

- [ ] **Step 1: Add `tools/sizes/index.html`**

Copy the Units page shell (`data-sh-auto`, `data-sh-title="Sizing"`, `data-sh-root="../.."`, same script order: decimal → units → napkin → mental → tax → prices → results → rates → store → i18n → shell → `../sizes` modules → `page.js`). Two cards or tabs: People, Convert. Include:

- `#people` switcher, add/rename/delete, measurements form, custom rows, saved-label fields
- `#convert` category tabs for **Women’s clothing, Men’s clothing, Bra, and Shoes** (all required), from-system, value (bra: band + cup), results list including sister sizes on the bra tab, disclaimer `data-i18n="sizesDisclaimer"`
- cm/in toggle

No new CSS framework. Reuse `.sh-page`, `.sh-card`, `.sh-btn`, `.sh-label`, `.sh-note`, `.sh-tabs`. Add only a few rules in `shell.css` if a two-column result list needs them — keep that minimal.

- [ ] **Step 2: Implement `tools/sizes/page.js`**

- Load/save through `ShophelperSizesStore` only.
- Switching people re-renders the form from the store (do not keep a stale in-memory copy after a save).
- Measurement inputs: parse with `ShophelperSizes.parseLength` using the person’s display unit; store cm.
- Delete uses `Shophelper.openDialog` / confirm + `pushBack`, same as other tools.
- Convert: on input, call the matching `convert*` and render equivalents as a definition list. In-between clothing sizes list both neighbours. On the bra tab, show immediate sister sizes first, then a quieter ±2 line labelled as less reliable, plus a one-line volume-vs-fit note (ABTF). Failures show `Cannot convert` (i18n).
- “Use [name]” fills convert inputs from the selected person when the needed fields exist; otherwise toast that the measurement is missing.
- Do not call `Shophelper.publish`.

- [ ] **Step 3: Home tile, i18n, SW, docs**

Home tile (place **after Units**). Label: **Sizing**. Description: “Body measurements, clothing, bra, and shoe conversions.” SVG mark: a simple measuring-tape loop, same 24×24 stroke style as the other tiles.

Minimum i18n keys (EN + 繁): `toolSizes` (value: Sizing / 尺碼), `toolSizesDesc` (the long description above), `sizesDisclaimer`, `sizesPeople`, `sizesConvert`, `sizesAddPerson`, `sizesRename`, `sizesDelete`, `sizesDeleteConfirm`, `sizesNote`, `sizesSaved`, `sizesCustom`, `sizesAddCustom`, `sizesUsePerson`, `sizesMissingMeasure`, `sizesCannotConvert`, `sizesBetween`, `sizesSister`, `sizesSisterMore`, `sizesSisterNote`, `sizesCm`, `sizesIn`, plus labels for every measurement id, convert category, and system. Update `backupNote` so it lists Sizes alongside Shopping List.

`sw.js`: set `CACHE` to `'shophelper-v18'` and append:

```javascript
'./js/sizes.js',
'./js/sizes-store.js',
'./tools/sizes/index.html',
'./tools/sizes/page.js',
```

README: add Sizing to the tools list and mention `shophelper_sizes_v1` in Data. `docs/m0-inventory.md`: new row for the tool (storage key + home mirror). Tests section: add `node test/sizes.test.js`.

- [ ] **Step 4: Manual web smoke**

```bash
python -m http.server 8787
```

Open `/`, tap Sizes, add two people, fill waist + shoes, convert a US 8, a 32C, and a JP 24.5 shoe, toggle language and theme, export/import backup, confirm the people return. Toggle airplane mode and reopen the tool (cached).

- [ ] **Step 5: Commit**

```bash
git add tools/sizes index.html js/i18n.js sw.js shell.css README.md docs/m0-inventory.md
git commit -m "feat: add Sizing tool page and home tile"
```

---

### Task 4: Android shortcut

**Files:**
- Modify: `android/app/src/main/res/xml/shortcuts.xml`
- Modify: `android/app/src/main/res/values/strings.xml`
- Modify: `android/app/src/main/res/values-zh/strings.xml` only if that folder already exists; otherwise EN string is enough for this pass (or add `values-zh` to match existing translations)

- [ ] **Step 1: Add shortcut**

Copy an existing `<shortcut>` block. `android:shortcutId="sizes"`, extra `js.path` = `/tools/sizes/index.html`, labels `@string/shortcut_sizes`. English label: `Sizing`. 繁 if a zh strings file exists: `尺碼` (or the same word chosen in i18n).

- [ ] **Step 2: Build and install**

```bash
npm run android:apk
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Long-press Shophelper → Sizing (if the launcher shows it among the shortcuts) → lands on the tool. Confirm the page works offline in the WebView.

- [ ] **Step 3: Commit**

```bash
git add android/app/src/main/res
git commit -m "feat: add Android shortcut for Sizing"
```

---

### Task 5: End-to-end verification

**Files:** none new (fixes only if smoke fails)

- [ ] **Step 1:** `node test/sizes.test.js` and `node test/shophelper.test.js` — both exit 0.
- [ ] **Step 2: Web smoke checklist**
  - [ ] Home tile opens Sizing
  - [ ] Two people, measurements, custom row, saved labels survive reload
  - [ ] Women’s US 8 shows UK 12 and *both* EU 38 and EU 40
  - [ ] Bra US DDD/F maps to UK E; AU 10C maps to 32C; immediate sisters of 32C are 30D and 34B; ±2 sisters are shown as less reliable
  - [ ] Shoe JP 24.5 shows 245 mm and the locked ISO equivalents
  - [ ] Unknown size shows Cannot convert
  - [ ] Disclaimer visible
  - [ ] Home export JSON contains `sizes`; import restores `shophelper_sizes_v1`
  - [ ] EN / 繁 and light / dark work
- [ ] **Step 3: Android smoke** — `adb install -r`, shortcut (if shown), offline use
- [ ] **Step 4: Commit any fixes** if needed

```bash
git commit -m "fix: Sizing tool smoke fixes"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
| --- | --- |
| Shell-native tool | Task 3 |
| Own key + home mirror | Task 2 |
| People CRUD, core + custom measurements, saved labels | Task 2–3 |
| cm/in display, store in cm | Task 1–3 |
| Women’s/men’s clothing tables, EU-DE vs EU-FR vs IT | Task 1, 5 |
| CN via measurements only | Task 1, 3 |
| Bra bands, post-D cup steps, aliases, ABTF sister sizes (±1 and ±2), AU ≠ inches | Task 1, 5 |
| Shoes via foot length / ISO 19407 Table 2 | Task 1, 5 |
| Suggest size from measurements, approximate only | Task 1, 3 |
| Disclaimer, no result bar, no share, no brand/kids | Task 3 (and explicit omissions) |
| Home tile, i18n, SW, README, inventory | Task 3 |
| Android shortcut | Task 4 |

## Placeholder scan

Shoe EU/UK/US cells are deliberately filled from ISO 19407 Table 2 at Task 1 Step 3 — that is a sourced lookup, not an open TBD. No other placeholders.

## Type consistency

- Storage key: `shophelper_sizes_v1`
- Home mirror field: `shophelper_v1.sizes`
- Globals: `ShophelperSizes`, `ShophelperSizesStore`
- System ids: `us`, `uk`, `au`, `eu-de`, `eu-fr`, `it`, `jp`, `eu`, `fr`, `us-m`, `us-w`, `mondo`, `cm`, `mm`, `letter`
- Saved kinds: `tops`, `bottoms`, `bra`, `shoes`
