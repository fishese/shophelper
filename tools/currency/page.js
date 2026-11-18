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
      result.textContent = SH.t('noRateYet');
      mental.textContent = '';
      SH.clearResult('fx-amount');
    } else {
      result.textContent = SH.money(converted.value, to.value);
      var hint = Mental.describe(converted.rate, SH.lang());
      mental.textContent = hint.text ? (SH.t('inYourHead') + hint.text + (hint.errorPercent > 1 ? SH.format('aboutOff', { n: hint.errorPercent }) : '') + SH.t('sentenceStop')) : '';
      SH.publish({
        slot: 'fx-amount', sourceTool: 'currency', kind: 'money', value: converted.value,
        currency: to.value, label: SH.t('convertedLabel'), calculatedAt: Date.now(),
        rateAsOf: converted.asOf || '', rateSource: converted.manual ? 'manual' : 'cached'
      });
    }
    if (quote) {
      var info = Rates.describeCache({ date: quote.asOf || (data.rates.cache && data.rates.cache.date) }, Date.now(), quote.manual);
      var provenance = quote.source === 'identity' ? SH.t('rateSame')
        : (quote.manual ? SH.t('rateManual')
        : (quote.source === 'bundled' ? SH.t('rateStarting')
        : (info.stale ? SH.t('rateStale') : SH.t('rateCached'))));
      var line = SH.format('rateLine', { provenance: provenance, from: from.value, rate: quote.rate, to: to.value });
      if (quote.asOf) line += ' · ' + SH.format('rateAsOf', { date: quote.asOf });
      rateLine.textContent = line;
    } else {
      rateLine.textContent = SH.t('rateMissing');
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
      if (line.result.kind === 'note') value.textContent = SH.t('scribbleNote');
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

  async function refresh(silent) {
    var memory = Store.load().rates;
    var out = await Rates.refresh(memory, async function () {
      var code = String(from.value || 'EUR').toLowerCase();
      var response = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/' + encodeURIComponent(code) + '.min.json');
      if (!response.ok) throw new Error('Rate service unavailable');
      return response.json();
    }, Date.now());
    if (out.ok) Store.update(function (data) { data.rates.cache = memory.cache; });
    if (!silent) SH.toast(out.ok ? SH.t('rateUpdated') : SH.t('rateRefreshFailed'));
    render();
  }

  document.getElementById('refresh').addEventListener('click', function () { refresh(false); });
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
    if (Decimal.parse(rate) == null || Decimal.cmp(rate, '0') <= 0) { SH.toast(SH.t('rateAboveZero')); return; }
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
    if (!window.confirm(SH.t('clearScribbleConfirm'))) return;
    document.getElementById('scratch').value = '';
    render();
  });
  syncManual();
  render();
  refresh(true);
  window.addEventListener('shophelper-lang', render);
})();
