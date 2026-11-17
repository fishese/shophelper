# Shophelper Android wrapper — design

**Date:** 2026-11-17  
**Status:** Approved  
**App ID:** `com.fishese.shophelper` (same pattern as ClearWater `com.fishese.clearwater`)

## Goal

Ship Shophelper as an offline Android APK that loads the existing static PWA inside a Capacitor WebView. No rewrite of the web tools.

## Approach

Capacitor 7, Android project at `shophelper/android` (in-repo).

| Piece | Role |
| --- | --- |
| Repo root PWA | Source of truth (`index.html`, `js/`, `tools/`, …) |
| `scripts/sync-www.mjs` | Copies PWA files into `www/` |
| `www/` | Capacitor `webDir` (generated; not hand-edited) |
| `android/` | Capacitor Android project |
| Root `package.json` | `sync:www`, `cap:sync`, `cap:open`, `android:apk` |

## Runtime

- Bundled assets only; no localhost server required after install.
- `androidScheme: https` for WebView compatibility with modern web APIs / SW where supported.
- Coupons web OCR stays in-page for v1 (no native camera bridge).

## Out of scope (v1)

- Play Store listing / release keystore wiring in-repo  
- iOS  
- Payment Compare (M6)  
- Native push / biometric

## Success

`npm run android:apk` produces a debug APK that opens the seven-tool home screen offline.
