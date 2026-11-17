'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./decimal'));
  else root.ShophelperTax = factory(root.ShophelperDecimal);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (decimal) {
  var ZERO_DECIMALS = { JPY: 1, KRW: 1, VND: 1, HUF: 1, CLP: 1 };
  var THREE_DECIMALS = { BHD: 1, KWD: 1, OMR: 1 };

  function places(currency) {
    var code = String(currency || 'HKD').toUpperCase();
    if (ZERO_DECIMALS[code]) return 0;
    if (THREE_DECIMALS[code]) return 3;
    return 2;
  }

  function calculate(input) {
    var price = String(input.price == null ? '' : input.price).trim();
    var rate = String(input.ratePercent == null ? '' : input.ratePercent).trim();
    var mode = input.mode === 'exclusive' ? 'exclusive' : 'inclusive';
    if (decimal.parse(price) == null || decimal.parse(rate) == null) return null;
    if (decimal.cmp(rate, '0') < 0) return null;
    var p = places(input.currency);
    if (mode === 'inclusive') {
      var denom = decimal.add('100', rate);
      if (decimal.cmp(denom, '0') === 0) return null;
      var tax = decimal.round(decimal.div(decimal.mul(price, rate), denom), p);
      var checkout = decimal.round(price, p);
      return { mode: mode, tax: tax, checkout: checkout, net: decimal.sub(checkout, tax), currency: String(input.currency || 'HKD').toUpperCase() };
    }
    var exclusiveTax = decimal.round(decimal.div(decimal.mul(price, rate), '100'), p);
    var net = decimal.round(price, p);
    return { mode: mode, tax: exclusiveTax, checkout: decimal.add(net, exclusiveTax), net: net, currency: String(input.currency || 'HKD').toUpperCase() };
  }

  function refund(input) {
    var tax = String(input.tax == null ? '' : input.tax).trim();
    var feePercent = String(input.feePercent == null ? '' : input.feePercent).trim();
    var fixedFee = String(input.fixedFee == null || input.fixedFee === '' ? '0' : input.fixedFee).trim();
    if (decimal.parse(tax) == null || decimal.parse(feePercent) == null || decimal.parse(fixedFee) == null) return null;
    var p = places(input.currency);
    var percentFee = decimal.round(decimal.div(decimal.mul(tax, feePercent), '100'), p);
    var fixed = decimal.round(fixedFee, p);
    var fee = decimal.add(percentFee, fixed);
    return { gross: decimal.round(tax, p), fee: fee, net: decimal.sub(decimal.round(tax, p), fee), currency: String(input.currency || 'HKD').toUpperCase() };
  }

  function summarizeRefunds(rows) {
    var pending = {};
    var received = {};
    (rows || []).forEach(function (row) {
      var code = String(row.currency || '').toUpperCase();
      if (!code || row.status === 'cancelled') return;
      if (row.status === 'received') {
        if (decimal.parse(row.actualAmount) == null) return;
        received[code] = received[code] ? decimal.add(received[code], row.actualAmount) : decimal.format(decimal.parse(row.actualAmount));
        return;
      }
      if (row.status === 'expected' || row.status === 'submitted') {
        if (decimal.parse(row.estimatedNet) == null) return;
        pending[code] = pending[code] ? decimal.add(pending[code], row.estimatedNet) : decimal.format(decimal.parse(row.estimatedNet));
      }
    });
    return { pending: pending, received: received };
  }

  return { places: places, calculate: calculate, refund: refund, summarizeRefunds: summarizeRefunds };
});
