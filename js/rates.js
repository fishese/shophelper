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
      var parsed = parseFrankfurter(body);
      memory.cache = {
        base: parsed.base,
        date: parsed.date,
        rates: parsed.rates,
        source: 'frankfurter',
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

  function quote(memory, from, to) {
    from = String(from || '').toUpperCase();
    to = String(to || '').toUpperCase();
    if (!from || !to) return null;
    if (from === to) return { rate: '1', source: 'identity', asOf: '', manual: false };
    var manual = memory.manual && memory.manual[manualKey(from, to)];
    if (manual && decimal.parse(manual.rate) != null) {
      return { rate: decimal.format(decimal.parse(manual.rate)), source: 'manual', asOf: manual.asOf || '', manual: true };
    }
    var cache = memory.cache;
    if (!cache || !cache.rates) return null;
    if (cache.base === from && cache.rates[to]) {
      return { rate: cache.rates[to], source: cache.source || 'cached', asOf: cache.date || '', manual: false };
    }
    if (cache.base === to && cache.rates[from]) {
      var inverse = decimal.div('1', cache.rates[from]);
      if (inverse == null) return null;
      return { rate: inverse, source: cache.source || 'cached', asOf: cache.date || '', manual: false };
    }
    if (cache.rates[from] && cache.rates[to]) {
      var cross = decimal.div(cache.rates[to], cache.rates[from]);
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

  return { parseFrankfurter: parseFrankfurter, describeCache: describeCache, refresh: refresh, quote: quote, convert: convert, manualKey: manualKey };
});
