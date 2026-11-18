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
  var pendingCounts = null;
  var importError = false;
  var importButton = null;

  function backupPreview(counts) {
    return SH.format('backupPreview', counts);
  }

  function paintImport() {
    var preview = document.getElementById('importPreview');
    if (!preview) return;
    if (importError) preview.textContent = SH.t('backupUnreadable');
    else if (pendingCounts) preview.textContent = backupPreview(pendingCounts);
    if (importButton) importButton.textContent = SH.t('backupReplace');
  }
  window.addEventListener('shophelper-lang', paintImport);
  document.getElementById('importFile').addEventListener('change', function (event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = Store.readBundle(JSON.parse(String(reader.result)));
        if (!data) throw new Error('unreadable');
        pending = data;
        var people = data.sizes && Array.isArray(data.sizes.people) ? data.sizes.people.length : 0;
        importError = false;
        pendingCounts = { products: data.products.length, notes: data.observations.length, refunds: data.refunds.length, people: people };
        document.getElementById('importPreview').textContent = backupPreview(pendingCounts);
        if (importButton) importButton.remove();
        var button = document.createElement('button');
        button.className = 'sh-btn warn';
        button.type = 'button';
        button.textContent = SH.t('backupReplace');
        button.addEventListener('click', function () {
          Store.save(pending);
          try {
            if (pending.shoppingList) {
              localStorage.setItem('shophelper_list_v1', JSON.stringify(pending.shoppingList));
            }
            if (pending.sizes) {
              localStorage.setItem('shophelper_sizes_v1', JSON.stringify(pending.sizes));
            }
          } catch (e) {}
          SH.applyTheme();
          SH.toast(SH.t('backupRestored'));
          location.reload();
        });
        importButton = button;
        document.getElementById('importPreview').after(button);
      } catch (err) {
        pending = null;
        pendingCounts = null;
        importError = true;
        document.getElementById('importPreview').textContent = SH.t('backupUnreadable');
        if (importButton) { importButton.remove(); importButton = null; }
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
