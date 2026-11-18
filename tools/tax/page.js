'use strict';
(function () {
  var Store = window.ShophelperStore;
  var Tax = window.ShophelperTax;
  var Decimal = window.ShophelperDecimal;
  var SH = window.Shophelper;
  var draft = Object.assign({ price: '', currency: SH.homeCurrency(), rate: '10', mode: 'inclusive', fee: '', fixed: '', retailer: '' }, Store.load().drafts.tax || {});
  var price = document.getElementById('price');
  var currency = document.getElementById('currency');
  var rate = document.getElementById('rate');
  var fee = document.getElementById('fee');
  var fixed = document.getElementById('fixed');
  SH.currencySelect(draft.currency).querySelectorAll('option').forEach(function (option) { currency.appendChild(option); });
  price.value = draft.price;
  currency.value = draft.currency;
  rate.value = draft.rate;
  fee.value = draft.fee;
  fixed.value = draft.fixed;
  var mode = draft.mode === 'exclusive' ? 'exclusive' : 'inclusive';

  function paintMode() {
    document.getElementById('modeIn').classList.toggle('on', mode === 'inclusive');
    document.getElementById('modeEx').classList.toggle('on', mode === 'exclusive');
  }

  function render() {
    paintMode();
    Store.update(function (data) {
      data.drafts.tax = { price: price.value, currency: currency.value, rate: rate.value, mode: mode, fee: fee.value, fixed: fixed.value, retailer: draft.retailer || '' };
    });
    var calc = Tax.calculate({ price: price.value, ratePercent: rate.value, mode: mode, currency: currency.value });
    if (!calc) {
      document.getElementById('taxOut').textContent = '—';
      document.getElementById('payOut').textContent = '—';
      document.getElementById('feeOut').textContent = '—';
      document.getElementById('netOut').textContent = '—';
      document.getElementById('worth').textContent = '';
      SH.clearResult('tax-checkout');
      SH.clearResult('tax-refund');
      return;
    }
    document.getElementById('taxOut').textContent = SH.money(calc.tax, calc.currency);
    document.getElementById('payOut').textContent = SH.money(calc.checkout, calc.currency);
    SH.publish({ slot: 'tax-checkout', sourceTool: 'tax', kind: 'money', value: calc.checkout, currency: calc.currency, label: SH.t('checkoutLabel'), calculatedAt: Date.now() });
    if (fee.value.trim() === '') {
      document.getElementById('feeOut').textContent = '—';
      document.getElementById('netOut').textContent = '—';
      document.getElementById('worth').textContent = SH.t('enterFee');
      SH.clearResult('tax-refund');
      return;
    }
    var back = Tax.refund({ tax: calc.tax, feePercent: fee.value, fixedFee: fixed.value, currency: calc.currency });
    if (!back) return;
    document.getElementById('feeOut').textContent = SH.money(back.fee, calc.currency);
    document.getElementById('netOut').textContent = SH.money(back.net, calc.currency);
    var cmp = Decimal.cmp(back.net, '0');
    document.getElementById('worth').textContent = cmp > 0
      ? SH.format('taxWorth', { net: SH.money(back.net, calc.currency), checkout: SH.money(calc.checkout, calc.currency) })
      : SH.t('taxNotWorth');
    SH.publish({ slot: 'tax-refund', sourceTool: 'tax', kind: 'money', value: back.net, currency: calc.currency, label: SH.t('netRefundLabel'), calculatedAt: Date.now() });
  }

  document.getElementById('modeIn').addEventListener('click', function () { mode = 'inclusive'; render(); });
  document.getElementById('modeEx').addEventListener('click', function () { mode = 'exclusive'; render(); });
  [price, currency, rate, fee, fixed].forEach(function (node) { node.addEventListener('input', render); node.addEventListener('change', render); });

  document.getElementById('tabEstimate').addEventListener('click', function () { show('estimate'); });
  document.getElementById('tabTracker').addEventListener('click', function () { show('tracker'); });
  var disposeTabBack = null;
  function show(which) {
    if (disposeTabBack) { disposeTabBack(); disposeTabBack = null; }
    document.getElementById('estimate').hidden = which !== 'estimate';
    document.getElementById('tracker').hidden = which !== 'tracker';
    document.getElementById('tabEstimate').classList.toggle('on', which === 'estimate');
    document.getElementById('tabTracker').classList.toggle('on', which === 'tracker');
    if (which === 'tracker') {
      renderTracker();
      if (SH.pushBack) {
        disposeTabBack = SH.pushBack(function () {
          show('estimate');
          return true;
        });
      }
    }
  }

  document.getElementById('saveRefund').addEventListener('click', function () {
    var calc = Tax.calculate({ price: price.value, ratePercent: rate.value, mode: mode, currency: currency.value });
    var back = calc && fee.value.trim() !== '' ? Tax.refund({ tax: calc.tax, feePercent: fee.value, fixedFee: fixed.value, currency: calc.currency }) : null;
    if (!calc || !back) { SH.toast(SH.t('refundNeedInputs')); return; }
    var retailer = window.prompt(SH.t('shopOrDesc'), draft.retailer || '');
    if (retailer == null) return;
    draft.retailer = retailer;
    Store.update(function (data) {
      data.refunds.push({
        id: SH.uid()('r'),
        retailer: retailer,
        purchaseDate: SH.today(),
        country: '',
        currency: calc.currency,
        paidPrice: calc.checkout,
        taxRate: rate.value,
        taxAmount: calc.tax,
        estimatedNet: back.net,
        feePercent: fee.value,
        fixedFee: fixed.value || '0',
        status: 'expected',
        actualAmount: '',
        receivedDate: ''
      });
    });
    SH.toast(SH.t('refundSaved'));
    show('tracker');
  });

  function renderTracker() {
    var rows = Store.load().refunds;
    var summary = Tax.summarizeRefunds(rows);
    var host = document.getElementById('summary');
    host.innerHTML = '';
    host.appendChild(line(SH.t('stillExpected'), summary.pending));
    host.appendChild(line(SH.t('received'), summary.received));
    var list = document.getElementById('refundList');
    list.innerHTML = '';
    if (!rows.length) {
      list.appendChild(Object.assign(document.createElement('p'), { className: 'sh-note', textContent: SH.t('refundsEmpty') }));
      return;
    }
    rows.slice().reverse().forEach(function (row) {
      var card = document.createElement('article');
      card.className = 'sh-card';
      var title = document.createElement('strong');
      title.textContent = row.retailer || SH.t('refundFallback');
      card.appendChild(title);
      var meta = document.createElement('p');
      meta.className = 'sh-note';
      meta.textContent = row.purchaseDate + ' · ' + SH.t('refundExpectedWord') + ' ' + SH.money(row.estimatedNet, row.currency) + (row.actualAmount ? ' · ' + SH.t('refundReceivedWord') + ' ' + SH.money(row.actualAmount, row.currency) : '');
      card.appendChild(meta);
      var status = document.createElement('select');
      var statusKey = { expected: 'statusExpected', submitted: 'statusSubmitted', received: 'statusReceived', cancelled: 'statusCancelled' };
      ['expected', 'submitted', 'received', 'cancelled'].forEach(function (name) {
        var option = document.createElement('option');
        option.value = name;
        option.textContent = SH.t(statusKey[name]);
        status.appendChild(option);
      });
      status.value = row.status;
      status.addEventListener('change', function () { update(row.id, { status: status.value }); });
      card.appendChild(status);
      if (row.status === 'received') {
        var actual = document.createElement('input');
        actual.inputMode = 'decimal';
        actual.placeholder = SH.t('amountReceived');
        actual.value = row.actualAmount || '';
        actual.addEventListener('change', function () { update(row.id, { actualAmount: actual.value, receivedDate: row.receivedDate || SH.today() }); });
        var when = document.createElement('input');
        when.type = 'date';
        when.value = row.receivedDate || SH.today();
        when.addEventListener('change', function () { update(row.id, { receivedDate: when.value }); });
        card.appendChild(actual);
        card.appendChild(when);
      }
      var remove = document.createElement('button');
      remove.className = 'sh-btn warn';
      remove.type = 'button';
      remove.textContent = SH.t('deleteRefund');
      remove.addEventListener('click', function () {
        if (!window.confirm(SH.t('deleteRefundConfirm'))) return;
        Store.update(function (data) { data.refunds = data.refunds.filter(function (item) { return item.id !== row.id; }); });
        renderTracker();
      });
      card.appendChild(remove);
      list.appendChild(card);
    });
  }

  function line(title, map) {
    var node = document.createElement('p');
    var codes = Object.keys(map);
    node.textContent = title + ': ' + (codes.length ? codes.map(function (code) { return SH.money(map[code], code); }).join(' · ') : '—');
    return node;
  }

  function update(id, patch) {
    Store.update(function (data) {
      data.refunds.forEach(function (row) { if (row.id === id) Object.assign(row, patch); });
    });
    renderTracker();
  }

  window.addEventListener('shophelper-lang', function () {
    render();
    renderTracker();
  });
  render();
})();
