# Shopping List tool — design

**Date:** 2026-11-17  
**Status:** Approved for planning  
**Scope:** New offline Shopping List module + Android long-press shortcuts for all home tools

## Goal

Add a shell-native **Shopping List** tool for recurring staples, one-off items, trip check-off, and serverless QR/link sharing. Include Android app shortcuts so a long-press on the Shophelper icon jumps straight into each tool.

## Context (this codebase)

Shophelper is a static PWA + Capacitor Android wrapper (`com.fishese.shophelper`). Tools live under `tools/<name>/` and use shell chrome (`shell.css`, `js/shell.js`, i18n). Coupons already ships QR generate/scan CDNs (`qrcode-generator`, `jsQR`, `html5-qrcode`). There are no Android App Shortcuts or custom deep-link intent filters today.

External Kotlin/Room apps (GroceryGenius, Addtolist) are inspiration only — do **not** copy their stack.

## Decisions

| Topic | Choice |
| --- | --- |
| List count | One active list now; data shaped for multiple lists later |
| Share payload | Active trip items only; short reserved field for future staples |
| Import merge | Always offered; prefer simple title match when obvious, else allow duplicates |
| Storage | Own `localStorage` key **and** mirror into home `shophelper_v1` backup |
| Cartulator/Coupons in home backup | **Out of this pass** (follow-up) |
| Import UX | Paste link + in-app QR scan + show QR / share / copy |
| Architecture | Shell-native tool (like Prices/Units), not Coupons-style mini-app |
| Share URL | Hash payload on the tool page (`#d=…`) — no custom scheme in v1 |
| Reorder | Native HTML5 drag-and-drop + up/down buttons (no DnD library) |
| Checked UI | Strikethrough in the Checked section |

## Approach

| Piece | Role |
| --- | --- |
| `tools/shopping-list/index.html` + `page.js` | UI + logic |
| `shophelper_list_v1` | Source-of-truth localStorage |
| `shophelper_v1.shoppingList` | Mirror for home Export/Import |
| Coupons QR CDNs (same versions) | Generate + scan |
| `res/xml/shortcuts.xml` + manifest meta-data | Android long-press shortcuts |
| Home tile + `js/i18n.js` + `sw.js` ASSETS | Discoverability / offline precache |

## Data model

### Root document (`shophelper_list_v1`)

```json
{
  "version": 1,
  "activeListId": "<uuid>",
  "lists": [
    {
      "id": "<uuid>",
      "name": "Shopping",
      "items": []
    }
  ]
}
```

v1 always has exactly one list; UI does not expose a list switcher. Multi-list later = add lists + switcher without changing item shape.

### Item

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string (UUID) | Stable local id |
| `title` | string | Display name |
| `quantity` | string (optional) | Free text, e.g. `"2"`, `"500g"`; default treat as `"1"` when empty |
| `note` | string (optional) | Free text |
| `isRecurring` | boolean | Staple vs one-off |
| `isActive` | boolean | On the current trip list |
| `isChecked` | boolean | Crossed off this trip |
| `sort` | number | Order within the list (lower = higher on screen) |

Normalize titles when attempting match: `title.trim().toLowerCase()`.

**Dedup policy:** Prefer matching on normalized title for Quick Add / staple reactivation when a single clear match exists. If matching is ambiguous or awkward (e.g. import merge), **allow duplicate rows** rather than blocking the action. Merge must remain available even when duplicates result.

### Lifecycle

1. **Add:** If a single clear normalized-title match exists → set `isActive=true`, `isChecked=false`, update quantity/note as provided, set `isRecurring = existing || incoming`. Otherwise **insert** a new active unchecked row (duplicates OK when no clear match).
2. **Create idle staple:** `isRecurring=true`, `isActive=false`, `isChecked=false`.
3. **Tap idle staple:** `isActive=true`, `isChecked=false` (keep `sort` or append to end of to-buy — **append to end**).
4. **Check / uncheck:** Toggle `isChecked`; item stays `isActive`.
5. **Finish trip / Clear checked:** For each `isActive && isChecked`: if not recurring → **delete**; if recurring → `isActive=false`, `isChecked=false` (returns to staples pool).
6. **Reorder:** Update `sort` via drag-and-drop or up/down within the current section (to-buy and checked each ordered by `sort`).

### Home backup mirror

- On every list save, write a clone of `shophelper_list_v1` into `shophelper_v1.shoppingList`.
- On home import, if bundle contains `shoppingList`, write it back to `shophelper_list_v1` as well as into the merged store.
- Extend `ShophelperStore.defaults` / `merge` / `readBundle` enough to round-trip `shoppingList` without dropping it.

## UI

Shell tool page using existing tokens (`.sh-page`, `.sh-card`, `.sh-btn`, …), EN/繁 via `js/i18n.js`.

- **Quick add bar:** text + Recurring/One-off toggle + Add; autocomplete from idle staples.
- **To buy:** `isActive && !isChecked`; check, staple toggle, remove, drag handle + up/down.
- **Checked:** `isActive && isChecked`; **strikethrough** title; same controls; collapsible; **Finish trip / Clear checked**.
- **Staples pool:** idle recurring chips/list; tap to add; manage/delete staples.
- **Share / Import:** header actions → modal with QR, Share link, Copy link; Import via paste or scan → preview → **Merge** or **Replace**.

Hardware back: reuse `Shophelper.pushBack` for modals/sheets (same pattern as other tools).

## Share / import (serverless)

### Payload schema v1

```json
{
  "v": 1,
  "n": "Shopping",
  "i": [
    { "t": "Milk", "q": "2", "r": 1, "c": 0, "o": 0 }
  ]
}
```

| Key | Meaning |
| --- | --- |
| `v` | Schema version (`1`) |
| `n` | List name (optional) |
| `i` | **Active** items only (`isActive` implied true) |
| `t` | Title |
| `q` | Quantity (omit if empty/default) |
| `r` | `1` recurring / `0` one-off |
| `c` | `1` checked / `0` unchecked |
| `o` | Sort order (optional; importer can reassign) |
| `s` | **Reserved** for future staples pool (omit in v1 exporters; importers ignore unknown keys / empty `s`) |

No encryption. Compact via short keys + gzip.

### Encoding

1. `JSON.stringify` UTF-8  
2. gzip  
3. base64url (no padding)  
4. URL:  
   `{origin}/tools/shopping-list/index.html#d=<payload>`  
   In Capacitor, use the app’s served path equivalently (relative `#d=` on the tool page is enough when sharing from inside the app; absolute https origin preferred when a public/static host exists — for APK-only installs, share the `#d=` URL string and prefer QR + in-app paste/scan).

### Flows

- **Export:** Serialize active items → encode → QR bitmap + system share + clipboard.
- **Import:** Read `#d=` on load, or paste full URL/payload, or scan QR → decode → preview titles/qty/flags →  
  - **Merge (required option):** Append imported items into the current list as new active rows (or reactivate a single clear title match when easy). **Duplicates are allowed** — do not drop merge because dedup is hard. Idle local staples kept.  
  - **Replace:** Delete all currently active items, then insert imported items as active; idle staples unchanged.

## Android app shortcuts

Add static shortcuts (long-press launcher icon) for every home tool:

| Shortcut | Target (in WebView / activity) |
| --- | --- |
| Shopping List | `…/tools/shopping-list/index.html` |
| Cartulator | `…/tools/cartulator/index.html` |
| Coupons | `…/tools/coupons/index.html` |
| Deal Checker | `…/tools/deals/index.html` |
| Units | `…/tools/units/index.html` |
| Currency | `…/tools/currency/index.html` |
| Tax & Refund | `…/tools/tax/index.html` |
| Prices | `…/tools/prices/index.html` |

Implementation sketch: `res/xml/shortcuts.xml` + `android.app.shortcuts` meta-data on the launcher activity; intents open `MainActivity` with an extra or `https` path Cap App can read — prefer Capacitor-friendly pattern: intent data URI under the app’s `https` asset host / `BridgeActivity` launch with path, or `getIntent()` → `window.location` on boot. Exact wiring chosen at plan time to match Capacitor 7.

Optional follow-up (not required for Android long-press): root `manifest.webmanifest` `shortcuts` for installed PWA.

## Out of scope (this pass)

- Multiple named lists UI  
- Exporting/importing staples pool (`s`)  
- Folding Cartulator/Coupons into home backup  
- Custom `shophelper://` scheme / App Links hosting  
- Play Store listing  
- Categories taxonomy beyond free-text `note`

## Success criteria

1. User can maintain staples, add one-offs, check items (strikethrough), reorder, and finish a trip with correct staple recycling.  
2. User can share active trip via QR/link and import with merge or replace (active-only).  
3. List survives app restart; appears in home JSON backup via `shoppingList`.  
4. Long-press Shophelper icon shows shortcuts into each tool.  
5. Works offline in the Capacitor APK after `cap:sync`.

## Implementation notes

- Add home tile + i18n keys; bump `sw.js` cache and precache new assets.  
- Reuse Coupons CDN script URLs/versions for QR; do not vendor a second QR stack.  
- Keep page self-contained in `page.js` unless a tiny shared `js/list-codec.js` helps gzip/base64 reuse.
