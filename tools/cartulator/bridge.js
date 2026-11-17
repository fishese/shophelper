'use strict';
(function () {
  function boot() {
    var bar = document.querySelector('.topbar');
    if (bar && !document.getElementById('shSavePrice')) {
      var button = document.createElement('button');
      button.id = 'shSavePrice';
      button.type = 'button';
      button.className = 'sh-btn sh-embed-btn';
      button.textContent = Shophelper.t ? Shophelper.t('savePrice') : 'Save a price';
      button.addEventListener('click', openPicker);
      bar.appendChild(button);
    }
    if (window.ShophelperCart && window.Shophelper) {
      var totals = ShophelperCart.read().totals;
      Shophelper.publish({
        slot: 'cart-total', sourceTool: 'cartulator', kind: 'money',
        value: String(totals.final), currency: Shophelper.homeCurrency(),
        label: Shophelper.t ? Shophelper.t('cartTotalLabel') : 'Cart total', calculatedAt: Date.now()
      });
    }
  }

  function openPicker() {
    var Calc = window.CartulatorCalc;
    var snapshot = ShophelperCart.read();
    var lines = [];
    snapshot.groups.forEach(function (group) {
      String(group.items || '').split(/\r?\n/).forEach(function (line) {
        var price = Calc.parseLineValue(line);
        if (price == null) return;
        var name = line.replace(/^[\d.\sxX*+\-]+/, '').trim();
        lines.push({ name: name || group.name || '', price: String(price), group: group.name || '' });
      });
    });
    if (!lines.length) { Shophelper.toast('Add a price line first.'); return; }
    Shophelper.openDialog({
      title: 'Which line?',
      render: function (panel, close) {
        var list = document.createElement('div');
        list.className = 'sh-list';
        lines.forEach(function (line) {
          var button = document.createElement('button');
          button.type = 'button';
          button.className = 'sh-btn';
          button.textContent = (line.name || 'Item') + ' · ' + line.price;
          button.addEventListener('click', function () {
            close();
            Shophelper.openPriceSave({
              name: line.name,
              price: line.price,
              currency: Shophelper.homeCurrency(),
              source: 'Cartulator'
            });
          });
          list.appendChild(button);
        });
        panel.appendChild(list);
      }
    });
  }

  window.addEventListener('shophelper-lang', function () {
    var btn = document.getElementById('shSavePrice');
    if (btn && window.Shophelper && Shophelper.t) btn.textContent = Shophelper.t('savePrice');
    boot();
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
