'use strict';

const assert = require('assert');
const decimal = require('../js/decimal');
const units = require('../js/units');
const napkin = require('../js/napkin');
const mental = require('../js/mental');
const tax = require('../js/tax');
const prices = require('../js/prices');
const results = require('../js/results');
const rates = require('../js/rates');

let failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log('ok  ' + name);
  } catch (err) {
    failed++;
    console.error('FAIL ' + name);
    console.error('     ' + (err && err.stack ? err.stack : err));
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    console.log('ok  ' + name);
  } catch (err) {
    failed++;
    console.error('FAIL ' + name);
    console.error('     ' + (err && err.stack ? err.stack : err));
  }
}

test('decimal 0.1 + 0.2 = 0.3', () => {
  assert.strictEqual(decimal.add('0.1', '0.2'), '0.3');
});

test('decimal money subtract and compare', () => {
  assert.strictEqual(decimal.sub('42', '39'), '3');
  assert.strictEqual(decimal.cmp('39', '42'), -1);
  assert.strictEqual(decimal.eq('42.00', '42'), true);
  assert.strictEqual(decimal.round('1.005', 2), '1.01');
});

test('decimal division by zero is null', () => {
  assert.strictEqual(decimal.div('1', '0'), null);
});

test('pack factors match Deal Checker', () => {
  const table = units.packTable();
  assert.strictEqual(table.kg.factor, '1000');
  assert.strictEqual(table.lb.factor, '453.592');
  assert.strictEqual(table.oz.factor, '28.3495');
  assert.strictEqual(table.L.factor, '1000');
  assert.strictEqual(table['fl oz'].factor, '29.5735');
  assert.strictEqual(table.gal.factor, '3785.41');
  assert.strictEqual(table.m.factor, '100');
  assert.strictEqual(table.mm.factor, '0.1');
  assert.strictEqual(table.in.factor, '2.54');
  assert.strictEqual(table.ft.factor, '30.48');
  assert.strictEqual(table.yd.factor, '91.44');
  assert.strictEqual(table.pcs.type, 'count');
});

test('1 kg = 1000 g and 750 mL = 0.75 L', () => {
  assert.strictEqual(units.convert('1', 'kg', 'g'), '1000');
  assert.strictEqual(units.convert('750', 'ml', 'L'), '0.75');
});

test('weight does not convert to volume', () => {
  assert.strictEqual(units.convert('500', 'g', 'ml'), null);
});

test('temperature is affine', () => {
  assert.strictEqual(units.convert('0', 'C', 'F'), '32');
  assert.strictEqual(units.convert('100', 'C', 'F'), '212');
  assert.strictEqual(units.convert('-40', 'C', 'F'), '-40');
  assert.strictEqual(units.convert('0', 'C', 'K'), '273.15');
});

test('area conversion', () => {
  assert.strictEqual(units.convert('1', 'm2', 'cm2'), '10000');
});

test('same pack in different spellings matches', () => {
  assert.strictEqual(units.samePack('500', 'ml', '0.5', 'L'), true);
  assert.strictEqual(units.samePack('500', 'ml', '500', 'g'), false);
  assert.strictEqual(units.samePack('', '', '', ''), true);
});

test('scratchpad 32 x 5 is 160 and a note stays a note', () => {
  assert.deepStrictEqual(napkin.classifyLine('32 x 5'), { kind: 'math', value: '160' });
  assert.deepStrictEqual(napkin.classifyLine('hello there'), { kind: 'note' });
  assert.deepStrictEqual(napkin.classifyLine('30 per bottle / 5'), { kind: 'math', value: '6' });
});

test('bare number counts, marked note does not, ambiguous line is a note', () => {
  assert.deepStrictEqual(napkin.classifyLine('42'), { kind: 'bare', value: '42' });
  assert.deepStrictEqual(napkin.classifyLine('# 42'), { kind: 'note' });
  assert.deepStrictEqual(napkin.classifyLine('20 cookies'), { kind: 'note' });
  assert.deepStrictEqual(napkin.classifyLine('10 +'), { kind: 'note' });
});

test('scratchpad total sums math and bare numbers only', () => {
  const text = '32 x 5\nhello\n42\n# 9\n30 per bottle / 5';
  assert.strictEqual(napkin.total(text), '208');
});

test('scratchpad does not execute code', () => {
  assert.deepStrictEqual(napkin.classifyLine('alert(1)'), { kind: 'note' });
  assert.deepStrictEqual(napkin.classifyLine('10; alert(1)'), { kind: 'note' });
});

test('mental math labels a few rates as approximate shortcuts', () => {
  assert.strictEqual(mental.describe('1').text, '1:1 — no math needed');
  assert.strictEqual(mental.describe('4').text, 'Multiply by 4');
  assert.strictEqual(mental.describe('0.25').text, 'Divide by 4');
  assert.strictEqual(mental.describe('0').text, '');
  assert.strictEqual(mental.describe('-2').text, '');
});

test('inclusive tax 1100 at 10% extracts 100', () => {
  const r = tax.calculate({ price: '1100', ratePercent: '10', mode: 'inclusive', currency: 'HKD' });
  assert.strictEqual(r.tax, '100');
  assert.strictEqual(r.checkout, '1100');
});

test('exclusive tax 1000 at 10% adds 100', () => {
  const r = tax.calculate({ price: '1000', ratePercent: '10', mode: 'exclusive', currency: 'HKD' });
  assert.strictEqual(r.tax, '100');
  assert.strictEqual(r.checkout, '1100');
});

test('refund fee is a percent of the tax', () => {
  const r = tax.refund({ tax: '100', feePercent: '20', fixedFee: '0', currency: 'HKD' });
  assert.strictEqual(r.fee, '20');
  assert.strictEqual(r.net, '80');
});

test('refund totals stay split by currency', () => {
  const summary = tax.summarizeRefunds([
    { status: 'expected', currency: 'JPY', estimatedNet: '500', actualAmount: '' },
    { status: 'submitted', currency: 'HKD', estimatedNet: '80', actualAmount: '' },
    { status: 'received', currency: 'HKD', estimatedNet: '40', actualAmount: '30' },
    { status: 'cancelled', currency: 'HKD', estimatedNet: '10', actualAmount: '' }
  ]);
  assert.strictEqual(summary.pending.JPY, '500');
  assert.strictEqual(summary.pending.HKD, '80');
  assert.strictEqual(summary.received.HKD, '30');
  assert.strictEqual(summary.pending.JPY !== summary.pending.HKD, true);
});

function mem() {
  return prices.blank();
}

test('new product initialises usual, best, and last seen', () => {
  const d = prices.decide(mem(), null, { price: '42', currency: 'HKD', packQty: '500', packUnit: 'ml' });
  assert.strictEqual(d.kind, 'create');
  const next = prices.apply(mem(), d, 'create', sampleIncoming(), clock());
  assert.strictEqual(next.wrote, true);
  assert.strictEqual(next.state.products.length, 1);
  const card = prices.card(next.state, next.state.products[0].id);
  assert.strictEqual(card.usual.price, '42');
  assert.strictEqual(card.best.price, '42');
  assert.strictEqual(card.last.price, '42');
});

test('same price updates last seen and keeps best', () => {
  let state = seed();
  const d = prices.decide(state, 'p1', { price: '42', currency: 'HKD', packQty: '500', packUnit: 'ml', shop: 'Wellcome', date: '2026-11-17' });
  assert.strictEqual(d.kind, 'immediate');
  const next = prices.apply(state, d, 'accept', incoming({ shop: 'Wellcome', date: '2026-11-17' }), clock());
  const card = prices.card(next.state, 'p1');
  assert.strictEqual(card.last.shop, 'Wellcome');
  assert.strictEqual(card.last.date, '2026-11-17');
  assert.strictEqual(card.usual.price, '42');
  assert.strictEqual(card.best.price, '35');
});

test('different price cancel writes nothing', () => {
  const state = seed();
  const d = prices.decide(state, 'p1', { price: '39', currency: 'HKD', packQty: '500', packUnit: 'ml' });
  assert.strictEqual(d.kind, 'price-diff');
  assert.strictEqual(d.direction, 'lower');
  assert.strictEqual(d.delta, '3');
  const next = prices.apply(state, d, 'cancel', incoming({ price: '39' }), clock());
  assert.strictEqual(next.wrote, false);
  assert.strictEqual(next.state.observations.length, state.observations.length);
  assert.strictEqual(prices.card(next.state, 'p1').last.price, '42');
});

test('last seen only can lower best and leaves usual', () => {
  const state = seed();
  const d = prices.decide(state, 'p1', { price: '30', currency: 'HKD', packQty: '500', packUnit: 'ml' });
  const next = prices.apply(state, d, 'last-seen', incoming({ price: '30', promo: true, shop: 'ParknShop', date: '2026-11-17' }), clock());
  const card = prices.card(next.state, 'p1');
  assert.strictEqual(card.usual.price, '42');
  assert.strictEqual(card.best.price, '30');
  assert.strictEqual(card.last.price, '30');
  assert.strictEqual(card.last.promo, true);
});

test('update usual too replaces the usual price', () => {
  const state = seed();
  const d = prices.decide(state, 'p1', { price: '39', currency: 'HKD', packQty: '500', packUnit: 'ml' });
  const next = prices.apply(state, d, 'usual', incoming({ price: '39', shop: 'Wellcome', date: '2026-11-17' }), clock());
  const card = prices.card(next.state, 'p1');
  assert.strictEqual(card.usual.price, '39');
  assert.strictEqual(card.last.price, '39');
  assert.strictEqual(card.best.price, '35');
});

test('different pack does not compare package totals', () => {
  const state = seed();
  const d = prices.decide(state, 'p1', { price: '70', currency: 'HKD', packQty: '1', packUnit: 'L' });
  assert.strictEqual(d.kind, 'basis-diff');
  assert.strictEqual(d.reason, 'pack');
  const next = prices.apply(state, d, 'variant', incoming({ price: '70', packQty: '1', packUnit: 'L', name: 'Shampoo' }), clock());
  assert.strictEqual(next.state.products.length, 2);
  assert.strictEqual(prices.card(next.state, 'p1').usual.price, '42');
});

test('different currency keeps both originals', () => {
  const state = seed();
  const d = prices.decide(state, 'p1', { price: '580', currency: 'JPY', packQty: '500', packUnit: 'ml' });
  assert.strictEqual(d.kind, 'basis-diff');
  assert.strictEqual(d.reason, 'currency');
  const next = prices.apply(state, d, 'last-seen', incoming({ price: '580', currency: 'JPY' }), clock());
  const card = prices.card(next.state, 'p1');
  assert.strictEqual(card.usual.currency, 'HKD');
  assert.strictEqual(card.usual.price, '42');
  assert.strictEqual(card.best.currency, 'HKD');
  assert.strictEqual(card.best.price, '35');
  assert.strictEqual(card.last.currency, 'JPY');
  assert.strictEqual(card.last.price, '580');
});

test('duplicate observation is not written twice', () => {
  const state = seed();
  const d = prices.decide(state, 'p1', { price: '42', currency: 'HKD', packQty: '500', packUnit: 'ml', shop: 'Wellcome', date: '2026-11-15', source: 'manual' });
  const next = prices.apply(state, d, 'accept', incoming({ shop: 'Wellcome', date: '2026-11-15', source: 'manual' }), clock());
  assert.strictEqual(next.duplicate, true);
  assert.strictEqual(next.state.observations.length, 2);
});

test('mark as usual points at the chosen observation', () => {
  const state = seed();
  const next = prices.markUsual(state, 'p1', 'o-best');
  assert.strictEqual(prices.card(next, 'p1').usual.price, '35');
  assert.strictEqual(prices.card(next, 'p1').best.price, '35');
});

test('do not paste yen into an HKD field', () => {
  const plan = results.insertionPlan(
    { kind: 'money', value: '580', currency: 'JPY', label: 'Converted' },
    { kind: 'money', currency: 'HKD' },
    {}
  );
  assert.strictEqual(plan.action, 'choose');
  assert.strictEqual(plan.choices.includes('convert'), false);
});

test('convert yen only when a rate is supplied', () => {
  const plan = results.insertionPlan(
    { kind: 'money', value: '580', currency: 'JPY', label: 'Converted' },
    { kind: 'money', currency: 'HKD' },
    { rate: '0.05', rateAsOf: '2026-11-16', rateSource: 'cached' }
  );
  assert.strictEqual(plan.action, 'choose');
  assert.strictEqual(plan.choices.includes('convert'), true);
  assert.strictEqual(plan.converted.value, '29');
  assert.strictEqual(plan.converted.currency, 'HKD');
});

test('refuse millilitres in a price field', () => {
  const plan = results.insertionPlan(
    { kind: 'quantity', value: '750', unit: 'ml', label: 'Units' },
    { kind: 'money', currency: 'HKD' },
    {}
  );
  assert.strictEqual(plan.action, 'refuse');
  assert.strictEqual(plan.reason, 'kind');
});

test('convert a compatible quantity before insert', () => {
  const plan = results.insertionPlan(
    { kind: 'quantity', value: '750', unit: 'ml', label: 'Units' },
    { kind: 'quantity', unit: 'L' },
    {}
  );
  assert.strictEqual(plan.action, 'insert');
  assert.strictEqual(plan.value, '0.75');
});

test('publishing a slot replaces the previous result', () => {
  const store = results.blank();
  results.publish(store, { slot: 'deal-best', sourceTool: 'deals', kind: 'money', value: '10', currency: 'HKD', label: 'Best option', calculatedAt: 1 });
  results.publish(store, { slot: 'deal-best', sourceTool: 'deals', kind: 'money', value: '8', currency: 'HKD', label: 'Best option', calculatedAt: 2 });
  assert.strictEqual(results.list(store).length, 1);
  assert.strictEqual(results.list(store)[0].value, '8');
});

test('recent results are the latest few', () => {
  const store = results.blank();
  results.publish(store, { slot: 'a', kind: 'money', value: '1', currency: 'HKD', label: 'A', calculatedAt: 1, sourceTool: 'currency' });
  results.publish(store, { slot: 'b', kind: 'money', value: '2', currency: 'HKD', label: 'B', calculatedAt: 2, sourceTool: 'tax' });
  results.publish(store, { slot: 'c', kind: 'quantity', value: '3', unit: 'g', label: 'C', calculatedAt: 3, sourceTool: 'units' });
  const recent = results.recent(store, 2);
  assert.deepStrictEqual(recent.map((r) => r.slot), ['c', 'b']);
});

test('rate parser keeps the date and does not call a cached rate live', () => {
  const parsed = rates.parseFrankfurter({ base: 'HKD', date: '2026-11-16', rates: { USD: 0.128, JPY: 19.2 } });
  assert.strictEqual(parsed.base, 'HKD');
  assert.strictEqual(parsed.date, '2026-11-16');
  assert.strictEqual(parsed.rates.JPY, '19.2');
  const label = rates.describeCache(parsed, Date.parse('2026-11-18T00:00:00Z'), false);
  assert.strictEqual(label.live, false);
  assert.strictEqual(label.stale, true);
});

const listStore = require('../js/list-store');
const listCodec = require('../js/list-codec');
const store = require('../js/store');

test('store round-trips shoppingList', () => {
  const data = store.defaults();
  data.shoppingList = { version: 1, activeListId: 'x', lists: [{ id: 'x', name: 'Shopping', items: [] }] };
  const merged = store.readBundle(store.bundle(data));
  assert.ok(merged.shoppingList);
  assert.strictEqual(merged.shoppingList.activeListId, 'x');
});

test('list store defaults one empty list', () => {
  const d = listStore.defaults();
  assert.strictEqual(d.version, 1);
  assert.ok(d.activeListId);
  assert.strictEqual(d.lists.length, 1);
  assert.deepStrictEqual(d.lists[0].items, []);
});

test('list addItem inserts active unchecked', () => {
  const mem = { data: null };
  const api = listStore.withStorage({
    getItem: () => mem.data,
    setItem: (_k, v) => { mem.data = v; }
  });
  api.save(api.defaults());
  const item = api.addItem({ title: ' Milk ', quantity: '2', isRecurring: false });
  assert.strictEqual(item.title, 'Milk');
  assert.strictEqual(item.isActive, true);
  assert.strictEqual(item.isChecked, false);
  assert.strictEqual(item.isRecurring, false);
});

test('list addItem reactivates single clear title match', () => {
  const mem = { data: null };
  const api = listStore.withStorage({
    getItem: () => mem.data,
    setItem: (_k, v) => { mem.data = v; }
  });
  api.save(api.defaults());
  const a = api.addItem({ title: 'Eggs', isRecurring: true });
  api.toggleChecked(a.id, true);
  api.finishTrip(); // eggs → idle staple
  const b = api.addItem({ title: 'eggs', quantity: '12' });
  assert.strictEqual(b.id, a.id);
  assert.strictEqual(b.isActive, true);
  assert.strictEqual(b.isRecurring, true);
  assert.strictEqual(b.quantity, '12');
});

test('list addItem reactivation appends sort to end of to-buy', () => {
  const mem = { data: null };
  const api = listStore.withStorage({
    getItem: () => mem.data,
    setItem: (_k, v) => { mem.data = v; }
  });
  api.save(api.defaults());
  const a = api.addItem({ title: 'Eggs', isRecurring: true });
  const b = api.addItem({ title: 'Bread', isRecurring: false });
  api.toggleChecked(a.id, true);
  api.finishTrip(); // eggs → idle staple; bread stays active
  const reactivated = api.addItem({ title: 'Eggs' });
  assert.strictEqual(reactivated.id, a.id);
  assert.strictEqual(reactivated.isActive, true);
  assert.strictEqual(reactivated.isChecked, false);
  assert.ok(reactivated.sort > b.sort);
});

test('list finishTrip deletes one-offs and idles staples', () => {
  const mem = { data: null };
  const api = listStore.withStorage({
    getItem: () => mem.data,
    setItem: (_k, v) => { mem.data = v; }
  });
  api.save(api.defaults());
  const staple = api.addItem({ title: 'Rice', isRecurring: true });
  const once = api.addItem({ title: 'Cake', isRecurring: false });
  api.toggleChecked(staple.id, true);
  api.toggleChecked(once.id, true);
  api.finishTrip();
  const list = api.activeList();
  assert.ok(!list.items.find((i) => i.id === once.id));
  const rice = list.items.find((i) => i.id === staple.id);
  assert.ok(rice);
  assert.strictEqual(rice.isActive, false);
  assert.strictEqual(rice.isChecked, false);
});

test('list importMerge allows duplicate titles', () => {
  const mem = { data: null };
  const api = listStore.withStorage({
    getItem: () => mem.data,
    setItem: (_k, v) => { mem.data = v; }
  });
  api.save(api.defaults());
  api.addItem({ title: 'Milk', isRecurring: false });
  api.importMerge([{ t: 'Milk', q: '1', r: 0, c: 0 }]);
  const milks = api.activeList().items.filter((i) => i.title.toLowerCase() === 'milk' && i.isActive);
  assert.ok(milks.length >= 2);
});

test('list importMerge appends sorts after local max and moveItem works across them', () => {
  const mem = { data: null };
  const api = listStore.withStorage({
    getItem: () => mem.data,
    setItem: (_k, v) => { mem.data = v; }
  });
  api.save(api.defaults());
  const a = api.addItem({ title: 'Local A' });
  const b = api.addItem({ title: 'Local B' });
  const localMax = Math.max(a.sort, b.sort);
  // Payload `o` values collide with local sorts; importer must reassign.
  api.importMerge([
    { t: 'Remote Y', r: 0, c: 0, o: 2 },
    { t: 'Remote X', r: 0, c: 0, o: 1 }
  ]);
  const items = api.activeList().items;
  const x = items.find((i) => i.title === 'Remote X');
  const y = items.find((i) => i.title === 'Remote Y');
  assert.ok(x.sort > localMax);
  assert.ok(y.sort > x.sort); // relative payload order preserved (o=1 before o=2)
  const sorts = items.map((i) => i.sort);
  assert.strictEqual(new Set(sorts).size, sorts.length);
  const order = () => api.activeList().items
    .filter((i) => i.isActive && !i.isChecked)
    .sort((p, q) => p.sort - q.sort)
    .map((i) => i.title);
  assert.deepStrictEqual(order(), ['Local A', 'Local B', 'Remote X', 'Remote Y']);
  api.moveItem(x.id, -1); // across local/imported boundary
  assert.deepStrictEqual(order(), ['Local A', 'Remote X', 'Local B', 'Remote Y']);
  api.moveItem(b.id, 1);
  assert.deepStrictEqual(order(), ['Local A', 'Remote X', 'Remote Y', 'Local B']);
});

test('list importReplace keeps idle staples', () => {
  const mem = { data: null };
  const api = listStore.withStorage({
    getItem: () => mem.data,
    setItem: (_k, v) => { mem.data = v; }
  });
  api.save(api.defaults());
  const staple = api.addItem({ title: 'Butter', isRecurring: true });
  api.toggleChecked(staple.id, true);
  api.finishTrip();
  api.addItem({ title: 'Chips', isRecurring: false });
  api.importReplace([{ t: 'Salsa', r: 0, c: 0 }]);
  const list = api.activeList();
  assert.ok(list.items.find((i) => i.id === staple.id && !i.isActive));
  assert.ok(list.items.find((i) => i.title === 'Salsa' && i.isActive));
  assert.ok(!list.items.find((i) => i.title === 'Chips' && i.isActive));
});

test('list codec round-trip', () => {
  const b64 = listCodec.encodeShare({
    v: 1,
    n: 'Shopping',
    i: [{ t: 'Milk', q: '2', r: 1, c: 0, o: 0 }]
  });
  assert.ok(b64.length > 8);
  assert.ok(!/[+/=]/.test(b64)); // url-safe, no pad
  const payload = listCodec.decodeShare(b64);
  assert.strictEqual(payload.v, 1);
  assert.strictEqual(payload.i[0].t, 'Milk');
});

test('list codec parseUrl reads #d=', () => {
  const b64 = listCodec.encodeShare({ v: 1, i: [{ t: 'Tea', r: 0, c: 0 }] });
  const url = 'https://example.com/tools/shopping-list/index.html#d=' + b64;
  assert.strictEqual(listCodec.parseUrl(url), b64);
});

function clock() {
  return { now: 1000, id: (() => { let n = 0; return (p) => p + '-' + (++n); })() };
}

function sampleIncoming() {
  return { name: 'Shampoo', price: '42', currency: 'HKD', packQty: '500', packUnit: 'ml', shop: 'Wellcome', date: '2026-11-15', source: 'manual' };
}

function incoming(over) {
  return Object.assign({ name: 'Shampoo', price: '42', currency: 'HKD', packQty: '500', packUnit: 'ml', shop: '', date: '2026-11-17', source: 'manual', promo: false }, over);
}

function seed() {
  const created = prices.apply(mem(), { kind: 'create' }, 'create', sampleIncoming(), { now: 1, id: () => 'p1' });
  const withBest = prices.apply(created.state, { kind: 'price-diff', productId: 'p1' }, 'last-seen', incoming({ price: '35', shop: 'Mannings', date: '2026-11-10', source: 'manual' }), { now: 2, id: () => 'o-best' });
  return withBest.state;
}

(async () => {
  await testAsync('failed refresh keeps the previous cache', async () => {
    const memory = { cache: { base: 'HKD', date: '2026-11-01', fetchedAt: 1, source: 'frankfurter', rates: { USD: '0.12' } }, manual: {} };
    const out = await rates.refresh(memory, async () => { throw new Error('offline'); }, 2);
    assert.strictEqual(out.ok, false);
    assert.strictEqual(memory.cache.date, '2026-11-01');
    assert.strictEqual(memory.cache.rates.USD, '0.12');
  });
  if (failed) {
    console.error('\n' + failed + ' failed');
    process.exit(1);
  }
  console.log('\nall passed');
})();
