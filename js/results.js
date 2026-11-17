'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./decimal'), require('./units'), require('./tax'));
  else root.ShophelperResults = factory(root.ShophelperDecimal, root.ShophelperUnits, root.ShophelperTax);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (decimal, units, tax) {
  function blank() {
    return { items: [] };
  }

  function publish(store, result) {
    store.items = (store.items || []).filter(function (item) { return item.slot !== result.slot; });
    store.items.push({
      slot: result.slot,
      sourceTool: result.sourceTool,
      kind: result.kind,
      value: String(result.value),
      currency: result.currency ? String(result.currency).toUpperCase() : '',
      unit: result.unit || '',
      label: result.label || result.sourceTool || 'Result',
      calculatedAt: result.calculatedAt || Date.now(),
      freshness: result.freshness || 'fresh',
      rateAsOf: result.rateAsOf || '',
      rateSource: result.rateSource || ''
    });
    return store;
  }

  function list(store) {
    return (store.items || []).slice();
  }

  function recent(store, count) {
    return list(store).sort(function (a, b) { return b.calculatedAt - a.calculatedAt; }).slice(0, count);
  }

  function removeSlot(store, slot) {
    store.items = (store.items || []).filter(function (item) { return item.slot !== slot; });
    return store;
  }

  function insertionPlan(result, field, context) {
    context = context || {};
    if (!result || !field) return { action: 'refuse', reason: 'missing' };
    if (result.kind === 'money' && field.kind === 'money') {
      var from = String(result.currency || '').toUpperCase();
      var to = String(field.currency || '').toUpperCase();
      if (from && to && from === to) {
        return { action: 'insert', value: decimal.round(result.value, tax.places(to)), currency: to };
      }
      var choices = ['switch', 'cancel'];
      var converted = null;
      if (context.rate && decimal.parse(context.rate) != null) {
        choices = ['convert', 'switch', 'cancel'];
        converted = {
          value: decimal.round(decimal.mul(result.value, context.rate), tax.places(to)),
          currency: to,
          rate: String(context.rate),
          rateAsOf: context.rateAsOf || '',
          rateSource: context.rateSource || ''
        };
      }
      return { action: 'choose', reason: 'currency', choices: choices, converted: converted, from: from, to: to, value: String(result.value) };
    }
    if ((result.kind === 'quantity' || result.kind === 'temperature') && (field.kind === 'quantity' || field.kind === 'temperature')) {
      var value = units.convert(result.value, result.unit, field.unit);
      if (value == null) return { action: 'refuse', reason: 'unit' };
      return { action: 'insert', value: value, unit: units.canon(field.unit) };
    }
    return { action: 'refuse', reason: 'kind' };
  }

  return { blank: blank, publish: publish, list: list, recent: recent, removeSlot: removeSlot, insertionPlan: insertionPlan };
});
