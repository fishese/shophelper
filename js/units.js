'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./decimal'));
  else root.ShophelperUnits = factory(root.ShophelperDecimal);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (decimal) {
  // Factors match Deal Checker's pack-size table exactly.
  var PACK = {
    g: { type: 'weight', factor: '1', display: 'g' },
    kg: { type: 'weight', factor: '1000', display: 'g' },
    lb: { type: 'weight', factor: '453.592', display: 'g' },
    oz: { type: 'weight', factor: '28.3495', display: 'g' },
    ml: { type: 'volume', factor: '1', display: 'ml' },
    L: { type: 'volume', factor: '1000', display: 'ml' },
    'fl oz': { type: 'volume', factor: '29.5735', display: 'ml' },
    gal: { type: 'volume', factor: '3785.41', display: 'ml' },
    cm: { type: 'length', factor: '1', display: 'cm' },
    m: { type: 'length', factor: '100', display: 'cm' },
    mm: { type: 'length', factor: '0.1', display: 'cm' },
    in: { type: 'length', factor: '2.54', display: 'cm' },
    ft: { type: 'length', factor: '30.48', display: 'cm' },
    yd: { type: 'length', factor: '91.44', display: 'cm' },
    pcs: { type: 'count', factor: '1', display: 'pcs' }
  };

  var EXTRA = {
    cm2: { type: 'area', factor: '1' },
    m2: { type: 'area', factor: '10000' },
    mm2: { type: 'area', factor: '0.01' },
    in2: { type: 'area', factor: '6.4516' },
    ft2: { type: 'area', factor: '929.0304' }
  };

  var ALIAS = {
    ml: 'ml', mL: 'ml', ML: 'ml', l: 'L', L: 'L',
    'fl oz': 'fl oz', floz: 'fl oz', 'fl. oz': 'fl oz',
    'cm²': 'cm2', 'm²': 'm2', 'mm²': 'mm2', 'in²': 'in2', 'ft²': 'ft2'
  };

  function canon(unit) {
    var raw = String(unit == null ? '' : unit).trim();
    if (!raw) return '';
    if (ALIAS[raw]) return ALIAS[raw];
    if (PACK[raw] || EXTRA[raw] || raw === 'C' || raw === 'F' || raw === 'K') return raw;
    return raw;
  }

  function info(unit) {
    var u = canon(unit);
    if (PACK[u]) return { unit: u, type: PACK[u].type, factor: PACK[u].factor, linear: true };
    if (EXTRA[u]) return { unit: u, type: EXTRA[u].type, factor: EXTRA[u].factor, linear: true };
    if (u === 'C' || u === 'F' || u === 'K') return { unit: u, type: 'temperature', linear: false };
    return null;
  }

  function packTable() {
    var out = {};
    Object.keys(PACK).forEach(function (k) {
      out[k] = { type: PACK[k].type, factor: PACK[k].factor, display: PACK[k].display };
    });
    return out;
  }

  function toC(value, unit) {
    if (unit === 'C') return value;
    if (unit === 'K') return decimal.sub(value, '273.15');
    if (unit === 'F') return decimal.div(decimal.mul(decimal.sub(value, '32'), '5'), '9');
    return null;
  }

  function fromC(value, unit) {
    if (unit === 'C') return value;
    if (unit === 'K') return decimal.add(value, '273.15');
    if (unit === 'F') return decimal.add(decimal.div(decimal.mul(value, '9'), '5'), '32');
    return null;
  }

  function convert(value, fromUnit, toUnit) {
    var from = info(fromUnit);
    var to = info(toUnit);
    if (!from || !to || from.type !== to.type) return null;
    if (decimal.parse(value) == null) return null;
    if (from.unit === to.unit) return decimal.format(decimal.parse(value));
    if (from.type === 'temperature') {
      var c = toC(String(value), from.unit);
      if (c == null) return null;
      return fromC(c, to.unit);
    }
    var base = decimal.mul(String(value), from.factor);
    if (base == null) return null;
    return decimal.div(base, to.factor);
  }

  function unspecified(qty, unit) {
    return String(qty == null ? '' : qty).trim() === '' || String(unit == null ? '' : unit).trim() === '';
  }

  function samePack(qtyA, unitA, qtyB, unitB) {
    var aEmpty = unspecified(qtyA, unitA);
    var bEmpty = unspecified(qtyB, unitB);
    if (aEmpty || bEmpty) return aEmpty && bEmpty;
    var ia = info(unitA);
    var ib = info(unitB);
    if (!ia || !ib || ia.type !== ib.type) return false;
    var av = convert(String(qtyA), unitA, baseUnit(unitA));
    var bv = convert(String(qtyB), unitB, baseUnit(unitB));
    if (av == null || bv == null) return false;
    return decimal.eq(av, bv);
  }

  function baseUnit(unit) {
    var meta = info(unit);
    if (!meta) return unit;
    if (meta.type === 'weight') return 'g';
    if (meta.type === 'volume') return 'ml';
    if (meta.type === 'length') return 'cm';
    if (meta.type === 'area') return 'cm2';
    if (meta.type === 'count') return 'pcs';
    return meta.unit;
  }

  function categories() {
    return [
      { id: 'weight', label: 'Weight', units: ['g', 'kg', 'oz', 'lb'] },
      { id: 'volume', label: 'Volume', units: ['ml', 'L', 'fl oz', 'gal'] },
      { id: 'length', label: 'Length', units: ['mm', 'cm', 'm', 'in', 'ft', 'yd'] },
      { id: 'temperature', label: 'Temperature', units: ['C', 'F', 'K'] },
      { id: 'area', label: 'Area', units: ['mm2', 'cm2', 'm2', 'in2', 'ft2'] }
    ];
  }

  return {
    packTable: packTable,
    info: info,
    canon: canon,
    convert: convert,
    samePack: samePack,
    categories: categories,
    baseUnit: baseUnit
  };
});
