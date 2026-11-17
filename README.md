# Shophelper

A small local shopping toolkit. Open `index.html` over HTTP (or any static host). The home screen is seven separate tools. Shared totals sit in a bar along the bottom and paste into the amount box you are typing in.

## Tools

1. **Cartulator** — trip tally and supermarket deals
2. **Coupons** — coupons, gift cards, and loyalty cards
3. **Deal Checker** — price per unit
4. **Units** — weight, volume, length, temperature, area
5. **Currency** — live/cached rates, head estimate, scribble pad
6. **Tax & Refund** — inclusive/exclusive tax, tourist-refund estimate, refund tracker
7. **Prices** — usual / best / last-seen cards, with Save from Cartulator and Deal Checker

## Run locally

```bash
python -m http.server 8787
```

Then open `http://127.0.0.1:8787/`.

## Android APK (Capacitor)

Package id: `com.fishese.shophelper`. The web app is the source of truth; sync it into `www/` then into `android/`.

```bash
npm install
npm run android:apk
```

Capacitor 7 needs **JDK 21**. If `java -version` is older, point Gradle at Android Studio’s JBR:

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
npm run android:apk
```

Also create `android/local.properties` (gitignored) with your SDK path, e.g. `sdk.dir=C:\\Users\\You\\AppData\\Local\\Android\\Sdk`.

Debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`

Day-to-day:

| Command | What it does |
| --- | --- |
| `npm run sync:www` | Copy the PWA into `www/` |
| `npm run cap:sync` | Sync `www/` into the Android project |
| `npm run cap:open` | Open in Android Studio |
| `npm run android:apk` | Full sync + debug APK |

## Tests

```bash
node test/shophelper.test.js
node tools/cartulator/calc.test.js
```

## Data

- New Shophelper data: `localStorage` key `shophelper_v1` (settings, rates, results, prices, refunds, drafts)
- Cartulator, Coupons, and Deal Checker keep their own existing storage keys
- Home → Settings has JSON backup/restore and a Prices CSV export

See `docs/m0-inventory.md` and `ref/SHOPHELPER_IMPLEMENTATION_PLAN.md`.
