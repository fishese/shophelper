'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./decimal'), require('./units'));
  else root.ShophelperSizes = factory(root.ShophelperDecimal, root.ShophelperUnits);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (decimal, units) {
  // Conventional retail mapping (not ISO/ASTM). Tests lock these rows.
  var WOMEN = [
    { letter: 'XS', us: '0', uk: '4', euDe: '30', euFr: '32', it: '36', jp: '5', bustMin: 78, bustMax: 81 },
    { letter: 'XS', us: '2', uk: '6', euDe: '32', euFr: '34', it: '38', jp: '7', bustMin: 82, bustMax: 84 },
    { letter: 'S', us: '4', uk: '8', euDe: '34', euFr: '36', it: '40', jp: '9', bustMin: 85, bustMax: 87 },
    { letter: 'S', us: '6', uk: '10', euDe: '36', euFr: '38', it: '42', jp: '11', bustMin: 88, bustMax: 90 },
    { letter: 'M', us: '8', uk: '12', euDe: '38', euFr: '40', it: '44', jp: '13', bustMin: 91, bustMax: 94 },
    { letter: 'M', us: '10', uk: '14', euDe: '40', euFr: '42', it: '46', jp: '15', bustMin: 95, bustMax: 98 },
    { letter: 'L', us: '12', uk: '16', euDe: '42', euFr: '44', it: '48', jp: '17', bustMin: 99, bustMax: 102 },
    { letter: 'L', us: '14', uk: '18', euDe: '44', euFr: '46', it: '50', jp: '19', bustMin: 103, bustMax: 107 },
    { letter: 'XL', us: '16', uk: '20', euDe: '46', euFr: '48', it: '52', jp: '21', bustMin: 108, bustMax: 112 },
    { letter: 'XL', us: '18', uk: '22', euDe: '48', euFr: '50', it: '54', jp: '', bustMin: 113, bustMax: 117 },
    { letter: 'XXL', us: '20', uk: '24', euDe: '50', euFr: '52', it: '56', jp: '', bustMin: 118, bustMax: 122 }
  ];

  // Men's jackets. Chest ranges are cm. US/UK is the jacket number; EU/IT is one scale.
  var MEN = [
    { letter: 'XS', usMin: 34, usMax: 34, euMin: 44, euMax: 44, jp: ['S'], chestMin: 81, chestMax: 86 },
    { letter: 'S', usMin: 36, usMax: 36, euMin: 46, euMax: 46, jp: ['M'], chestMin: 86, chestMax: 91 },
    { letter: 'M', usMin: 38, usMax: 40, euMin: 48, euMax: 50, jp: ['L'], chestMin: 97, chestMax: 102 },
    { letter: 'L', usMin: 42, usMax: 44, euMin: 52, euMax: 54, jp: ['LL', 'XL'], chestMin: 107, chestMax: 112 },
    { letter: 'XL', usMin: 46, usMax: 48, euMin: 56, euMax: 58, jp: ['3L'], chestMin: 117, chestMax: 122 },
    { letter: 'XXL', usMin: 50, usMax: 52, euMin: 60, euMax: 62, jp: ['4L'], chestMin: 127, chestMax: 132 },
    { letter: '3XL', usMin: 54, usMax: 56, euMin: 64, euMax: 66, jp: ['5L'], chestMin: 137, chestMax: 142 }
  ];

  var WOMEN_COL = {
    letter: function (row) { return row.letter; },
    us: function (row) { return row.us; },
    uk: function (row) { return row.uk; },
    au: function (row) { return row.uk; },
    'eu-de': function (row) { return row.euDe; },
    'eu-fr': function (row) { return row.euFr; },
    it: function (row) { return row.it; },
    jp: function (row) { return row.jp; }
  };

  // Same underbust, different labels. AU is the dress-like number, not inches.
  var BANDS = [
    { us: '28', eu: '60', fr: '75', au: '6', low: '68', high: '72' },
    { us: '30', eu: '65', fr: '80', au: '8', low: '73', high: '77' },
    { us: '32', eu: '70', fr: '85', au: '10', low: '78', high: '82' },
    { us: '34', eu: '75', fr: '90', au: '12', low: '83', high: '87' },
    { us: '36', eu: '80', fr: '95', au: '14', low: '88', high: '92' },
    { us: '38', eu: '85', fr: '100', au: '16', low: '93', high: '97' },
    { us: '40', eu: '90', fr: '105', au: '18', low: '98', high: '102' },
    { us: '42', eu: '95', fr: '110', au: '20', low: '103', high: '107' },
    { us: '44', eu: '100', fr: '115', au: '22', low: '108', high: '112' },
    { us: '46', eu: '105', fr: '120', au: '24', low: '113', high: '117' },
    { us: '48', eu: '110', fr: '125', au: '26', low: '118', high: '122' }
  ];

  // Preferred letter is index 0. US accepts the alternate on input.
  var CUPS = [
    { step: 0, us: ['AA'], uk: ['AA'], eu: ['AA'], au: ['AA'] },
    { step: 1, us: ['A'], uk: ['A'], eu: ['A'], au: ['A'] },
    { step: 2, us: ['B'], uk: ['B'], eu: ['B'], au: ['B'] },
    { step: 3, us: ['C'], uk: ['C'], eu: ['C'], au: ['C'] },
    { step: 4, us: ['D'], uk: ['D'], eu: ['D'], au: ['D'] },
    { step: 5, us: ['DD', 'E'], uk: ['DD'], eu: ['E'], au: ['DD'] },
    { step: 6, us: ['DDD', 'F'], uk: ['E'], eu: ['F'], au: ['E'] },
    { step: 7, us: ['G'], uk: ['F'], eu: ['G'], au: ['F'] },
    { step: 8, us: ['H'], uk: ['FF'], eu: ['H'], au: ['FF'] },
    { step: 9, us: ['I'], uk: ['G'], eu: ['I'], au: ['G'] },
    { step: 10, us: ['J'], uk: ['GG'], eu: ['J'], au: ['GG'] },
    { step: 11, us: ['K'], uk: ['H'], eu: ['K'], au: ['H'] }
  ];

  // Adult recommended markings for a measured foot length, from ISO 19407:2023
  // Table 2 Mondopoint grading (simplified recommended marking). Guideline only;
  // lasts and brands vary. Not a reproduction of the standard text.
  // Regional labels that Table 2 lists only under another grading column are
  // refused here rather than guessed.
  var SHOES = [
    { footMm: 215, eu: '34', uk: '2.5', usMen: '3.5', usWomen: '4.5' },
    { footMm: 220, eu: '35', uk: '3', usMen: '4', usWomen: '5' },
    { footMm: 225, eu: '35.5', uk: '3.5', usMen: '4.5', usWomen: '5.5' },
    { footMm: 230, eu: '36.5', uk: '4', usMen: '5', usWomen: '6' },
    { footMm: 235, eu: '37', uk: '4.5', usMen: '5.5', usWomen: '6.5' },
    { footMm: 240, eu: '38', uk: '5.5', usMen: '6.5', usWomen: '7.5' },
    { footMm: 245, eu: '38.5', uk: '6', usMen: '7', usWomen: '8' },
    { footMm: 250, eu: '39.5', uk: '6.5', usMen: '7.5', usWomen: '8.5' },
    { footMm: 255, eu: '40', uk: '7', usMen: '8', usWomen: '9' },
    { footMm: 260, eu: '41', uk: '7.5', usMen: '8.5', usWomen: '9.5' },
    { footMm: 265, eu: '41.5', uk: '8.5', usMen: '9.5', usWomen: '10.5' },
    { footMm: 270, eu: '42.5', uk: '9', usMen: '10', usWomen: '11' },
    { footMm: 275, eu: '43', uk: '9.5', usMen: '10.5', usWomen: '11.5' },
    { footMm: 280, eu: '44', uk: '10', usMen: '11', usWomen: '12' },
    { footMm: 285, eu: '44.5', uk: '10.5', usMen: '11.5', usWomen: '12.5' },
    { footMm: 290, eu: '45.5', uk: '11', usMen: '12', usWomen: '13' },
    { footMm: 295, eu: '46', uk: '12', usMen: '13', usWomen: '14' },
    { footMm: 300, eu: '47', uk: '12.5', usMen: '13.5', usWomen: '14.5' },
    { footMm: 305, eu: '47.5', uk: '13', usMen: '14', usWomen: '15' },
    { footMm: 310, eu: '48.5', uk: '13.5', usMen: '14.5', usWomen: '15.5' },
    { footMm: 315, eu: '49', uk: '14', usMen: '15', usWomen: '16' },
    { footMm: 320, eu: '50', uk: '15', usMen: '16', usWomen: '17' }
  ];

  function num(value) {
    if (value == null) return null;
    var s = String(value).trim().replace(',', '.');
    if (!/^[+-]?\d+(\.\d+)?$/.test(s)) return null;
    if (decimal.parse(s) == null) return null;
    return decimal.format(decimal.parse(s));
  }

  function spanText(min, max) {
    return min === max ? String(min) : String(min) + '-' + String(max);
  }

  function normDash(value) {
    return String(value == null ? '' : value).trim().toUpperCase().replace(/[–—]/g, '-').replace(/\s+/g, '');
  }

  function womenEq(row) {
    return {
      letter: row.letter,
      us: row.us,
      uk: row.uk,
      au: row.uk,
      'eu-de': row.euDe,
      'eu-fr': row.euFr,
      it: row.it,
      jp: row.jp || ''
    };
  }

  function menEq(row) {
    var us = spanText(row.usMin, row.usMax);
    var eu = spanText(row.euMin, row.euMax);
    return {
      letter: row.letter,
      us: us,
      uk: us,
      au: us,
      eu: eu,
      it: eu,
      jp: row.jp.join(' / ')
    };
  }

  function pack(row, category) {
    if (category === 'men') {
      return {
        equivalents: menEq(row),
        range: { chestCm: { min: String(row.chestMin), max: String(row.chestMax) } }
      };
    }
    return {
      equivalents: womenEq(row),
      range: { bustCm: { min: String(row.bustMin), max: String(row.bustMax) } }
    };
  }

  function womenMatch(cell, token, isLetter) {
    if (cell == null || cell === '') return false;
    if (isLetter) return String(cell).trim().toUpperCase() === token.trim().toUpperCase();
    var a = num(cell);
    var b = num(token);
    return a != null && b != null && decimal.eq(a, b);
  }

  function betweenNumeric(rows, value, read) {
    var points = [];
    rows.forEach(function (row) {
      var cell = read(row);
      var n = num(cell);
      if (n == null) return;
      points.push({ n: n, row: row });
    });
    points.sort(function (a, b) { return decimal.cmp(a.n, b.n); });
    var lower = null;
    var upper = null;
    for (var i = 0; i < points.length; i++) {
      var cmp = decimal.cmp(points[i].n, value);
      if (cmp < 0) lower = points[i];
      if (cmp > 0) { upper = points[i]; break; }
    }
    if (!lower || !upper) return null;
    return [lower.row, upper.row];
  }

  function convertWomen(from, size) {
    var read = WOMEN_COL[from];
    if (!read) return { ok: false, reason: 'unknown-system' };
    var token = String(size == null ? '' : size).trim();
    if (!token) return { ok: false, reason: 'unknown' };
    var exact = WOMEN.filter(function (row) { return womenMatch(read(row), token, from === 'letter'); });
    if (exact.length === 1) {
      var one = pack(exact[0], 'women');
      one.ok = true;
      return one;
    }
    if (exact.length > 1) {
      return { ok: true, neighbours: exact.map(function (row) { return pack(row, 'women'); }) };
    }
    var value = num(token);
    if (value == null) return { ok: false, reason: 'unknown' };
    var pair = betweenNumeric(WOMEN, value, read);
    if (!pair) return { ok: false, reason: 'unknown' };
    return {
      ok: true,
      between: true,
      neighbours: pair.map(function (row) { return pack(row, 'women'); })
    };
  }

  function menSpan(row, from) {
    if (from === 'us' || from === 'uk' || from === 'au') return { min: String(row.usMin), max: String(row.usMax) };
    if (from === 'eu' || from === 'it') return { min: String(row.euMin), max: String(row.euMax) };
    return null;
  }

  function menMatch(row, from, token) {
    if (from === 'letter') return row.letter.toUpperCase() === token.trim().toUpperCase();
    if (from === 'jp') {
      var folded = normDash(token);
      var aliases = row.jp.map(function (part) { return normDash(part); });
      return aliases.indexOf(folded) >= 0 || folded === aliases.join('/');
    }
    var display = menEq(row)[from];
    if (display && normDash(token) === normDash(display)) return true;
    var value = num(token);
    var span = menSpan(row, from);
    if (value == null || !span) return false;
    return decimal.cmp(value, span.min) >= 0 && decimal.cmp(value, span.max) <= 0;
  }

  function convertMen(from, size) {
    if (['letter', 'us', 'uk', 'au', 'eu', 'it', 'jp'].indexOf(from) < 0) return { ok: false, reason: 'unknown-system' };
    var token = String(size == null ? '' : size).trim();
    if (!token) return { ok: false, reason: 'unknown' };
    var exact = MEN.filter(function (row) { return menMatch(row, from, token); });
    if (exact.length === 1) {
      var one = pack(exact[0], 'men');
      one.ok = true;
      return one;
    }
    if (exact.length > 1) {
      return { ok: true, neighbours: exact.map(function (row) { return pack(row, 'men'); }) };
    }
    var value = num(token);
    var spanOf = function (row) { return menSpan(row, from); };
    if (value == null || !spanOf(MEN[0])) return { ok: false, reason: 'unknown' };
    var lower = null;
    var upper = null;
    MEN.forEach(function (row) {
      var span = spanOf(row);
      if (!span) return;
      if (decimal.cmp(span.max, value) < 0 && (!lower || decimal.cmp(span.max, menSpan(lower, from).max) > 0)) lower = row;
      if (decimal.cmp(span.min, value) > 0 && (!upper || decimal.cmp(span.min, menSpan(upper, from).min) < 0)) upper = row;
    });
    if (!lower || !upper) return { ok: false, reason: 'unknown' };
    return {
      ok: true,
      between: true,
      neighbours: [pack(lower, 'men'), pack(upper, 'men')]
    };
  }

  function convertClothing(input) {
    input = input || {};
    var category = input.category;
    var from = String(input.from || '').trim().toLowerCase();
    if (category === 'women') return convertWomen(from, input.size);
    if (category === 'men') return convertMen(from, input.size);
    return { ok: false, reason: 'unknown-category' };
  }

  function locate(rows, value, spanOf) {
    var hits = [];
    rows.forEach(function (row) {
      var span = spanOf(row);
      if (decimal.cmp(value, String(span.min)) >= 0 && decimal.cmp(value, String(span.max)) <= 0) hits.push(row);
    });
    if (hits.length === 1) return { rows: hits };
    if (hits.length > 1) {
      var starters = hits.filter(function (row) { return decimal.eq(value, String(spanOf(row).min)); });
      return { rows: [starters.length ? starters[starters.length - 1] : hits[hits.length - 1]] };
    }
    var lower = null;
    var upper = null;
    rows.forEach(function (row) {
      var span = spanOf(row);
      if (decimal.cmp(String(span.max), value) < 0 && (!lower || decimal.cmp(String(span.max), String(spanOf(lower).max)) > 0)) lower = row;
      if (decimal.cmp(String(span.min), value) > 0 && (!upper || decimal.cmp(String(span.min), String(spanOf(upper).min)) < 0)) upper = row;
    });
    if (lower && upper) return { between: true, rows: [lower, upper] };
    return null;
  }

  function chinaLabel(measurements, girth) {
    var height = num(measurements && measurements.height);
    var g = num(girth);
    if (height == null || g == null) return '';
    return decimal.round(height, 0) + '/' + decimal.round(g, 0) + 'A';
  }

  function girthOf(measurements) {
    if (!measurements) return null;
    if (measurements.chest != null && String(measurements.chest).trim() !== '') return num(measurements.chest);
    if (measurements.bust != null && String(measurements.bust).trim() !== '') return num(measurements.bust);
    return null;
  }

  function suggestWomen(measurements) {
    var bust = girthOf(measurements);
    if (bust == null) return { ok: false, reason: 'missing-measurements' };
    var loc = locate(WOMEN, bust, function (row) { return { min: row.bustMin, max: row.bustMax }; });
    if (!loc) return { ok: false, reason: 'out-of-range' };
    var cn = chinaLabel(measurements, bust);
    if (loc.between) {
      return {
        ok: true,
        approximate: true,
        between: true,
        neighbours: loc.rows.map(function (row) { return pack(row, 'women'); }),
        cn: cn || undefined
      };
    }
    var packed = pack(loc.rows[0], 'women');
    packed.ok = true;
    packed.approximate = true;
    if (cn) packed.cn = cn;
    return packed;
  }

  function suggestMen(measurements) {
    var chest = girthOf(measurements);
    if (chest == null) return { ok: false, reason: 'missing-measurements' };
    var loc = locate(MEN, chest, function (row) { return { min: row.chestMin, max: row.chestMax }; });
    if (!loc) return { ok: false, reason: 'out-of-range' };
    var cn = chinaLabel(measurements, chest);
    if (loc.between) {
      return {
        ok: true,
        approximate: true,
        between: true,
        neighbours: loc.rows.map(function (row) { return pack(row, 'men'); }),
        cn: cn || undefined
      };
    }
    var packed = pack(loc.rows[0], 'men');
    packed.ok = true;
    packed.approximate = true;
    if (cn) packed.cn = cn;
    return packed;
  }

  function cupFamily(system) {
    if (system === 'us') return 'us';
    if (system === 'uk') return 'uk';
    if (system === 'au') return 'au';
    return 'eu';
  }

  function braCupStep(system, cup) {
    var fam = cupFamily(String(system || '').toLowerCase());
    var token = String(cup == null ? '' : cup).trim().toUpperCase();
    if (!token) return null;
    for (var i = 0; i < CUPS.length; i++) {
      if (CUPS[i][fam].indexOf(token) >= 0) return CUPS[i].step;
    }
    return null;
  }

  function braCupLetter(system, step) {
    var fam = cupFamily(String(system || '').toLowerCase());
    for (var i = 0; i < CUPS.length; i++) {
      if (CUPS[i].step === Number(step)) return CUPS[i][fam][0];
    }
    return null;
  }

  function braCupAlt(system, step) {
    var fam = cupFamily(String(system || '').toLowerCase());
    for (var i = 0; i < CUPS.length; i++) {
      if (CUPS[i].step === Number(step) && CUPS[i][fam].length > 1) return CUPS[i][fam][1];
    }
    return null;
  }

  function bandValue(row, system) {
    if (system === 'us' || system === 'uk') return row.us;
    if (system === 'au') return row.au;
    if (system === 'fr') return row.fr;
    return row.eu;
  }

  function findBand(system, band) {
    var value = num(band);
    if (value == null) return -1;
    for (var i = 0; i < BANDS.length; i++) {
      if (decimal.eq(bandValue(BANDS[i], system), value)) return i;
    }
    return -1;
  }

  function braPart(system, row, step) {
    var band = bandValue(row, system);
    var cup = braCupLetter(system, step);
    var alt = braCupAlt(system, step);
    var part = { band: band, cup: cup, label: band + cup + (alt ? ' (' + alt + ')' : '') };
    if (alt) part.alt = alt;
    return part;
  }

  function equivalentsAt(bandIndex, step) {
    var row = BANDS[bandIndex];
    var out = {};
    ['us', 'uk', 'eu', 'fr', 'au', 'jp'].forEach(function (system) {
      out[system] = braPart(system, row, step);
    });
    return out;
  }

  function sisterSide(bandIndex, step, delta) {
    var out = [];
    if (bandIndex - delta >= 0 && step + delta <= 11) {
      var down = { steps: delta, equivalents: equivalentsAt(bandIndex - delta, step + delta) };
      if (delta > 1) down.reliable = false;
      out.push(down);
    }
    if (bandIndex + delta < BANDS.length && step - delta >= 0) {
      var up = { steps: delta, equivalents: equivalentsAt(bandIndex + delta, step - delta) };
      if (delta > 1) up.reliable = false;
      out.push(up);
    }
    return out;
  }

  function convertBra(input) {
    input = input || {};
    var from = String(input.from || '').trim().toLowerCase();
    if (['us', 'uk', 'eu', 'fr', 'au', 'jp'].indexOf(from) < 0) return { ok: false, reason: 'unknown-system' };
    var bandIndex = findBand(from, input.band);
    var step = braCupStep(from, input.cup);
    if (bandIndex < 0 || step == null) return { ok: false, reason: 'unknown' };
    return {
      ok: true,
      equivalents: equivalentsAt(bandIndex, step),
      sisters: sisterSide(bandIndex, step, 1),
      sistersMore: sisterSide(bandIndex, step, 2)
    };
  }

  function bandDistance(value, row) {
    if (decimal.cmp(value, row.low) >= 0 && decimal.cmp(value, row.high) <= 0) return '0';
    if (decimal.cmp(value, row.low) < 0) return decimal.sub(row.low, value);
    return decimal.sub(value, row.high);
  }

  function suggestBra(measurements) {
    var under = num(measurements && measurements.underbust);
    if (under == null) return { ok: false, reason: 'missing-measurements' };
    var best = 0;
    var bestDist = null;
    for (var i = 0; i < BANDS.length; i++) {
      var dist = bandDistance(under, BANDS[i]);
      if (bestDist == null || decimal.cmp(dist, bestDist) < 0 || (decimal.eq(dist, bestDist) && i > best)) {
        best = i;
        bestDist = dist;
      }
    }
    var bust = girthOf(measurements);
    var step = null;
    if (bust != null) {
      var diff = decimal.sub(bust, under);
      var half = Number(decimal.div(decimal.sub(diff, '12'), '2'));
      var n = Math.floor(half) + 1;
      if (n >= 0 && n <= 11) step = n;
    }
    var equivalents = {};
    if (step == null) {
      ['us', 'uk', 'eu', 'fr', 'au', 'jp'].forEach(function (system) {
        var band = bandValue(BANDS[best], system);
        equivalents[system] = { band: band, cup: '', label: band };
      });
    } else {
      equivalents = equivalentsAt(best, step);
    }
    return { ok: true, approximate: true, equivalents: equivalents };
  }

  function oneDecimal(value) {
    var rounded = decimal.round(value, 1);
    if (rounded == null) return '';
    return rounded.indexOf('.') < 0 ? rounded + '.0' : rounded;
  }

  function shoeEquivalents(row) {
    var mm = String(row.footMm);
    var jp = oneDecimal(decimal.div(mm, '10'));
    return {
      mm: mm,
      cm: jp,
      mondo: mm,
      jp: jp,
      eu: row.eu,
      uk: row.uk,
      usMen: row.usMen,
      usWomen: row.usWomen
    };
  }

  function lengthToMm(from, size) {
    var n = num(size);
    if (n == null) return null;
    if (from === 'cm' || from === 'jp') return decimal.mul(n, '10');
    return n;
  }

  function nearestShoe(mm) {
    var best = null;
    var bestDist = null;
    SHOES.forEach(function (row) {
      var dist = Math.abs(Number(mm) - row.footMm);
      if (best == null || dist < bestDist - 1e-6 || (Math.abs(dist - bestDist) <= 1e-6 && row.footMm > best.footMm)) {
        best = row;
        bestDist = dist;
      }
    });
    if (best == null || bestDist > 2.5 + 1e-6) return null;
    return { row: best, nearest: bestDist > 0.001 };
  }

  function convertShoe(input) {
    input = input || {};
    var from = String(input.from || '').trim().toLowerCase();
    if (from === 'mm' || from === 'cm' || from === 'mondo' || from === 'jp') {
      var mm = lengthToMm(from, input.size);
      if (mm == null) return { ok: false, reason: 'unknown' };
      var snapped = nearestShoe(mm);
      if (!snapped) return { ok: false, reason: 'out-of-range' };
      return {
        ok: true,
        footMm: String(snapped.row.footMm),
        nearest: snapped.nearest,
        equivalents: shoeEquivalents(snapped.row)
      };
    }
    var col = { eu: 'eu', uk: 'uk', 'us-m': 'usMen', 'us-w': 'usWomen' }[from];
    if (!col) return { ok: false, reason: 'unknown-system' };
    var value = num(input.size);
    if (value == null) return { ok: false, reason: 'unknown' };
    for (var i = 0; i < SHOES.length; i++) {
      if (decimal.eq(SHOES[i][col], value)) {
        return {
          ok: true,
          footMm: String(SHOES[i].footMm),
          nearest: false,
          equivalents: shoeEquivalents(SHOES[i])
        };
      }
    }
    return { ok: false, reason: 'out-of-range' };
  }

  function suggestShoes(measurements) {
    var foot = num(measurements && measurements.footLength);
    if (foot == null) return { ok: false, reason: 'missing-measurements' };
    var out = convertShoe({ from: 'cm', size: foot });
    if (out.ok) out.approximate = true;
    return out;
  }

  function suggestFromMeasurements(input) {
    input = input || {};
    var measurements = input.measurements || {};
    if (input.category === 'women') return suggestWomen(measurements);
    if (input.category === 'men') return suggestMen(measurements);
    if (input.category === 'bra') return suggestBra(measurements);
    if (input.category === 'shoes') return suggestShoes(measurements);
    return { ok: false, reason: 'missing-measurements' };
  }

  function displayLength(cm, unit) {
    var n = num(cm);
    if (n == null) return '';
    if (unit === 'in') {
      var inches = units.convert(n, 'cm', 'in');
      if (inches == null) return '';
      return decimal.round(inches, 1) || '';
    }
    return decimal.round(n, 1) || '';
  }

  function parseLength(value, unit) {
    var n = num(value);
    if (n == null) return '';
    if (unit === 'in') {
      var cm = units.convert(n, 'in', 'cm');
      return cm == null ? '' : cm;
    }
    return n;
  }

  function clothingSystems(category) {
    if (category === 'men') {
      return [
        { id: 'letter', label: 'Letter' },
        { id: 'us', label: 'US' },
        { id: 'uk', label: 'UK' },
        { id: 'au', label: 'AU' },
        { id: 'eu', label: 'EU' },
        { id: 'it', label: 'IT' },
        { id: 'jp', label: 'JP' }
      ];
    }
    return [
      { id: 'letter', label: 'Letter' },
      { id: 'us', label: 'US' },
      { id: 'uk', label: 'UK' },
      { id: 'au', label: 'AU' },
      { id: 'eu-de', label: 'EU-DE' },
      { id: 'eu-fr', label: 'EU-FR' },
      { id: 'it', label: 'IT' },
      { id: 'jp', label: 'JP' }
    ];
  }

  function braSystems() {
    return [
      { id: 'us', label: 'US' },
      { id: 'uk', label: 'UK' },
      { id: 'eu', label: 'EU' },
      { id: 'fr', label: 'FR' },
      { id: 'au', label: 'AU' },
      { id: 'jp', label: 'JP' }
    ];
  }

  function shoeSystems() {
    return [
      { id: 'mm', label: 'mm' },
      { id: 'cm', label: 'cm' },
      { id: 'mondo', label: 'Mondopoint' },
      { id: 'jp', label: 'JP' },
      { id: 'eu', label: 'EU' },
      { id: 'uk', label: 'UK' },
      { id: 'us-m', label: 'US men' },
      { id: 'us-w', label: 'US women' }
    ];
  }

  return {
    clothingSystems: clothingSystems,
    braSystems: braSystems,
    shoeSystems: shoeSystems,
    convertClothing: convertClothing,
    convertBra: convertBra,
    convertShoe: convertShoe,
    suggestFromMeasurements: suggestFromMeasurements,
    displayLength: displayLength,
    parseLength: parseLength,
    braCupStep: braCupStep,
    braCupLetter: braCupLetter
  };
});
