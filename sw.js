'use strict';
var CACHE = 'shophelper-v14';
var ASSETS = [
  './',
  './index.html',
  './shell.css',
  './tools-bridge.css',
  './manifest.webmanifest',
  './icons/app.svg',
  './js/theme.js',
  './js/i18n.js',
  './js/shell.js',
  './js/store.js',
  './js/decimal.js',
  './js/units.js',
  './js/napkin.js',
  './js/mental.js',
  './js/tax.js',
  './js/prices.js',
  './js/results.js',
  './js/rates.js',
  './js/home.js',
  './js/list-store.js',
  './js/list-codec.js',
  './js/vendor/pako.min.js',
  './tools/shopping-list/index.html',
  './tools/shopping-list/page.js',
  './tools/units/index.html',
  './tools/units/page.js',
  './tools/currency/index.html',
  './tools/currency/page.js',
  './tools/tax/index.html',
  './tools/tax/page.js',
  './tools/prices/index.html',
  './tools/prices/page.js',
  './tools/cartulator/index.html',
  './tools/cartulator/calc.js',
  './tools/cartulator/bridge.js',
  './tools/coupons/index.html',
  './tools/coupons/app.js',
  './tools/coupons/styles.css',
  './tools/deals/index.html'
];

self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(CACHE).then(function (cache) {
    return Promise.all(ASSETS.map(function (url) { return cache.add(url).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (key) { return key.indexOf('shophelper-') === 0 && key !== CACHE; }).map(function (key) { return caches.delete(key); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  // Always take network for JS/CSS during polish so theme/lang edits show up.
  if (/\.(js|css)(\?|$)/.test(url.pathname)) {
    event.respondWith(fetch(event.request).then(function (response) {
      return response;
    }).catch(function () {
      return caches.match(event.request);
    }));
    return;
  }
  event.respondWith(fetch(event.request).then(function (response) {
    if (response && response.ok) {
      var copy = response.clone();
      caches.open(CACHE).then(function (cache) { cache.put(event.request, copy); }).catch(function () {});
    }
    return response;
  }).catch(function () {
    return caches.match(event.request).then(function (cached) {
      if (cached) return cached;
      if (event.request.mode === 'navigate') return caches.match('./index.html');
      return Response.error();
    });
  }));
});
