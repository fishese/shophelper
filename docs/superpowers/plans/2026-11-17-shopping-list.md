# Shopping List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an offline Shopping List tool (staples, one-offs, check-off, reorder, QR/link share+import) and Android long-press shortcuts into every home tool.

**Architecture:** Shell-native page at `tools/shopping-list/` with logic in shared `js/list-store.js` + `js/list-codec.js`. Own key `shophelper_list_v1`, mirrored into `shophelper_v1.shoppingList` for home backup. Share via gzip+base64url in `#d=`. Android static shortcuts launch `MainActivity` with a path Cap App JS applies on boot.

**Tech Stack:** Existing PWA shell (vanilla JS), `pako` + Coupons QR CDNs (`qrcode-generator`, `jsQR`, `html5-qrcode`), Capacitor 7 Android shortcuts XML + minimal `MainActivity` / boot hook.

**Spec:** `docs/superpowers/specs/2026-11-17-shopping-list-design.md`

## Global Constraints

- One active list in UI; data shaped as `{ version, activeListId, lists[] }` for future multi-list.
- Share payload v1 = active trip only; reserved key `s` unused/omitted.
- Merge import always offered; allow duplicates when title match is unclear.
- Replace import = wipe active items only; keep idle staples.
- Checked items show strikethrough; reorder via HTML5 DnD + up/down (no DnD library).
- No Cartulator/Coupons in home backup this pass.
- No custom `shophelper://` scheme this pass.
- Match shell tokens / i18n EN+繁; bump `sw.js` cache when adding assets.
- Conventional commits (`feat`, `fix`, `test`, `chore`).
- APK updates: `adb install -r` only (never uninstall-first unless user asks).

## File map

| File | Responsibility |
| --- | --- |
| `js/list-store.js` | Load/save `shophelper_list_v1`, item mutations, mirror to `ShophelperStore` |
| `js/list-codec.js` | Share payload encode/decode (JSON → pako gzip → base64url) |
| `test/shophelper.test.js` | Unit tests for store + codec (extend existing runner) |
| `js/store.js` | Round-trip `shoppingList` in defaults/merge/readBundle |
| `js/home.js` | After backup restore, also write `shoppingList` → `shophelper_list_v1` |
| `tools/shopping-list/index.html` | Markup + CDN scripts |
| `tools/shopping-list/page.js` | UI wiring |
| `index.html` | Home tile |
| `js/i18n.js` | Strings |
| `sw.js` | Precache + cache bump |
| `js/shell.js` (small) | Optional: honor `?tool=` / launch path for shortcuts |
| `android/.../shortcuts.xml` | Static shortcut definitions |
| `android/.../AndroidManifest.xml` | `android.app.shortcuts` meta-data |
| `android/.../MainActivity.java` | Forward shortcut extra into WebView URL |

---

### Task 1: List store + codec (TDD)

**Files:**
- Create: `js/list-store.js`
- Create: `js/list-codec.js`
- Modify: `test/shophelper.test.js`
- Modify: `js/store.js` (mirror helpers only if needed by store save)

**Interfaces:**
- Produces:
  - `ShophelperListStore`: `{ KEY, defaults, load, save, activeList, addItem, toggleChecked, setRecurring, removeItem, activateStaple, finishTrip, moveItem, importMerge, importReplace, mirrorToHome }`
  - `ShophelperListCodec`: `{ encodeShare(docOrList) → string, decodeShare(text) → payload, buildUrl(payloadB64, baseHref) → string, parseUrl(urlOrHash) → string|null }`
- Consumes: `ShophelperStore` (optional mirror), browser/`pako` for gzip in codec tests via Node — for Node tests, implement codec using `zlib.gzipSync` / `zlib.gunzipSync` when `pako` absent, and `pako` in browser.

- [ ] **Step 1: Write failing tests for store + codec**

Append to `test/shophelper.test.js`:

```javascript
const listStore = require('../js/list-store');
const listCodec = require('../js/list-codec');

test('list store defaults one empty list', () => {
  const d = listStore.defaults();
  assert.strictEqual(d.version, 1);
  assert.ok(d.activeListId);
  assert.strictEqual(d.lists.length, 1);
  assert.deepStrictEqual(d.lists[0].items, []);
});

test('list addItem inserts active unchecked', () => {
  const mem = { data: null };
  const api = listStore.withStorage({
    getItem: () => mem.data,
    setItem: (_k, v) => { mem.data = v; }
  });
  api.save(api.defaults());
  const item = api.addItem({ title: ' Milk ', quantity: '2', isRecurring: false });
  assert.strictEqual(item.title, 'Milk');
  assert.strictEqual(item.isActive, true);
  assert.strictEqual(item.isChecked, false);
  assert.strictEqual(item.isRecurring, false);
});

test('list addItem reactivates single clear title match', () => {
  const mem = { data: null };
  const api = listStore.withStorage({
    getItem: () => mem.data,
    setItem: (_k, v) => { mem.data = v; }
  });
  api.save(api.defaults());
  const a = api.addItem({ title: 'Eggs', isRecurring: true });
  api.finishTrip(); // eggs → idle staple
  const b = api.addItem({ title: 'eggs', quantity: '12' });
  assert.strictEqual(b.id, a.id);
  assert.strictEqual(b.isActive, true);
  assert.strictEqual(b.isRecurring, true);
  assert.strictEqual(b.quantity, '12');
});

test('list finishTrip deletes one-offs and idles staples', () => {
  const mem = { data: null };
  const api = listStore.withStorage({
    getItem: () => mem.data,
    setItem: (_k, v) => { mem.data = v; }
  });
  api.save(api.defaults());
  const staple = api.addItem({ title: 'Rice', isRecurring: true });
  const once = api.addItem({ title: 'Cake', isRecurring: false });
  api.toggleChecked(staple.id, true);
  api.toggleChecked(once.id, true);
  api.finishTrip();
  const list = api.activeList();
  assert.ok(!list.items.find((i) => i.id === once.id));
  const rice = list.items.find((i) => i.id === staple.id);
  assert.ok(rice);
  assert.strictEqual(rice.isActive, false);
  assert.strictEqual(rice.isChecked, false);
});

test('list importMerge allows duplicate titles', () => {
  const mem = { data: null };
  const api = listStore.withStorage({
    getItem: () => mem.data,
    setItem: (_k, v) => { mem.data = v; }
  });
  api.save(api.defaults());
  api.addItem({ title: 'Milk', isRecurring: false });
  api.importMerge([{ t: 'Milk', q: '1', r: 0, c: 0 }]);
  const milks = api.activeList().items.filter((i) => i.title.toLowerCase() === 'milk' && i.isActive);
  assert.ok(milks.length >= 2);
});

test('list importReplace keeps idle staples', () => {
  const mem = { data: null };
  const api = listStore.withStorage({
    getItem: () => mem.data,
    setItem: (_k, v) => { mem.data = v; }
  });
  api.save(api.defaults());
  const staple = api.addItem({ title: 'Butter', isRecurring: true });
  api.finishTrip();
  api.addItem({ title: 'Chips', isRecurring: false });
  api.importReplace([{ t: 'Salsa', r: 0, c: 0 }]);
  const list = api.activeList();
  assert.ok(list.items.find((i) => i.id === staple.id && !i.isActive));
  assert.ok(list.items.find((i) => i.title === 'Salsa' && i.isActive));
  assert.ok(!list.items.find((i) => i.title === 'Chips' && i.isActive));
});

test('list codec round-trip', () => {
  const b64 = listCodec.encodeShare({
    v: 1,
    n: 'Shopping',
    i: [{ t: 'Milk', q: '2', r: 1, c: 0, o: 0 }]
  });
  assert.ok(b64.length > 8);
  assert.ok(!/[+/=]/.test(b64)); // url-safe, no pad
  const payload = listCodec.decodeShare(b64);
  assert.strictEqual(payload.v, 1);
  assert.strictEqual(payload.i[0].t, 'Milk');
});

test('list codec parseUrl reads #d=', () => {
  const b64 = listCodec.encodeShare({ v: 1, i: [{ t: 'Tea', r: 0, c: 0 }] });
  const url = 'https://example.com/tools/shopping-list/index.html#d=' + b64;
  assert.strictEqual(listCodec.parseUrl(url), b64);
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `node test/shophelper.test.js`

Expected: FAIL on missing modules / undefined exports.

- [ ] **Step 3: Implement `js/list-codec.js`**

```javascript
'use strict';

(function (global, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else global.ShophelperListCodec = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function bytesToB64Url(u8) {
    var bin = '';
    for (var i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
    var b64 = (typeof btoa === 'function')
      ? btoa(bin)
      : Buffer.from(u8).toString('base64');
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function b64UrlToBytes(s) {
    var b64 = String(s).replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    if (typeof atob === 'function') {
      var bin = atob(b64);
      var out = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }

  function gzipSync(u8) {
    if (typeof require === 'function') {
      try { return new Uint8Array(require('zlib').gzipSync(Buffer.from(u8))); } catch (e) {}
    }
    if (globalThis.pako && pako.gzip) return pako.gzip(u8);
    throw new Error('gzip unavailable');
  }

  function gunzipSync(u8) {
    if (typeof require === 'function') {
      try { return new Uint8Array(require('zlib').gunzipSync(Buffer.from(u8))); } catch (e) {}
    }
    if (globalThis.pako && pako.ungzip) return pako.ungzip(u8);
    throw new Error('gunzip unavailable');
  }

  function encodeShare(payload) {
    var json = JSON.stringify(payload);
    var raw = (typeof TextEncoder !== 'undefined')
      ? new TextEncoder().encode(json)
      : Uint8Array.from(Buffer.from(json, 'utf8'));
    return bytesToB64Url(gzipSync(raw));
  }

  function decodeShare(text) {
    var s = String(text || '').trim();
    // Accept raw b64 or full URL
    var fromUrl = parseUrl(s);
    if (fromUrl) s = fromUrl;
    var bytes = gunzipSync(b64UrlToBytes(s));
    var json = (typeof TextDecoder !== 'undefined')
      ? new TextDecoder().decode(bytes)
      : Buffer.from(bytes).toString('utf8');
    var payload = JSON.parse(json);
    if (!payload || payload.v !== 1 || !Array.isArray(payload.i)) throw new Error('bad payload');
    return payload;
  }

  function buildUrl(b64, baseHref) {
    var base = String(baseHref || '').split('#')[0];
    return base + '#d=' + b64;
  }

  function parseUrl(urlOrHash) {
    var s = String(urlOrHash || '');
    var m = s.match(/[#&?]d=([A-Za-z0-9\-_]+)/);
    return m ? m[1] : null;
  }

  return { encodeShare: encodeShare, decodeShare: decodeShare, buildUrl: buildUrl, parseUrl: parseUrl };
});
```

- [ ] **Step 4: Implement `js/list-store.js`**

Implement UMD module with:
- `KEY = 'shophelper_list_v1'`
- `defaults()`, `load()`, `save(doc)`, `withStorage(ls)` for tests
- `uuid()` via `crypto.randomUUID` or fallback
- `activeList()`, `normalizeTitle(t)`
- `addItem({ title, quantity, note, isRecurring })` — single clear inactive/active match → reactivate; else insert with `sort = max+1`
- `toggleChecked(id, value?)`, `setRecurring(id, value)`, `removeItem(id)`, `activateStaple(id)`
- `finishTrip()` per spec
- `moveItem(id, direction)` where direction is `-1`/`+1` within same section peers (`isActive&&!isChecked` or `isActive&&isChecked`)
- `importMerge(rows)` — always append new items from `{t,q,r,c,o}` (duplicates OK); map `r/c` to booleans; set active
- `importReplace(rows)` — remove all `isActive` items; insert imported as active; idle staples remain
- `mirrorToHome()` — `ShophelperStore.update(d => { d.shoppingList = load(); })` when Store present

Keep functions small; persist after each mutation.

- [ ] **Step 5: Run tests — expect PASS**

Run: `node test/shophelper.test.js`

Expected: all `ok` lines including new list tests; exit 0.

- [ ] **Step 6: Commit**

```bash
git add js/list-store.js js/list-codec.js test/shophelper.test.js
git commit -m "feat: add shopping list store and share codec"
```

---

### Task 2: Home backup mirror for `shoppingList`

**Files:**
- Modify: `js/store.js`
- Modify: `js/home.js`
- Modify: `js/i18n.js` (`backupNote` text)
- Modify: `test/shophelper.test.js` (one merge round-trip test)

**Interfaces:**
- Consumes: `shoppingList` object shape from list-store defaults
- Produces: `ShophelperStore` preserves `data.shoppingList` through load/save/bundle/readBundle

- [ ] **Step 1: Failing test**

```javascript
const store = require('../js/store');

test('store round-trips shoppingList', () => {
  const data = store.defaults();
  data.shoppingList = { version: 1, activeListId: 'x', lists: [{ id: 'x', name: 'Shopping', items: [] }] };
  const merged = store.readBundle(store.bundle(data));
  assert.ok(merged.shoppingList);
  assert.strictEqual(merged.shoppingList.activeListId, 'x');
});
```

- [ ] **Step 2: Run — expect FAIL** (shoppingList dropped)

- [ ] **Step 3: Patch `js/store.js`**

In `defaults()` add `shoppingList: null`.  
In `merge()`: `base.shoppingList = raw.shoppingList && typeof raw.shoppingList === 'object' ? raw.shoppingList : null`.  
Ensure `readBundle` still calls `merge` (already does).

- [ ] **Step 4: Patch `js/home.js` import confirm**

After `Store.save(pending)` and before reload:

```javascript
try {
  if (pending.shoppingList) {
    localStorage.setItem('shophelper_list_v1', JSON.stringify(pending.shoppingList));
  }
} catch (e) {}
```

- [ ] **Step 5: Update `backupNote` EN/繁** to mention Shopping List is included; Cartulator/Coupons/Deals still separate.

- [ ] **Step 6: Run tests + commit**

```bash
node test/shophelper.test.js
git add js/store.js js/home.js js/i18n.js test/shophelper.test.js
git commit -m "feat: include shopping list in home backup mirror"
```

---

### Task 3: Shopping List page UI (core trip flows)

**Files:**
- Create: `tools/shopping-list/index.html`
- Create: `tools/shopping-list/page.js`
- Modify: `index.html` (home tile)
- Modify: `js/i18n.js` (tool + page strings)
- Modify: `sw.js` (cache bump + ASSETS)

**Interfaces:**
- Consumes: `ShophelperListStore`, `Shophelper`, `ShophelperI18n`
- Produces: Working page without share yet (share in Task 4)

- [ ] **Step 1: Add `tools/shopping-list/index.html`**

Skeleton mirroring Prices: `data-sh-auto`, `data-sh-title`, `data-sh-root="../.."`, shell CSS, theme.js, then:

```html
<main class="sh-page">
  <form id="addForm" class="sh-card">
    <label class="sh-label" for="title" data-i18n="listItem">Item</label>
    <input id="title" list="stapleHints" autocomplete="off" required>
    <datalist id="stapleHints"></datalist>
    <label class="sh-label" for="qty" data-i18n="listQty">Qty</label>
    <input id="qty" placeholder="1">
    <label class="sh-check"><input type="checkbox" id="asStaple"> <span data-i18n="listAsStaple">Recurring staple</span></label>
    <button class="sh-btn primary" type="submit" data-i18n="listAdd">Add</button>
  </form>

  <section class="sh-card">
    <h2 data-i18n="listToBuy">To buy</h2>
    <ul id="toBuy" class="list-rows"></ul>
  </section>

  <section class="sh-card">
    <h2 data-i18n="listChecked">Checked</h2>
    <ul id="checked" class="list-rows"></ul>
    <button class="sh-btn" id="finishTrip" type="button" data-i18n="listFinishTrip">Finish trip / clear checked</button>
  </section>

  <section class="sh-card">
    <h2 data-i18n="listStaples">Staples</h2>
    <div id="staples" class="staple-chips"></div>
  </section>

  <div class="sh-actions">
    <button class="sh-btn" id="shareBtn" type="button" data-i18n="listShare">Share</button>
    <button class="sh-btn" id="importBtn" type="button" data-i18n="listImport">Import</button>
  </div>

  <dialog id="shareDialog"></dialog>
  <dialog id="importDialog"></dialog>
</main>
```

Scripts: `store.js`, `i18n.js`, `list-store.js`, `list-codec.js`, `shell.js`, `page.js`.  
Also include pako CDN for browser codec:  
`https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako.min.js`  
(Share CDNs added in Task 4.)

Minimal CSS in page or a few rules in a `<style>` block: strikethrough `.is-checked .list-title { text-decoration: line-through; opacity: .7; }`, chip layout, drag handle cursor.

- [ ] **Step 2: Implement `page.js` render + mutations**

- `render()` reads `activeList()`, splits toBuy / checked / idle staples, sorts by `sort`.
- Row UI: checkbox, title (+ qty), staple toggle, remove, ↑ ↓, `draggable=true`.
- DnD: `dragstart`/`dragover`/`drop` reorder within the same list element; call store to rewrite `sort` for that section.
- Checked titles use strikethrough class.
- `finishTrip` button → confirm optional → `finishTrip()` → render.
- Staple chip tap → `activateStaple` / `addItem`.
- Wire `Shophelper.pushBack` to close dialogs.
- Call `ShophelperListStore.mirrorToHome()` after saves (or inside store.save).

- [ ] **Step 3: Home tile + i18n**

In `index.html` `nav.sh-grid`, add tile after Prices (or before Cartulator — prefer near top as a daily tool):

```html
<a class="sh-tool" href="tools/shopping-list/index.html">
  <span class="sh-mark">…simple bag SVG…</span>
  <strong data-i18n="toolList">Shopping List</strong>
  <span data-i18n="toolListDesc">Staples, one-offs, and shareable trip lists.</span>
</a>
```

Add EN/繁 keys for all `list*` / `toolList*` strings used.

- [ ] **Step 4: Update `sw.js`**

- Bump `CACHE` to `shophelper-v13`.
- Add `./js/list-store.js`, `./js/list-codec.js`, `./tools/shopping-list/index.html`, `./tools/shopping-list/page.js`.
- Add new icon PNG paths if not already present from prior work.

- [ ] **Step 5: Manual smoke in browser**

Open `tools/shopping-list/index.html`, add staple + one-off, check, reorder, finish trip. Confirm staple returns to pool and one-off deleted; reload persists.

- [ ] **Step 6: Commit**

```bash
git add tools/shopping-list index.html js/i18n.js sw.js
git commit -m "feat: add shopping list tool UI"
```

---

### Task 4: Share + import (QR / link)

**Files:**
- Modify: `tools/shopping-list/index.html` (CDN scripts + dialog markup)
- Modify: `tools/shopping-list/page.js`
- Modify: `sw.js` (optional: do not precache CDNs; network when online)

**Interfaces:**
- Consumes: `ShophelperListCodec`, `qrcode-generator`, `jsQR`, `Html5Qrcode`
- Produces: Share dialog + import merge/replace flow

- [ ] **Step 1: Add CDN tags** (same versions as Coupons)

```html
<script src="https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js"></script>
<script src="https://cdn.jsdelivr.net/npm/qrcode-generator@2.0.4/dist/qrcode.js"></script>
<script src="https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js"></script>
```

- [ ] **Step 2: Share dialog**

On Share:
1. Build payload `{ v:1, n: list.name, i: activeItems mapped to {t,q?,r,c,o} }` — omit `s`.
2. `b64 = ShophelperListCodec.encodeShare(payload)`.
3. `url = ShophelperListCodec.buildUrl(b64, location.href.split('#')[0])`.
4. Draw QR with `qrcode-generator` into `<img>`/`<canvas>`.
5. Buttons: Copy link (`navigator.clipboard.writeText`), Share (`navigator.share` if present, else copy).

- [ ] **Step 3: Import dialog**

- Paste field for URL or raw `#d=` / b64.
- Scan: start `Html5Qrcode` against a host element (camera); also allow image file → `jsQR` canvas decode (copy pattern from `tools/coupons/app.js` `decodeQR`).
- On decode success: preview list of titles; buttons **Merge** / **Replace**.
- Merge → `importMerge(payload.i)`; Replace → `importReplace(payload.i)`; then render + toast.
- On page load: if `ShophelperListCodec.parseUrl(location.href)`, open import preview automatically (then `history.replaceState` to strip hash after apply/dismiss).

- [ ] **Step 4: Smoke**

Encode a short list, scan/paste into a second browser profile or same page import; verify merge duplicates and replace keeps idle staples.

- [ ] **Step 5: Commit**

```bash
git add tools/shopping-list
git commit -m "feat: add shopping list QR and link share/import"
```

---

### Task 5: Android long-press shortcuts

**Files:**
- Create: `android/app/src/main/res/xml/shortcuts.xml`
- Modify: `android/app/src/main/AndroidManifest.xml`
- Modify: `android/app/src/main/java/com/fishese/shophelper/MainActivity.java`
- Modify: `js/shell.js` (boot: honor `localStorage` launch path or query)
- Modify: `android/app/src/main/res/values/strings.xml` (shortcut labels)

**Interfaces:**
- Produces: Long-press shortcuts → open specific `tools/.../index.html` inside the WebView

- [ ] **Step 1: `shortcuts.xml`**

Create shortcuts for all 8 tools. Each:

```xml
<shortcut
    android:shortcutId="shopping_list"
    android:enabled="true"
    android:icon="@mipmap/ic_launcher"
    android:shortcutShortLabel="@string/shortcut_shopping_list"
    android:shortcutLongLabel="@string/shortcut_shopping_list">
    <intent
        android:action="android.intent.action.VIEW"
        android:targetPackage="com.fishese.shophelper"
        android:targetClass="com.fishese.shophelper.MainActivity">
        <extra android:name="js.path" android:value="/tools/shopping-list/index.html" />
    </intent>
    <categories android:name="android.shortcut.conversation" />
</shortcut>
```

(Use unique ids/paths per tool; omit conversation category if undesired — prefer no special category.)

- [ ] **Step 2: Manifest meta-data on launcher activity**

```xml
<meta-data
    android:name="android.app.shortcuts"
    android:resource="@xml/shortcuts" />
```

- [ ] **Step 3: MainActivity forwards path**

```java
package com.fishese.shophelper;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    registerLaunchPath(getIntent());
    super.onCreate(savedInstanceState);
  }

  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    registerLaunchPath(intent);
    // Bridge may already be up — inject navigation
    if (getBridge() != null && intent != null) {
      String path = intent.getStringExtra("js.path");
      if (path != null && path.startsWith("/")) {
        getBridge().getWebView().post(() ->
          getBridge().getWebView().evaluateJavascript(
            "window.location.href='" + path.replace("'", "\\'") + "';", null));
      }
    }
  }

  private void registerLaunchPath(Intent intent) {
    if (intent == null) return;
    String path = intent.getStringExtra("js.path");
    if (path == null || !path.startsWith("/")) return;
    // Preference read by shell.js on first paint
    // Stored via Capacitor Preferences if available; else rely on evaluateJavascript after bridge ready.
    this.launchPath = path;
  }

  String launchPath;
}
```

If evaluating before bridge ready is flaky, prefer: override `onStart` / listen bridge load, then `getBridge().getWebView().loadUrl(getBridge().getServerUrl() + path)` **or** set `localStorage` via JS:

```java
getBridge().getWebView().evaluateJavascript(
  "localStorage.setItem('shophelper_launch_path'," + JSONObject.quote(path) + ");", null);
```

Then in `js/shell.js` `boot()`:

```javascript
try {
  var launch = localStorage.getItem('shophelper_launch_path');
  if (launch && launch.indexOf('/tools/') === 0) {
    localStorage.removeItem('shophelper_launch_path');
    var root = rootPath(); // may be '.' on home
    // If not already on target, navigate
    if (location.pathname.indexOf(launch) === -1) {
      location.href = launch.replace(/^\//, root === '.' ? '' : '');
      // Safer absolute from site root:
      location.href = launch; // Capacitor https://localhost/tools/...
    }
  }
} catch (e) {}
```

Adjust path joining to match Capacitor’s `https://localhost/` base (verify with log during smoke).

- [ ] **Step 4: strings.xml labels** (short English labels OK for v1; optional zh later)

- [ ] **Step 5: Build + install -r + smoke shortcuts**

```bash
# from repo root
npm run cap:sync
# JAVA_HOME = Android Studio JBR
cd android && .\gradlew.bat assembleDebug
adb install -r app\build\outputs\apk\debug\app-debug.apk
```

Long-press Shophelper → tap Shopping List / Prices / etc. → lands on correct tool.

- [ ] **Step 6: Commit**

```bash
git add android/app/src/main js/shell.js
git commit -m "feat: add Android app shortcuts for all tools"
```

---

### Task 6: End-to-end verification

**Files:** none new (fixes only if smoke fails)

- [ ] **Step 1: Unit tests**

Run: `node test/shophelper.test.js`  
Expected: exit 0.

- [ ] **Step 2: Web smoke checklist**

- [ ] Home tile opens Shopping List  
- [ ] Staple + one-off + check strikethrough + reorder + finish trip  
- [ ] Share QR/link; import merge (dup OK); import replace keeps idle staples  
- [ ] Home export JSON contains `shoppingList`; import restores list key  

- [ ] **Step 3: Android smoke checklist**

- [ ] `adb install -r` updates app  
- [ ] Long-press shortcuts navigate correctly  
- [ ] Shopping list works offline in WebView  

- [ ] **Step 4: Commit any fixes** (if needed)

```bash
git commit -m "fix: shopping list smoke fixes"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
| --- | --- |
| One list + future multi-list shape | Task 1 |
| Item flags + lifecycle + finish trip | Task 1, 3 |
| Dedup soft / duplicates OK on merge | Task 1 |
| Own key + home mirror | Task 1–2 |
| UI sections + strikethrough + DnD/up-down | Task 3 |
| Share gzip/base64url `#d=` + reserved `s` | Task 1, 4 |
| Import paste + scan + merge/replace | Task 4 |
| Home tile, i18n, SW | Task 3 |
| Android shortcuts all tools | Task 5 |
| Cartulator/Coupons backup deferred | Out of plan (noted) |

## Placeholder scan

No TBD/TODO left in task steps; Android path wiring includes a verify-during-smoke note for Capacitor base URL — resolve in Task 5 Step 5 using device log, not left open.

## Type consistency

- Storage key: `shophelper_list_v1`  
- Payload keys: `v,n,i,t,q,r,c,o` (+ reserved `s`)  
- Globals: `ShophelperListStore`, `ShophelperListCodec`
