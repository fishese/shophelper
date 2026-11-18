'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./decimal'));
  else root.ShophelperRates = factory(root.ShophelperDecimal);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (decimal) {
  function parseFrankfurter(body) {
    var rates = {};
    Object.keys(body.rates || {}).forEach(function (code) {
      rates[String(code).toUpperCase()] = decimal.format(decimal.parse(String(body.rates[code])));
    });
    return {
      base: String(body.base || '').toUpperCase(),
      date: body.date,
      rates: rates,
      source: 'frankfurter'
    };
  }

  function parseCurrencyApi(body) {
    var baseKey = null;
    var table = null;
    Object.keys(body || {}).forEach(function (key) {
      if (key === 'date' || !body[key] || typeof body[key] !== 'object') return;
      baseKey = key;
      table = body[key];
    });
    if (!baseKey || !table) throw new Error('Rate feed did not include a currency table');
    var rates = {};
    Object.keys(table).forEach(function (code) {
      var parsed = decimal.parse(String(table[code]));
      if (parsed == null) return;
      rates[String(code).toUpperCase()] = decimal.format(parsed);
    });
    return {
      base: String(baseKey).toUpperCase(),
      date: body.date,
      rates: rates,
      source: 'currency-api'
    };
  }

  function parseRateBody(body) {
    if (body && body.base && body.rates) return parseFrankfurter(body);
    return parseCurrencyApi(body);
  }

  function describeCache(cache, nowMs, manualActive) {
    var asOf = Date.parse(String(cache.date) + 'T00:00:00Z');
    var stale = !isFinite(asOf) || (nowMs - asOf) > 24 * 60 * 60 * 1000;
    return {
      live: false,
      stale: stale,
      manual: !!manualActive,
      source: manualActive ? 'manual' : 'cached',
      date: cache.date || ''
    };
  }

  async function refresh(memory, fetcher, now) {
    try {
      var body = await fetcher();
      var parsed = parseRateBody(body);
      memory.cache = {
        base: parsed.base,
        date: parsed.date,
        rates: parsed.rates,
        source: parsed.source,
        fetchedAt: now
      };
      return { ok: true, cache: memory.cache };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err), cache: memory.cache };
    }
  }

  function manualKey(from, to) {
    return String(from || '').toUpperCase() + ':' + String(to || '').toUpperCase();
  }

  // Daily currency-api snapshot for 2026-11-17, per 1 EUR.
  // Covers Southeast Asia, the UK, Egypt, and the other currencies in the picker.
  var BUNDLED = {
    base: 'EUR',
    date: '2026-11-17',
    source: 'bundled',
    rates: {
      AUD: '1.63414757', BND: '1.41826739', CAD: '1.5742982', CHF: '0.92395129',
      CNY: '7.33775336', EGP: '59.09264793', GBP: '0.83408764', HKD: '8.6369721',
      IDR: '20095.59031275', INR: '102.98657261', JPY: '175.24136101', KHR: '4519.45216848',
      KRW: '1471.75757687', LAK: '24782.13792549', MMK: '2311.40453645', MOP: '8.89608126',
      MYR: '4.5027748', NZD: '2.00120789', PHP: '70.16711071', SGD: '1.41826739',
      THB: '37.25020815', TWD: '36.27408767', USD: '1.10079322', VND: '28346.31077034'
    }
  };

  function fillFromBundled(cache) {
    if (!cache || cache.base !== BUNDLED.base || !cache.rates) return cache;
    var rates = {};
    Object.keys(BUNDLED.rates).forEach(function (code) { rates[code] = BUNDLED.rates[code]; });
    Object.keys(cache.rates).forEach(function (code) { rates[code] = cache.rates[code]; });
    return { base: cache.base, date: cache.date, source: cache.source, rates: rates };
  }

  function unitsPerBase(cache, code) {
    if (!cache) return null;
    if (cache.base === code) return '1';
    if (cache.rates && cache.rates[code]) return cache.rates[code];
    if (!BUNDLED.rates[code]) return null;
    if (cache.base === 'EUR') return BUNDLED.rates[code];
    if (cache.rates && cache.rates.EUR) return decimal.mul(cache.rates.EUR, BUNDLED.rates[code]);
    return null;
  }

  function quote(memory, from, to) {
    from = String(from || '').toUpperCase();
    to = String(to || '').toUpperCase();
    if (!from || !to) return null;
    if (from === to) return { rate: '1', source: 'identity', asOf: '', manual: false };
    var manual = memory.manual && memory.manual[manualKey(from, to)];
    if (manual && decimal.parse(manual.rate) != null) {
      return { rate: decimal.format(decimal.parse(manual.rate)), source: 'manual', asOf: manual.asOf || '', manual: true };
    }
    var cache = memory && memory.cache && memory.cache.rates ? fillFromBundled(memory.cache) : BUNDLED;
    var fromRate = unitsPerBase(cache, from);
    var toRate = unitsPerBase(cache, to);
    if (cache.base === from && toRate) {
      return { rate: toRate, source: cache.source || 'cached', asOf: cache.date || '', manual: false };
    }
    if (cache.base === to && fromRate) {
      var inverse = decimal.div('1', fromRate);
      if (inverse == null) return null;
      return { rate: inverse, source: cache.source || 'cached', asOf: cache.date || '', manual: false };
    }
    if (fromRate && toRate) {
      var cross = decimal.div(toRate, fromRate);
      if (cross == null) return null;
      return { rate: cross, source: cache.source || 'cached', asOf: cache.date || '', manual: false };
    }
    return null;
  }

  function convert(memory, amount, from, to) {
    var q = quote(memory, from, to);
    if (!q) return null;
    var value = decimal.mul(String(amount), q.rate);
    if (value == null) return null;
    return { value: value, rate: q.rate, source: q.source, asOf: q.asOf, manual: q.manual, from: String(from).toUpperCase(), to: String(to).toUpperCase() };
  }

  return { parseFrankfurter: parseFrankfurter, parseCurrencyApi: parseCurrencyApi, describeCache: describeCache, refresh: refresh, quote: quote, convert: convert, manualKey: manualKey };
});
