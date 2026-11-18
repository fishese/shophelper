'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ShophelperMental = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var FRIENDLY = [2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100];

  function closestFriendly(value) {
    return FRIENDLY.reduce(function (best, cur) {
      return Math.abs(cur - value) < Math.abs(best - value) ? cur : best;
    });
  }

  function rawError(estimate, actual) {
    return actual === 0 ? 0 : Math.abs(estimate - actual) / actual;
  }

  function describeMantissa(m) {
    if (Math.abs(m - 1) < 0.04) return { text: 'roughly equal', err: rawError(1, m) };
    if (m >= 0.5 && m < 2) {
      var diff = m - 1;
      var percent = Math.round(Math.abs(diff) * 100);
      percent = Math.round(percent / 5) * 5;
      if (percent === 0) return { text: 'roughly equal', err: rawError(1, m) };
      var sign = diff > 0 ? 1 : -1;
      var estimate = 1 + sign * (percent / 100);
      var percErr = rawError(estimate, m);
      var verb = sign > 0 ? 'Add' : 'Subtract';
      var nice = { 25: 1, 33: 1, 35: 1, 50: 1, 65: 1, 66: 1, 75: 1 };
      var fraction = percent === 25 ? ' (a quarter)'
        : percent === 50 ? ' (half)'
        : (percent === 33 || percent === 35) ? ' (a third)'
        : (percent === 65 || percent === 66) ? ' (two-thirds)'
        : percent === 75 ? ' (three-quarters)' : '';
      if (!nice[percent]) {
        var altValue = sign > 0 ? 2 : 0.5;
        var altErr = rawError(altValue, m);
        if (altErr <= percErr + 0.08) {
          var altDiff = altValue - m;
          var qualifier = Math.abs(altDiff) / m > 0.01 ? (altDiff > 0 ? ' and subtract a bit' : ' and add a bit') : '';
          return { text: (sign > 0 ? 'Multiply by 2' : 'Divide by 2') + qualifier, err: altErr };
        }
      }
      return { text: verb + ' ' + percent + '%' + fraction, err: percErr };
    }
    if (m >= 2) {
      var friendly = closestFriendly(m);
      var err = rawError(friendly, m);
      var delta = friendly - m;
      var q = Math.abs(delta) / m > 0.01 ? (delta < 0 ? ' and add a bit' : ' and subtract a bit') : '';
      if (friendly >= 10 && friendly % 10 === 0 && friendly <= 100) {
        var short = friendly === 10 ? 'Add a zero' : friendly === 100 ? 'Add two zeros' : 'Multiply by ' + (friendly / 10) + ', add a zero';
        return { text: short + q, err: err };
      }
      return { text: 'Multiply by ' + friendly + q, err: err };
    }
    var divisor = closestFriendly(1 / m);
    var est = 1 / divisor;
    var divErr = rawError(est, m);
    var divDelta = est - m;
    var divQ = Math.abs(divDelta) / m > 0.01 ? (divDelta < 0 ? ' plus a tiny bit' : ' minus a tiny bit') : '';
    if (divisor >= 10 && divisor % 10 === 0 && divisor <= 100) {
      var drop = divisor === 10 ? 'Drop a zero' : divisor === 100 ? 'Drop two zeros' : 'Drop a zero, divide by ' + (divisor / 10);
      return { text: drop + divQ, err: divErr };
    }
    return { text: 'Divide by ' + divisor + divQ, err: divErr };
  }

  function toZh(text) {
    var rules = [
      [/1:1 — no math needed/gi, '1:1，不用計算'],
      [/add two zeros/gi, '加兩個 0'],
      [/drop two zeros/gi, '去掉兩個 0'],
      [/drop a zero, divide by (\d+)/gi, '去掉一個 0，再除以 $1'],
      [/multiply by (\d+), add a zero/gi, '乘以 $1，再加一個 0'],
      [/and subtract a bit/gi, '，再減一點'],
      [/and add a bit/gi, '，再加一點'],
      [/plus a tiny bit/gi, '，再加少許'],
      [/minus a tiny bit/gi, '，再減少許'],
      [/add a zero/gi, '加一個 0'],
      [/drop a zero/gi, '去掉一個 0'],
      [/multiply by (\d+)/gi, '乘以 $1'],
      [/divide by (\d+)/gi, '除以 $1'],
      [/roughly equal/gi, '大致相同'],
      [/add (\d+)% \(a quarter\)/gi, '加 $1%（四分之一）'],
      [/add (\d+)% \(half\)/gi, '加 $1%（一半）'],
      [/add (\d+)% \(a third\)/gi, '加 $1%（三分之一）'],
      [/add (\d+)% \(two-thirds\)/gi, '加 $1%（三分之二）'],
      [/add (\d+)% \(three-quarters\)/gi, '加 $1%（四分之三）'],
      [/subtract (\d+)% \(a quarter\)/gi, '減 $1%（四分之一）'],
      [/subtract (\d+)% \(half\)/gi, '減 $1%（一半）'],
      [/subtract (\d+)% \(a third\)/gi, '減 $1%（三分之一）'],
      [/subtract (\d+)% \(two-thirds\)/gi, '減 $1%（三分之二）'],
      [/subtract (\d+)% \(three-quarters\)/gi, '減 $1%（四分之三）'],
      [/add (\d+)%/gi, '加 $1%'],
      [/subtract (\d+)%/gi, '減 $1%'],
      [/drop (\d+) zeros?/gi, '去掉 $1 個 0'],
      [/add (\d+) zeros?/gi, '加 $1 個 0'],
      [/, then it's roughly equal/gi, '，之後大致相同'],
      [/, then /gi, '，然後']
    ];
    var out = text;
    rules.forEach(function (rule) { out = out.replace(rule[0], rule[1]); });
    return out;
  }

  function describe(rate, lang) {
    function finish(out) {
      if (lang === 'zh' && out.text) return { text: toZh(out.text), errorPercent: out.errorPercent };
      return out;
    }
    var n = typeof rate === 'number' ? rate : Number(rate);
    if (!isFinite(n) || n <= 0) return { text: '', errorPercent: 0 };
    if (Math.abs(n - 1) < 0.005) return finish({ text: '1:1 — no math needed', errorPercent: 0 });
    if (n >= 0.01 && n <= 100) {
      var mid = describeMantissa(n);
      return finish({ text: mid.text.charAt(0).toUpperCase() + mid.text.slice(1), errorPercent: Math.round(mid.err * 100) });
    }
    var dropping = n < 0.01;
    var zBase = Math.floor(Math.abs(Math.log10(n)));
    var candidates = dropping ? [zBase, zBase + 1] : [zBase, zBase - 1].filter(function (z) { return z >= 0; });
    var best = null;
    candidates.forEach(function (z) {
      var mantissa = dropping ? n * Math.pow(10, z) : n / Math.pow(10, z);
      var desc = describeMantissa(mantissa);
      if (!best || desc.err < best.desc.err - 0.005) best = { z: z, desc: desc };
    });
    var zeroPhrase = (dropping ? 'Drop ' : 'Add ') + best.z + ' zero' + (best.z === 1 ? '' : 's');
    var text = best.desc.text === 'roughly equal'
      ? zeroPhrase + ", then it's roughly equal"
      : zeroPhrase + ', then ' + best.desc.text.charAt(0).toLowerCase() + best.desc.text.slice(1);
    return finish({ text: text, errorPercent: Math.round(best.desc.err * 100) });
  }

  return { describe: describe };
});
