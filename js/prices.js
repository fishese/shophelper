'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./decimal'), require('./units'));
  else root.ShophelperPrices = factory(root.ShophelperDecimal, root.ShophelperUnits);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (decimal, units) {
  function blank() {
    return { products: [], observations: [] };
  }

  function clone(state) {
    return JSON.parse(JSON.stringify(state));
  }

  function productById(state, id) {
    return state.products.filter(function (p) { return p.id === id; })[0] || null;
  }

  function obsById(state, id) {
    return state.observations.filter(function (o) { return o.id === id; })[0] || null;
  }

  function usualOf(state, product) {
    return obsById(state, product.usualObservationId);
  }

  function comparable(obs, basis) {
    if (!obs || !basis) return false;
    if (String(obs.currency).toUpperCase() !== String(basis.currency).toUpperCase()) return false;
    return units.samePack(obs.packQty, obs.packUnit, basis.packQty, basis.packUnit);
  }

  function bestOf(state, product) {
    var usual = usualOf(state, product);
    if (!usual) return null;
    var best = null;
    state.observations.forEach(function (obs) {
      if (obs.productId !== product.id || !comparable(obs, usual)) return;
      if (!best || decimal.cmp(obs.price, best.price) < 0) best = obs;
    });
    return best;
  }

  function card(state, productId) {
    var product = productById(state, productId);
    if (!product) return null;
    var history = state.observations.filter(function (o) { return o.productId === productId; })
      .slice()
      .sort(function (a, b) { return String(b.date).localeCompare(String(a.date)) || b.createdAt - a.createdAt; });
    var last = history[0] || obsById(state, product.lastObservationId);
    return {
      product: product,
      usual: usualOf(state, product),
      best: bestOf(state, product),
      last: last,
      history: history
    };
  }

  function cleanIncoming(incoming) {
    return {
      name: String(incoming.name || '').trim(),
      brand: String(incoming.brand || '').trim(),
      price: decimal.format(decimal.parse(incoming.price)),
      currency: String(incoming.currency || 'HKD').toUpperCase(),
      packQty: String(incoming.packQty == null ? '' : incoming.packQty).trim(),
      packUnit: units.canon(incoming.packUnit || ''),
      shop: String(incoming.shop || '').trim(),
      date: String(incoming.date || '').trim(),
      source: incoming.source || 'manual',
      promo: !!incoming.promo
    };
  }

  function decide(state, productId, incoming) {
    var inc = cleanIncoming(incoming || {});
    if (!productId) return { kind: 'create', incoming: inc };
    var product = productById(state, productId);
    if (!product) return { kind: 'create', incoming: inc };
    var usual = usualOf(state, product);
    if (!usual) return { kind: 'create', incoming: inc, productId: productId };
    if (!comparable(inc, usual)) {
      var reason = String(inc.currency).toUpperCase() !== String(usual.currency).toUpperCase() ? 'currency' : 'pack';
      return { kind: 'basis-diff', reason: reason, productId: productId, incoming: inc };
    }
    if (decimal.eq(inc.price, usual.price)) return { kind: 'immediate', productId: productId, incoming: inc };
    return {
      kind: 'price-diff',
      productId: productId,
      incoming: inc,
      direction: decimal.cmp(inc.price, usual.price) > 0 ? 'higher' : 'lower',
      delta: decimal.abs(decimal.sub(inc.price, usual.price)),
      currency: usual.currency
    };
  }

  function isDuplicate(state, productId, inc) {
    return state.observations.some(function (obs) {
      return obs.productId === productId
        && String(obs.shop || '').trim().toLowerCase() === String(inc.shop || '').trim().toLowerCase()
        && String(obs.date) === String(inc.date)
        && String(obs.currency).toUpperCase() === String(inc.currency).toUpperCase()
        && obs.source === inc.source
        && decimal.eq(obs.price, inc.price)
        && units.samePack(obs.packQty, obs.packUnit, inc.packQty, inc.packUnit);
    });
  }

  function observationFrom(inc, productId, id, now) {
    return {
      id: id,
      productId: productId,
      price: inc.price,
      currency: inc.currency,
      packQty: inc.packQty,
      packUnit: inc.packUnit,
      shop: inc.shop,
      date: inc.date,
      source: inc.source,
      promo: !!inc.promo,
      createdAt: now
    };
  }

  function apply(state, decision, choice, incoming, clock) {
    var next = clone(state);
    var inc = cleanIncoming(incoming || (decision && decision.incoming) || {});
    if (!choice || choice === 'cancel') return { state: next, wrote: false };
    var now = clock && clock.now ? clock.now : Date.now();
    var id = clock && clock.id ? clock.id : function (p) { return p + '-' + now; };

    if (choice === 'create' || choice === 'variant' || decision.kind === 'create') {
      var pid = id('p');
      var oid = id('o');
      var obs = observationFrom(inc, pid, oid, now);
      next.products.push({
        id: pid,
        name: inc.name || 'Untitled',
        brand: inc.brand,
        packQty: inc.packQty,
        packUnit: inc.packUnit,
        usualObservationId: oid,
        lastObservationId: oid,
        createdAt: now
      });
      next.observations.push(obs);
      return { state: next, wrote: true, productId: pid };
    }

    var product = productById(next, decision.productId);
    if (!product) return { state: next, wrote: false };
    if (isDuplicate(next, product.id, inc)) return { state: state, wrote: false, duplicate: true };

    var oid2 = id('o');
    next.observations.push(observationFrom(inc, product.id, oid2, now));
    product.lastObservationId = oid2;
    if (choice === 'usual' || choice === 'accept' && decision.kind === 'create') product.usualObservationId = oid2;
    if (choice === 'usual') product.usualObservationId = oid2;
    if (choice === 'accept') {
      var usual = usualOf(next, product);
      if (usual && usual.id === product.usualObservationId && decision.kind === 'immediate') {
        /* usual stays */
      }
    }
    return { state: next, wrote: true, productId: product.id };
  }

  function markUsual(state, productId, observationId) {
    var next = clone(state);
    var product = productById(next, productId);
    var obs = obsById(next, observationId);
    if (!product || !obs || obs.productId !== productId) return state;
    product.usualObservationId = observationId;
    product.packQty = obs.packQty;
    product.packUnit = obs.packUnit;
    return next;
  }

  return { blank: blank, decide: decide, apply: apply, card: card, markUsual: markUsual, cleanIncoming: cleanIncoming };
});
