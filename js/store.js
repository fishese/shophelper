'use strict';

(function (global, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(global);
  else global.ShophelperStore = factory(global);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (global) {
  var KEY = 'shophelper_v1';
  var storageOverride = null;

  function defaults() {
    return {
      v: 1,
      settings: {
        homeCurrency: 'HKD',
        theme: 'dark',
        lang: 'en',
        recentCurrencies: ['HKD', 'USD', 'JPY', 'EUR', 'CNY', 'TWD', 'GBP', 'KRW']
      },
      rates: { cache: null, manual: {} },
      drafts: {},
      results: { items: [] },
      products: [],
      observations: [],
      refunds: [],
      shoppingList: null,
      sizes: null
    };
  }

  function merge(raw) {
    var base = defaults();
    if (!raw || typeof raw !== 'object') return base;
    base.settings = Object.assign(base.settings, raw.settings || {});
    base.rates = {
      cache: raw.rates && raw.rates.cache ? raw.rates.cache : null,
      manual: raw.rates && raw.rates.manual ? raw.rates.manual : {}
    };
    base.drafts = raw.drafts && typeof raw.drafts === 'object' ? raw.drafts : {};
    base.results = raw.results && Array.isArray(raw.results.items) ? { items: raw.results.items } : { items: [] };
    base.products = Array.isArray(raw.products) ? raw.products : [];
    base.observations = Array.isArray(raw.observations) ? raw.observations : [];
    base.refunds = Array.isArray(raw.refunds) ? raw.refunds : [];
    base.shoppingList = raw.shoppingList && typeof raw.shoppingList === 'object' ? raw.shoppingList : null;
    base.sizes = raw.sizes && typeof raw.sizes === 'object' ? raw.sizes : null;
    return base;
  }

  function storage() {
    if (storageOverride) return storageOverride;
    try { return global.localStorage; } catch (err) { return null; }
  }

  function load() {
    var ls = storage();
    if (!ls) return defaults();
    try { return merge(JSON.parse(ls.getItem(KEY))); }
    catch (err) { return defaults(); }
  }

  function save(data) {
    var ls = storage();
    if (!ls) return;
    ls.setItem(KEY, JSON.stringify(data));
    try { global.dispatchEvent(new CustomEvent('shophelper-change')); } catch (err) {}
  }

  function update(fn) {
    var data = load();
    fn(data);
    save(data);
    return data;
  }

  function bundle(data) {
    return { app: 'shophelper', v: 1, exportedAt: new Date().toISOString(), data: data || load() };
  }

  function readBundle(parsed) {
    if (!parsed || typeof parsed !== 'object') return null;
    var data = parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed;
    if (!Array.isArray(data.products) && !Array.isArray(data.refunds) && !data.settings) return null;
    return merge(data);
  }

  function withStorage(ls) {
    storageOverride = ls;
    return api;
  }

  var api = { KEY: KEY, defaults: defaults, load: load, save: save, update: update, bundle: bundle, readBundle: readBundle, withStorage: withStorage };
  return api;
});
