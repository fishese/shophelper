'use strict';
var CACHE = 'shophelper-v19';
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
  './js/sizes.js',
  './js/sizes-store.js',
  './js/vendor/pako.min.js',
  './js/vendor/vue.global.prod.js',
  './js/vendor/tailwind.cdn.js',
  './js/vendor/jsQR.js',
  './js/vendor/qrcode.js',
  './js/vendor/JsBarcode.all.min.js',
  './js/vendor/html5-qrcode.min.js',
  './js/vendor/bwip-js-min.js',
  './js/vendor/tesseract.min.js',
  './js/vendor/tesseract.worker.min.js',
  './js/vendor/tesseract-core-simd-lstm.wasm.js',
  './tools/shopping-list/index.html',
  './tools/shopping-list/page.js',
  './tools/units/index.html',
  './tools/units/page.js',
  './tools/sizes/index.html',
  './tools/sizes/page.js',
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

function cacheKey(request) {
  var url = new URL(request.url);
  url.search = '';
  url.hash = '';
  return url.toString();
}

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  // Cache first so tool switches don't wait on the network. A background
  // fetch still refreshes the cache for the next open.
  event.respondWith(caches.open(CACHE).then(function (cache) {
    var key = cacheKey(event.request);
    return cache.match(key).then(function (cached) {
      var refresh = fetch(event.request).then(function (response) {
        if (response && response.ok) cache.put(key, response.clone());
        return response;
      }).catch(function () { return null; });
      if (cached) return cached;
      return refresh.then(function (response) {
        if (response) return response;
        if (event.request.mode === 'navigate') return cache.match('./index.html');
        return Response.error();
      });
    });
  }));
});
