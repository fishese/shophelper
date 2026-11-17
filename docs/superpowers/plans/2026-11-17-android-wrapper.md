# Shophelper Android wrapper — implementation plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or implement directly when user said proceed).

**Goal:** Capacitor 7 Android app `com.fishese.shophelper` at `android/`, synced from the repo-root PWA.

## Task 1: Capacitor project files

- [x] Add root `package.json` with Capacitor 7 deps and scripts  
- [x] Add `capacitor.config.json` (`appId: com.fishese.shophelper`, `webDir: www`)  
- [x] Add `scripts/sync-www.mjs` (copy PWA into `www/`, skip `android`/`ref`/`test`/…)  
- [x] Extend `.gitignore` for `node_modules/`, `www/`, Android build artifacts  

## Task 2: Generate Android platform

- [x] `npm install`  
- [x] `npm run sync:www`  
- [x] `npx cap add android`  
- [x] Confirm `namespace` / `applicationId` are `com.fishese.shophelper`  

## Task 3: Smoke

- [x] `npm run cap:sync`  
- [x] `npm run android:apk` (JDK 21 via Android Studio JBR)  
- [x] Note build path / how to install in README  

## Task 4: Docs

- [x] README section for Android build  
