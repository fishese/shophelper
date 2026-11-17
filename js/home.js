'use strict';

(function () {
  var Store = window.ShophelperStore;
  var Prices = window.ShophelperPrices;
  var SH = window.Shophelper;
  var currency = document.getElementById('homeCurrency');
  var theme = document.getElementById('theme');
  SH.currencySelect(SH.homeCurrency()).querySelectorAll('option').forEach(function (option) {
    currency.appendChild(option);
  });
  var settings = Store.load().settings;
  currency.value = settings.homeCurrency || 'HKD';
  theme.value = settings.theme === 'light' ? 'light' : 'dark';
  currency.addEventListener('change', function () {
    Store.update(function (data) { data.settings.homeCurrency = currency.value; });
  });
  theme.addEventListener('change', function () {
    SH.setTheme(theme.value);
  });
  window.addEventListener('shophelper-theme', function () {
    theme.value = Store.load().settings.theme === 'light' ? 'light' : 'dark';
  });

  document.getElementById('exportJson').addEventListener('click', function () {
    download('shophelper-backup.json', JSON.stringify(Store.bundle(), null, 2), 'application/json');
  });
  document.getElementById('exportCsv').addEventListener('click', function () {
    download('shophelper-prices.csv', pricesCsv(Store.load()), 'text/csv');
  });

  var pending = null;
  document.getElementById('importFile').addEventListener('change', function (event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = Store.readBundle(JSON.parse(String(reader.result)));
        if (!data) throw new Error('unreadable');
        pending = data;
        document.getElementById('importPreview').textContent =
          'Backup has ' + data.products.length + ' products, ' + data.observations.length + ' price notes, and ' + data.refunds.length + ' refunds. Import replaces Shophelper backup data.';
        var button = document.createElement('button');
        button.className = 'sh-btn warn';
        button.type = 'button';
        button.textContent = 'Replace with this backup';
        button.addEventListener('click', function () {
          Store.save(pending);
          try {
            if (pending.shoppingList) {
              localStorage.setItem('shophelper_list_v1', JSON.stringify(pending.shoppingList));
            }
          } catch (e) {}
          SH.applyTheme();
          SH.toast('Backup restored.');
          location.reload();
        });
        document.getElementById('importPreview').after(button);
      } catch (err) {
        document.getElementById('importPreview').textContent = 'That file is not a Shophelper backup.';
      }
    };
    reader.readAsText(file);
  });

  function download(name, text, type) {
    var blob = new Blob([text], { type: type + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  }

  function csvCell(value) {
    var text = String(value == null ? '' : value);
    return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  }

  function pricesCsv(data) {
    var rows = [['name', 'brand', 'pack', 'unit', 'usual', 'usual currency', 'best', 'best currency', 'last seen', 'last currency', 'shop', 'date']];
    data.products.forEach(function (product) {
      var card = Prices.card(data, product.id);
      rows.push([
        product.name, product.brand || '', product.packQty || '', product.packUnit || '',
        card.usual && card.usual.price, card.usual && card.usual.currency,
        card.best && card.best.price, card.best && card.best.currency,
        card.last && card.last.price, card.last && card.last.currency,
        card.last && card.last.shop, card.last && card.last.date
      ]);
    });
    return rows.map(function (row) { return row.map(csvCell).join(','); }).join('\n');
  }
})();
