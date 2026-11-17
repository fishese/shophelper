'use strict';
(function () {
  var Store = window.ShophelperStore;
  var Rates = window.ShophelperRates;
  var Mental = window.ShophelperMental;
  var Napkin = window.ShophelperNapkin;
  var Decimal = window.ShophelperDecimal;
  var SH = window.Shophelper;
  var draft = Object.assign({ amount: '', from: SH.homeCurrency(), to: 'JPY', scratch: '', scratchCurrency: SH.homeCurrency() }, Store.load().drafts.currency || {});
  var amount = document.getElementById('amount');
  var from = document.getElementById('from');
  var to = document.getElementById('to');
  var scratchCurrency = document.getElementById('scratchCurrency');
  ['from', 'to', 'scratchCurrency'].forEach(function (id) {
    var select = document.getElementById(id);
    SH.currencySelect(id === 'to' ? draft.to : (id === 'scratchCurrency' ? draft.scratchCurrency : draft.from)).querySelectorAll('option').forEach(function (option) {
      select.appendChild(option.cloneNode(true));
    });
  });
  amount.value = draft.amount || '';
  from.value = draft.from;
  to.value = draft.to;
  scratchCurrency.value = draft.scratchCurrency || draft.from;
  document.getElementById('scratch').value = draft.scratch || '';

  function saveDraft() {
    Store.update(function (data) {
      data.drafts.currency = {
        amount: amount.value, from: from.value, to: to.value,
        scratch: document.getElementById('scratch').value,
        scratchCurrency: scratchCurrency.value
      };
      var recent = data.settings.recentCurrencies.filter(function (code) { return code !== from.value && code !== to.value; });
      data.settings.recentCurrencies = [from.value, to.value].concat(recent).slice(0, 8);
    });
  }

  function render() {
    saveDraft();
    var data = Store.load();
    var converted = amount.value.trim() ? Rates.convert(data.rates, amount.value, from.value, to.value) : null;
    var rateLine = document.getElementById('rateLine');
    var mental = document.getElementById('mental');
    var result = document.getElementById('result');
    var quote = Rates.quote(data.rates, from.value, to.value);
    if (!amount.value.trim()) {
      result.textContent = '—';
      mental.textContent = '';
      SH.clearResult('fx-amount');
    } else if (!converted) {
      result.textContent = 'No rate yet';
      mental.textContent = '';
      SH.clearResult('fx-amount');
    } else {
      result.textContent = SH.money(converted.value, to.value);
      var hint = Mental.describe(converted.rate);
      mental.textContent = hint.text ? ('In your head: ' + hint.text + (hint.errorPercent > 1 ? ' (about ' + hint.errorPercent + '% off)' : '') + '.') : '';
      SH.publish({
        slot: 'fx-amount', sourceTool: 'currency', kind: 'money', value: converted.value,
        currency: to.value, label: SH.t('convertedLabel'), calculatedAt: Date.now(),
        rateAsOf: converted.asOf || '', rateSource: converted.manual ? 'manual' : 'cached'
      });
    }
    if (quote) {
      var info = Rates.describeCache({ date: quote.asOf || (data.rates.cache && data.rates.cache.date) }, Date.now(), quote.manual);
      var provenance = quote.source === 'identity' ? 'Same currency' : (quote.manual ? 'Manual rate' : (info.stale ? 'Cached rate, older than a day' : 'Cached rate'));
      rateLine.textContent = provenance + ' · 1 ' + from.value + ' = ' + quote.rate + ' ' + to.value + (quote.asOf ? ' · as of ' + quote.asOf : '');
    } else {
      rateLine.textContent = 'Refresh while online, or enter a manual rate. A cached rate stays available after that.';
    }
    renderScratch();
  }

  function renderScratch() {
    var text = document.getElementById('scratch').value;
    var host = document.getElementById('lines');
    host.innerHTML = '';
    var currency = scratchCurrency.value;
    Napkin.lines(text).forEach(function (line) {
      if (!line.text.trim()) return;
      var row = document.createElement('div');
      row.className = 'sh-line';
      var name = document.createElement('em');
      name.textContent = line.text;
      var value = document.createElement('span');
      if (line.result.kind === 'note') value.textContent = 'note';
      else value.textContent = SH.money(line.result.value, currency);
      row.appendChild(name);
      row.appendChild(value);
      host.appendChild(row);
    });
    var total = Napkin.total(text);
    var has = Napkin.lines(text).some(function (line) { return line.result.kind === 'math' || line.result.kind === 'bare'; });
    document.getElementById('scratchTotal').textContent = has ? SH.money(total, currency) : '—';
    if (has) {
      SH.publish({ slot: 'scratch-total', sourceTool: 'currency', kind: 'money', value: total, currency: currency, label: SH.t('scribbleLabel'), calculatedAt: Date.now() });
    } else SH.clearResult('scratch-total');
  }

  function syncManual() {
    var manualRate = Store.load().rates.manual[Rates.manualKey(from.value, to.value)];
    document.getElementById('manual').value = manualRate ? manualRate.rate : '';
  }

  async function refresh() {
    var memory = Store.load().rates;
    var out = await Rates.refresh(memory, async function () {
      var response = await fetch('https://api.frankfurter.app/latest?from=' + encodeURIComponent(from.value));
      if (!response.ok) throw new Error('Rate service unavailable');
      return response.json();
    }, Date.now());
    if (out.ok) Store.update(function (data) { data.rates.cache = memory.cache; });
    SH.toast(out.ok ? 'Rate updated.' : 'Could not refresh. Cached rate kept.');
    render();
  }

  document.getElementById('refresh').addEventListener('click', refresh);
  amount.addEventListener('input', render);
  from.addEventListener('change', function () { syncManual(); render(); });
  to.addEventListener('change', function () { syncManual(); render(); });
  scratchCurrency.addEventListener('change', render);
  document.getElementById('scratch').addEventListener('input', render);
  document.getElementById('swap').addEventListener('click', function () {
    var swap = from.value;
    from.value = to.value;
    to.value = swap;
    render();
  });
  document.getElementById('saveManual').addEventListener('click', function () {
    var rate = document.getElementById('manual').value.trim();
    if (Decimal.parse(rate) == null || Decimal.cmp(rate, '0') <= 0) { SH.toast('Enter a rate above zero.'); return; }
    Store.update(function (data) {
      data.rates.manual[Rates.manualKey(from.value, to.value)] = { rate: rate, asOf: SH.today() };
    });
    render();
  });
  document.getElementById('clearManual').addEventListener('click', function () {
    Store.update(function (data) { delete data.rates.manual[Rates.manualKey(from.value, to.value)]; });
    document.getElementById('manual').value = '';
    render();
  });
  document.getElementById('clearScratch').addEventListener('click', function () {
    if (!document.getElementById('scratch').value) return;
    if (!window.confirm('Clear the scribble?')) return;
    document.getElementById('scratch').value = '';
    render();
  });
  syncManual();
  render();
  refresh();
})();
