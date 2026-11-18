'use strict';

const assert = require('assert');
const sizes = require('../js/sizes');

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

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('all passed');
