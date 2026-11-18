'use strict';

const assert = require('assert');
const sizes = require('../js/sizes');
const sizesStore = require('../js/sizes-store');
const shopStore = require('../js/store');

function mem() {
  const data = {};
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; }
  };
}

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

test('women US 8 is UK 12, EU-DE 38, EU-FR 40, IT 44, JP 13, letter M', () => {
  const out = sizes.convertClothing({ category: 'women', from: 'us', size: '8' });
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.equivalents.uk, '12');
  assert.strictEqual(out.equivalents.au, '12');
  assert.strictEqual(out.equivalents['eu-de'], '38');
  assert.strictEqual(out.equivalents['eu-fr'], '40');
  assert.strictEqual(out.equivalents.it, '44');
  assert.strictEqual(out.equivalents.jp, '13');
  assert.strictEqual(out.equivalents.letter, 'M');
});

test('women US 08 matches US 8', () => {
  const out = sizes.convertClothing({ category: 'women', from: 'us', size: '08' });
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.equivalents.uk, '12');
});

test('women in-between size returns neighbours, not a fake row', () => {
  const out = sizes.convertClothing({ category: 'women', from: 'us', size: '9' });
  assert.strictEqual(out.ok, true);
  assert.ok(out.neighbours);
  assert.deepStrictEqual(out.neighbours.map((n) => n.equivalents.us), ['8', '10']);
});

test('unknown clothing size fails closed', () => {
  const out = sizes.convertClothing({ category: 'women', from: 'us', size: '99' });
  assert.strictEqual(out.ok, false);
});

test('men 40 in chest suggests M / US 38-40 / EU 48-50', () => {
  const out = sizes.suggestFromMeasurements({
    category: 'men',
    measurements: { chest: '101' }
  });
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.approximate, true);
  assert.strictEqual(out.equivalents.letter, 'M');
  assert.strictEqual(out.equivalents.us, '38-40');
  assert.strictEqual(out.equivalents.eu, '48-50');
});

test('men 94 cm chest is between S and M', () => {
  const out = sizes.suggestFromMeasurements({
    category: 'men',
    measurements: { chest: '94' }
  });
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.between, true);
});

test('women bust 92 cm suggests the US 8 row', () => {
  const out = sizes.suggestFromMeasurements({
    category: 'women',
    measurements: { chest: '92', height: '165' }
  });
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.approximate, true);
  assert.strictEqual(out.equivalents.us, '8');
  assert.strictEqual(out.cn, '165/92A');
});

test('bra US 32C is UK 32C, EU 70C, FR 85C, AU 10C, JP 70C', () => {
  const out = sizes.convertBra({ from: 'us', band: '32', cup: 'C' });
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.equivalents.uk.label, '32C');
  assert.strictEqual(out.equivalents.eu.label, '70C');
  assert.strictEqual(out.equivalents.fr.label, '85C');
  assert.strictEqual(out.equivalents.au.label, '10C');
  assert.strictEqual(out.equivalents.jp.label, '70C');
});

test('bra cups after D map by step, not letter (US DDD = UK E = EU F)', () => {
  const out = sizes.convertBra({ from: 'us', band: '34', cup: 'DDD' });
  assert.strictEqual(out.equivalents.uk.cup, 'E');
  assert.strictEqual(out.equivalents.eu.cup, 'F');
  const alt = sizes.convertBra({ from: 'us', band: '34', cup: 'F' });
  assert.deepStrictEqual(alt.equivalents.uk, out.equivalents.uk);
});

test('bra US output prefers DD and DDD and shows the alternate', () => {
  const dd = sizes.convertBra({ from: 'uk', band: '32', cup: 'DD' });
  assert.strictEqual(dd.equivalents.us.cup, 'DD');
  assert.strictEqual(dd.equivalents.us.label, '32DD (E)');
  const ddd = sizes.convertBra({ from: 'uk', band: '34', cup: 'E' });
  assert.strictEqual(ddd.equivalents.us.cup, 'DDD');
  assert.strictEqual(ddd.equivalents.us.label, '34DDD (F)');
});

test('bra sister sizes of 32C include 30D and 34B', () => {
  const out = sizes.convertBra({ from: 'uk', band: '32', cup: 'C' });
  const labels = out.sisters.map((s) => s.equivalents.uk.label).sort();
  assert.deepStrictEqual(labels, ['30D', '34B']);
  assert.ok(out.sisters.every((s) => s.steps === 1));
});

test('bra wider sisters of 32C are 28DD and 36A and marked less reliable', () => {
  const out = sizes.convertBra({ from: 'uk', band: '32', cup: 'C' });
  const labels = out.sistersMore.map((s) => s.equivalents.uk.label).sort();
  assert.deepStrictEqual(labels, ['28DD', '36A']);
  assert.ok(out.sistersMore.every((s) => s.steps === 2 && s.reliable === false));
});

test('bra sisters are also shown in UK when converting from US', () => {
  const out = sizes.convertBra({ from: 'us', band: '32', cup: 'C' });
  const labels = out.sisters.map((s) => s.equivalents.uk.label).sort();
  assert.deepStrictEqual(labels, ['30D', '34B']);
});

test('AU bra 10 is not treated as a 10-inch band', () => {
  const out = sizes.convertBra({ from: 'au', band: '10', cup: 'C' });
  assert.strictEqual(out.equivalents.us.band, '32');
});

test('bra suggest from underbust 80 and bust 96 is about 32C', () => {
  const out = sizes.suggestFromMeasurements({
    category: 'bra',
    measurements: { underbust: '80', chest: '96' }
  });
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.approximate, true);
  assert.strictEqual(out.equivalents.uk.label, '32C');
});

test('bra band tie picks the larger band', () => {
  const out = sizes.suggestFromMeasurements({
    category: 'bra',
    measurements: { underbust: '72.5' }
  });
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.equivalents.us.band, '30');
});

test('shoe convert goes through foot length; JP 24.5 is 245 mm', () => {
  const out = sizes.convertShoe({ from: 'jp', size: '24.5' });
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.footMm, '245');
  assert.strictEqual(out.equivalents.mondo, '245');
});

test('ISO Table 2 reference row is stable', () => {
  const out = sizes.convertShoe({ from: 'mm', size: '260' });
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.equivalents.mondo, '260');
  assert.strictEqual(out.equivalents.jp, '26.0');
  assert.strictEqual(out.equivalents.eu, '41');
  assert.strictEqual(out.equivalents.uk, '7.5');
  assert.strictEqual(out.equivalents.usMen, '8.5');
  assert.strictEqual(out.equivalents.usWomen, '9.5');
});

test('ISO Table 2 mondopoint 240 is EU 38, UK 5.5, US women 7.5', () => {
  const out = sizes.convertShoe({ from: 'mondo', size: '240' });
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.equivalents.eu, '38');
  assert.strictEqual(out.equivalents.uk, '5.5');
  assert.strictEqual(out.equivalents.usWomen, '7.5');
  assert.strictEqual(out.equivalents.usMen, '6.5');
});

test('shoe regional size converts back through the same foot length', () => {
  const out = sizes.convertShoe({ from: 'uk', size: '7.5' });
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.footMm, '260');
  assert.strictEqual(out.equivalents.eu, '41');
});

test('shoe size outside the adult table is refused', () => {
  const out = sizes.convertShoe({ from: 'mm', size: '100' });
  assert.strictEqual(out.ok, false);
  assert.strictEqual(out.reason, 'out-of-range');
});

test('cm and inches round-trip a waist of 74 cm', () => {
  const inches = sizes.displayLength('74', 'in');
  const back = sizes.parseLength(inches, 'in');
  assert.ok(Math.abs(Number(back) - 74) < 0.1);
});

test('sizes store defaults to no people', () => {
  const d = sizesStore.defaults();
  assert.strictEqual(d.version, 1);
  assert.strictEqual(d.selectedPersonId, null);
  assert.deepStrictEqual(d.people, []);
  assert.strictEqual(d.displayUnit, 'cm');
});

test('add, measure, and delete a person', () => {
  const api = sizesStore.withStorage(mem());
  const p = api.addPerson({ name: 'Alex' });
  assert.strictEqual(api.load().selectedPersonId, p.id);
  api.setMeasurement(p.id, 'waist', '74');
  api.setSaved(p.id, 'shoes', { system: 'eu', size: '38', width: '', note: '' });
  const custom = api.addCustom(p.id, { label: 'Thigh', valueCm: '56' });
  const loaded = api.load().people[0];
  assert.strictEqual(loaded.measurements.waist, '74');
  assert.strictEqual(loaded.saved.shoes.size, '38');
  assert.strictEqual(loaded.custom[0].label, 'Thigh');
  assert.strictEqual(loaded.custom[0].valueCm, '56');
  api.setMeasurement(p.id, 'waist', '');
  assert.strictEqual(api.load().people[0].measurements.waist, undefined);
  api.removeCustom(p.id, custom.id);
  assert.strictEqual(api.load().people[0].custom.length, 0);
  api.deletePerson(p.id);
  assert.strictEqual(api.load().people.length, 0);
  assert.strictEqual(api.load().selectedPersonId, null);
});

test('sizes load drops malformed people and keeps unknown person fields', () => {
  const ls = mem();
  ls.setItem('shophelper_sizes_v1', JSON.stringify({
    version: 1,
    selectedPersonId: 'gone',
    displayUnit: 'in',
    people: [
      { id: 'p1', name: 'Alex', measurements: { waist: '74' }, custom: [], saved: {}, future: 'keep' },
      { name: 'NoId' },
      { id: 'x' }
    ]
  }));
  const api = sizesStore.withStorage(ls);
  const doc = api.load();
  assert.strictEqual(doc.people.length, 1);
  assert.strictEqual(doc.people[0].name, 'Alex');
  assert.strictEqual(doc.people[0].future, 'keep');
  assert.strictEqual(doc.selectedPersonId, null);
  assert.strictEqual(doc.displayUnit, 'in');
});

test('sizes document mirrors into shophelper_v1.sizes', () => {
  const ls = mem();
  global.ShophelperStore = shopStore;
  shopStore.withStorage(ls);
  const api = sizesStore.withStorage(ls);
  const p = api.addPerson({ name: 'Alex' });
  const home = JSON.parse(ls.getItem('shophelper_v1'));
  assert.strictEqual(home.sizes.people[0].id, p.id);
  assert.strictEqual(home.sizes.people[0].name, 'Alex');
});

test('store merge keeps sizes on round-trip', () => {
  const merged = shopStore.readBundle({
    app: 'shophelper',
    v: 1,
    data: {
      settings: {},
      sizes: {
        version: 1,
        selectedPersonId: null,
        displayUnit: 'cm',
        people: [{ id: 'p1', name: 'Alex', measurements: { waist: '74' }, custom: [], saved: {} }]
      }
    }
  });
  assert.strictEqual(merged.sizes.people[0].name, 'Alex');
  assert.strictEqual(merged.sizes.people[0].measurements.waist, '74');
});

test('store merge still accepts a backup with no sizes', () => {
  const merged = shopStore.readBundle({
    app: 'shophelper',
    v: 1,
    data: { settings: { homeCurrency: 'HKD' }, products: [] }
  });
  assert.ok(merged);
  assert.strictEqual(merged.sizes, null);
  assert.strictEqual(merged.settings.homeCurrency, 'HKD');
});

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('all passed');
