'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ShophelperDecimal = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var SCALE = 12;
  var SCALE_N = 10n ** BigInt(SCALE);

  function parse(input) {
    if (input == null) return null;
    var s = String(input).trim();
    if (!s) return null;
    var neg = false;
    if (s.charAt(0) === '+') s = s.slice(1);
    if (s.charAt(0) === '-') { neg = true; s = s.slice(1); }
    if (!/^\d+(\.\d+)?$/.test(s)) return null;
    var parts = s.split('.');
    var whole = parts[0];
    var frac = parts[1] || '';
    var digits = (frac + '000000000000').slice(0, SCALE);
    var n = BigInt(whole) * SCALE_N + BigInt(digits);
    if (frac.length > SCALE && frac.charAt(SCALE) >= '5') n += 1n;
    return neg ? -n : n;
  }

  function fmt(n) {
    if (n == null) return null;
    var neg = n < 0n;
    var v = neg ? -n : n;
    var whole = v / SCALE_N;
    var frac = (v % SCALE_N).toString().padStart(SCALE, '0').replace(/0+$/, '');
    var body = frac ? whole.toString() + '.' + frac : whole.toString();
    if (body === '0') return '0';
    return neg ? '-' + body : body;
  }

  function roundHalfAway(numer, denom) {
    var neg = (numer < 0n) !== (denom < 0n);
    var an = numer < 0n ? -numer : numer;
    var ad = denom < 0n ? -denom : denom;
    if (ad === 0n) return null;
    var q = an / ad;
    var r = an % ad;
    if (r * 2n >= ad) q += 1n;
    return neg ? -q : q;
  }

  function op2(a, b, fn) {
    var x = parse(a);
    var y = parse(b);
    if (x == null || y == null) return null;
    return fn(x, y);
  }

  function add(a, b) {
    return op2(a, b, function (x, y) { return fmt(x + y); });
  }

  function sub(a, b) {
    return op2(a, b, function (x, y) { return fmt(x - y); });
  }

  function mul(a, b) {
    return op2(a, b, function (x, y) {
      var rounded = roundHalfAway(x * y, SCALE_N);
      return rounded == null ? null : fmt(rounded);
    });
  }

  function div(a, b) {
    return op2(a, b, function (x, y) {
      if (y === 0n) return null;
      var rounded = roundHalfAway(x * SCALE_N, y);
      return rounded == null ? null : fmt(rounded);
    });
  }

  function cmp(a, b) {
    var x = parse(a);
    var y = parse(b);
    if (x == null || y == null) return null;
    if (x === y) return 0;
    return x > y ? 1 : -1;
  }

  function eq(a, b) {
    return cmp(a, b) === 0;
  }

  function round(input, places) {
    var n = parse(input);
    if (n == null) return null;
    var p = Number(places);
    if (!isFinite(p) || p < 0) return null;
    if (p >= SCALE) return fmt(n);
    var factor = 10n ** BigInt(SCALE - p);
    var rounded = roundHalfAway(n, factor);
    if (rounded == null) return null;
    return fmt(rounded * factor);
  }

  function abs(a) {
    var n = parse(a);
    if (n == null) return null;
    return fmt(n < 0n ? -n : n);
  }

  return { parse: parse, format: fmt, add: add, sub: sub, mul: mul, div: div, cmp: cmp, eq: eq, round: round, abs: abs };
});
