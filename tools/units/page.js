'use strict';
(function () {
  var Units = window.ShophelperUnits;
  var Decimal = window.ShophelperDecimal;
  var Store = window.ShophelperStore;
  var SH = window.Shophelper;
  var cats = Units.categories();
  var draft = Store.load().drafts.units || { category: 'weight', from: 'g', to: 'kg', amount: '' };
  var amount = document.getElementById('amount');
  var fromUnit = document.getElementById('fromUnit');
  var toUnit = document.getElementById('toUnit');
  var result = document.getElementById('result');
  var catHost = document.getElementById('cats');
  amount.value = draft.amount || '';

  function current() {
    return cats.filter(function (cat) { return cat.id === draft.category; })[0] || cats[0];
  }

  function fill(select, units, selected) {
    select.innerHTML = '';
    units.forEach(function (unit) {
      var option = document.createElement('option');
      option.value = unit;
      option.textContent = unit;
      select.appendChild(option);
    });
    select.value = units.indexOf(selected) >= 0 ? selected : units[0];
  }

  function paintCats() {
    catHost.innerHTML = '';
    cats.forEach(function (cat) {
      var button = document.createElement('button');
      button.type = 'button';
      button.textContent = SH.t(cat.id) || cat.label;
      button.className = cat.id === draft.category ? 'on' : '';
      button.addEventListener('click', function () {
        draft.category = cat.id;
        draft.from = cat.units[0];
        draft.to = cat.units[1] || cat.units[0];
        render();
      });
      catHost.appendChild(button);
    });
  }
  window.addEventListener('shophelper-lang', function () { render(); });

  function render() {
    var cat = current();
    amount.dataset.shKind = cat.id === 'temperature' ? 'temperature' : 'quantity';
    fill(fromUnit, cat.units, draft.from);
    fill(toUnit, cat.units, draft.to);
    draft.from = fromUnit.value;
    draft.to = toUnit.value;
    paintCats();
    var value = Units.convert(amount.value, draft.from, draft.to);
    if (amount.value.trim() === '') {
      result.textContent = '—';
      SH.clearResult('units');
    } else if (value == null) {
      result.textContent = SH.t('unitsNoConvert');
      SH.clearResult('units');
    } else {
      result.textContent = value + ' ' + draft.to;
      SH.publish({
        slot: 'units', sourceTool: 'units', kind: amount.dataset.shKind,
        value: value, unit: draft.to, label: SH.t('toolUnits'), calculatedAt: Date.now()
      });
    }
    Store.update(function (data) { data.drafts.units = { category: draft.category, from: draft.from, to: draft.to, amount: amount.value }; });
  }

  fromUnit.addEventListener('change', function () { draft.from = fromUnit.value; render(); });
  toUnit.addEventListener('change', function () { draft.to = toUnit.value; render(); });
  amount.addEventListener('input', render);
  document.getElementById('swap').addEventListener('click', function () {
    var next = Decimal.parse(Units.convert(amount.value, fromUnit.value, toUnit.value));
    var swap = draft.from;
    draft.from = draft.to;
    draft.to = swap;
    if (next != null && amount.value.trim() !== '') amount.value = Decimal.format(next);
    render();
  });
  render();
})();
