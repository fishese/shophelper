'use strict';

(function () {
  var Store = window.ShophelperStore;
  var Decimal = window.ShophelperDecimal;
  var Units = window.ShophelperUnits;
  var Prices = window.ShophelperPrices;
  var Results = window.ShophelperResults;
  var Rates = window.ShophelperRates;
  var Tax = window.ShophelperTax;
  var I18n = window.ShophelperI18n;

  var SYMBOLS = { HKD: 'HK$', USD: 'US$', EUR: '€', GBP: '£', JPY: '¥', CNY: 'CN¥', TWD: 'NT$', KRW: '₩', SGD: 'S$', MOP: 'MOP$', AUD: 'A$', CAD: 'C$', THB: '฿' };
  var lastField = null;
  var undo = null;
  var barOpen = false;
  var dialogCloser = null;

  function homeCurrency() {
    return (Store.load().settings.homeCurrency || 'HKD').toUpperCase();
  }

  function money(amount, currency) {
    var code = String(currency || homeCurrency()).toUpperCase();
    var places = Tax.places(code);
    var rounded = Decimal.round(String(amount), places);
    if (rounded == null) return '';
    var body = places === 0 ? rounded : (function () {
      var bits = rounded.split('.');
      return bits[0] + '.' + (bits[1] || '').padEnd(places, '0');
    })();
    return (SYMBOLS[code] || (code + ' ')) + body;
  }

  function quantity(amount, unit) {
    return Decimal.format(Decimal.parse(amount)) + ' ' + unit;
  }

  function labelOf(result) {
    if (result.kind === 'money') return money(result.value, result.currency);
    if (result.unit) return quantity(result.value, result.unit);
    return String(result.value);
  }

  function rootPath() {
    return document.documentElement.getAttribute('data-sh-root') || '.';
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function toast(message) {
    var node = document.querySelector('.sh-toast');
    if (!node) {
      node = el('div', 'sh-status sh-toast');
      node.setAttribute('role', 'status');
      node.style.position = 'fixed';
      node.style.left = '16px';
      node.style.right = '16px';
      node.style.bottom = 'calc(6.4rem + env(safe-area-inset-bottom))';
      node.style.background = 'var(--sh-ink)';
      node.style.color = 'var(--sh-bg)';
      node.style.padding = '10px 12px';
      node.style.borderRadius = '12px';
      node.style.zIndex = '75';
      document.body.appendChild(node);
    }
    node.textContent = message;
    clearTimeout(node._t);
    node._t = setTimeout(function () { node.remove(); }, 2200);
  }

  function currentLang() {
    return I18n ? I18n.normalize(Store.load().settings.lang || 'en') : 'en';
  }

  function t(key) {
    return I18n ? I18n.t(currentLang(), key) : key;
  }

  function applyTheme() {
    var theme = Store.load().settings.theme || 'dark';
    var dark = theme !== 'light';
    document.documentElement.dataset.shTheme = dark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    var meta = document.querySelector('meta[name="theme-color"]') || document.getElementById('themeColor');
    if (meta) meta.setAttribute('content', dark ? '#000000' : '#f4f4f5');
    var btn = document.getElementById('shThemeToggle');
    if (btn) {
      btn.setAttribute('aria-label', dark ? t('themeLight') : t('themeDark'));
      btn.title = dark ? t('themeLight') : t('themeDark');
      var moon = btn.querySelector('[data-icon="moon"]');
      var sun = btn.querySelector('[data-icon="sun"]');
      if (moon) moon.style.display = dark ? 'none' : 'block';
      if (sun) sun.style.display = dark ? 'block' : 'none';
    }
  }

  function setTheme(theme) {
    Store.update(function (data) { data.settings.theme = theme === 'light' ? 'light' : 'dark'; });
    applyTheme();
    window.dispatchEvent(new CustomEvent('shophelper-theme'));
  }

  function setLang(lang) {
    var next = I18n ? I18n.normalize(lang) : 'en';
    Store.update(function (data) { data.settings.lang = next; });
    document.documentElement.lang = next === 'zh' ? 'zh-Hant' : 'en';
    paintLangSeg();
    try { localStorage.setItem('sdc_lang', next === 'zh' ? 'zh-HK' : 'en'); } catch (err) {}
    window.dispatchEvent(new CustomEvent('shophelper-lang', { detail: { lang: next } }));
  }

  function paintLangSeg() {
    var lang = currentLang();
    document.querySelectorAll('.sh-langseg button[data-lang]').forEach(function (btn) {
      btn.classList.toggle('on', btn.getAttribute('data-lang') === lang);
    });
    var back = document.querySelector('.sh-back');
    if (back) back.textContent = t('home');
    applyTheme();
  }

  function themeIcons() {
    return ''
      + '<svg data-icon="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'
      + '<svg data-icon="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:none"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  }

  function fieldCurrency(field) {
    if (!field) return homeCurrency();
    var selectId = field.getAttribute('data-sh-currency-select');
    if (selectId) {
      var select = document.getElementById(selectId);
      if (select && select.value) return select.value.toUpperCase();
    }
    return (field.getAttribute('data-sh-currency') || homeCurrency()).toUpperCase();
  }

  function fieldUnit(field) {
    var selectId = field && field.getAttribute('data-sh-unit-select');
    if (selectId) {
      var select = document.getElementById(selectId);
      if (select && select.value) return select.value;
    }
    return field ? (field.getAttribute('data-sh-unit') || '') : '';
  }

  function describeField(field) {
    var kind = field.getAttribute('data-sh-kind');
    if (kind === 'money') return { kind: 'money', currency: fieldCurrency(field) };
    return { kind: kind, unit: fieldUnit(field) };
  }

  function rateBetween(from, to) {
    var data = Store.load();
    var quoted = Rates.quote(data.rates, from, to);
    if (!quoted) return null;
    return { rate: quoted.rate, rateAsOf: quoted.asOf, rateSource: quoted.manual ? 'manual' : (quoted.source || 'cached') };
  }

  function destination() {
    var active = document.activeElement;
    if (active && active.matches && active.matches('[data-sh-kind]')) return active;
    if (lastField && lastField.isConnected) return lastField;
    return null;
  }

  function setStatus(text) {
    var node = document.querySelector('.sh-status');
    if (node && !node.classList.contains('sh-toast')) node.textContent = text || '';
  }

  function rememberUndo(field, previous) {
    undo = { field: field, previous: previous };
    renderBar();
  }

  function writeField(field, value) {
    var previous = field.value;
    if (typeof field.selectionStart === 'number' && field.type !== 'number') {
      var start = field.selectionStart;
      var end = field.selectionEnd;
      field.value = previous.slice(0, start) + value + previous.slice(end);
      var pos = start + String(value).length;
      try { field.setSelectionRange(pos, pos); } catch (err) {}
    } else {
      field.value = value;
    }
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    rememberUndo(field, previous);
  }

  function insertResult(result) {
    var field = destination();
    if (!field) {
      setStatus(t('tapAmountFirst'));
      return;
    }
    var quoted = result.kind === 'money' ? rateBetween(result.currency, fieldCurrency(field)) : null;
    var plan = Results.insertionPlan(result, describeField(field), quoted || {});
    if (plan.action === 'insert') {
      writeField(field, plan.value);
      setStatus('Inserted ' + (plan.currency ? money(plan.value, plan.currency) : (plan.value + (plan.unit ? ' ' + plan.unit : ''))));
      return;
    }
    if (plan.action === 'refuse') {
      setStatus(plan.reason === 'kind' ? t('resultNoFit') : t('unitsNoConvert'));
      return;
    }
    openCurrencyChoice(result, field, plan);
  }

  function openCurrencyChoice(result, field, plan) {
    openDialog({
      title: t('currencyMismatch'),
      render: function (panel, close) {
        panel.appendChild(el('p', 'sh-note', result.currency + ' ' + result.value + ' is not ' + plan.to + '. It will not be pasted as ' + plan.to + ' ' + result.value + '.'));
        var actions = el('div', 'sh-actions');
        if (plan.converted) {
          var convert = el('button', 'sh-btn primary', 'Convert to ' + money(plan.converted.value, plan.converted.currency));
          convert.type = 'button';
          var source = plan.converted.rateSource === 'manual' ? 'Manual rate' : 'Cached rate';
          panel.appendChild(el('p', 'sh-note', source + ' · 1 ' + plan.from + ' = ' + plan.converted.rate + ' ' + plan.to + (plan.converted.rateAsOf ? ' · as of ' + plan.converted.rateAsOf : '')));
          convert.addEventListener('click', function () {
            writeField(field, plan.converted.value);
            close();
            setStatus('Converted and inserted.');
          });
          actions.appendChild(convert);
        } else {
          panel.appendChild(el('p', 'sh-note', 'No cached rate for this pair. Open Currency once while online, or type a manual rate there.'));
        }
        var useCode = el('button', 'sh-btn', 'Use ' + result.currency + ' for this box');
        useCode.type = 'button';
        useCode.addEventListener('click', function () {
          var selectId = field.getAttribute('data-sh-currency-select');
          var select = selectId && document.getElementById(selectId);
          if (select) {
            select.value = result.currency;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            field.setAttribute('data-sh-currency', result.currency);
            writeField(field, result.value);
            close();
            return;
          }
          setStatus('This box cannot change currency. Convert it first.');
        });
        var cancel = el('button', 'sh-btn', 'Cancel');
        cancel.type = 'button';
        cancel.addEventListener('click', close);
        actions.appendChild(useCode);
        actions.appendChild(cancel);
        panel.appendChild(actions);
      }
    });
  }

  function renderBar() {
    var bar = document.querySelector('.sh-bar');
    if (!bar) return;
    bar.innerHTML = '';
    var items = Results.list(Store.load().results).sort(function (a, b) { return b.calculatedAt - a.calculatedAt; });
    var compact = typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 420px)').matches;
    var shown = compact ? 2 : 3;
    if (barOpen && items.length > shown) {
      var full = el('div', 'sh-expanded');
      items.forEach(function (item) { full.appendChild(chip(item)); });
      bar.appendChild(full);
    }
    var row = el('div', 'sh-bar-row');
    items.slice(0, shown).forEach(function (item) { row.appendChild(chip(item)); });
    if (!items.length) {
      var empty = el('div', 'sh-status', t('resultsEmpty'));
      row.appendChild(empty);
    }
    if (items.length > shown) {
      var more = el('button', 'sh-btn sh-more', barOpen ? t('less') : t('all'));
      more.type = 'button';
      more.addEventListener('click', function () {
        barOpen = !barOpen;
        document.body.classList.toggle('sh-bar-open', barOpen);
        renderBar();
      });
      row.appendChild(more);
    }
    if (undo && undo.field && undo.field.isConnected) {
      var back = el('button', 'sh-btn', t('undo'));
      back.type = 'button';
      back.addEventListener('click', function () {
        undo.field.value = undo.previous;
        undo.field.dispatchEvent(new Event('input', { bubbles: true }));
        undo = null;
        renderBar();
      });
      row.appendChild(back);
    }
    bar.appendChild(row);
    var status = el('div', 'sh-status', '');
    bar.appendChild(status);
  }

  function chip(item) {
    var button = el('button', 'sh-chip');
    button.type = 'button';
    button.appendChild(el('b', '', item.label));
    button.appendChild(el('span', '', labelOf(item)));
    button.addEventListener('mousedown', function (event) { event.preventDefault(); });
    button.addEventListener('click', function () { insertResult(item); });
    return button;
  }

  function closeDialog() {
    if (dialogCloser) dialogCloser();
  }

  function openDialog(opts) {
    closeDialog();
    var wrap = el('div', 'sh-dialog');
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    var panel = el('div', 'sh-panel');
    panel.appendChild(el('h3', '', opts.title || ''));
    wrap.appendChild(panel);
    function close() {
      wrap.remove();
      dialogCloser = null;
    }
    dialogCloser = close;
    wrap.addEventListener('click', function (event) { if (event.target === wrap) close(); });
    document.body.appendChild(wrap);
    opts.render(panel, close);
    var focusable = panel.querySelector('input, button, select, textarea');
    if (focusable) focusable.focus();
    return close;
  }

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function uidFactory() {
    var n = 0;
    return function (prefix) { n += 1; return prefix + '-' + Date.now().toString(36) + '-' + n; };
  }

  function fieldInput(label, value, attrs) {
    var wrap = el('label', '');
    wrap.appendChild(el('span', 'sh-label', label));
    var input = document.createElement(attrs && attrs.multiline ? 'textarea' : 'input');
    input.className = 'sh-input';
    input.value = value == null ? '' : value;
    if (!attrs || !attrs.multiline) input.type = (attrs && attrs.type) || 'text';
    return { wrap: wrap, input: input };
  }

  function currencySelect(selected) {
    var select = document.createElement('select');
    ['HKD', 'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'TWD', 'KRW', 'SGD', 'AUD', 'CAD', 'CHF', 'THB', 'MYR', 'PHP', 'VND', 'IDR', 'NZD', 'MOP', 'INR'].forEach(function (code) {
      var option = document.createElement('option');
      option.value = code;
      option.textContent = code;
      if (code === selected) option.selected = true;
      select.appendChild(option);
    });
    return select;
  }

  function unitSelect(selected) {
    var select = document.createElement('select');
    var blank = document.createElement('option');
    blank.value = '';
    blank.textContent = 'No pack size';
    select.appendChild(blank);
    Units.categories().forEach(function (cat) {
      if (cat.id === 'temperature' || cat.id === 'area') return;
      cat.units.forEach(function (unit) {
        var option = document.createElement('option');
        option.value = unit;
        option.textContent = unit;
        if (unit === selected) option.selected = true;
        select.appendChild(option);
      });
    });
    var pcs = document.createElement('option');
    pcs.value = 'pcs';
    pcs.textContent = 'pcs';
    if (selected === 'pcs') pcs.selected = true;
    select.appendChild(pcs);
    return select;
  }

  function readPriceForm(form) {
    return {
      name: form.name.value,
      brand: form.brand.value,
      price: form.price.value,
      currency: form.currency.value,
      packQty: form.packQty.value,
      packUnit: form.packUnit.value,
      shop: form.shop.value,
      date: form.date.value || today(),
      source: form.source.value || 'manual',
      promo: form.promo.checked
    };
  }

  function commitPrice(decision, choice, incoming) {
    var outcome = null;
    Store.update(function (data) {
      outcome = Prices.apply({ products: data.products, observations: data.observations }, decision, choice, incoming, { now: Date.now(), id: uidFactory() });
      data.products = outcome.state.products;
      data.observations = outcome.state.observations;
    });
    if (outcome && outcome.duplicate) toast('Already saved for that shop and date.');
    else if (outcome && outcome.wrote) toast('Price saved.');
    else toast('Nothing saved.');
    return outcome;
  }

  function openPriceSave(prefill) {
    var seed = Object.assign({
      name: '', brand: '', price: '', currency: homeCurrency(), packQty: '', packUnit: '',
      shop: '', date: today(), source: 'manual', promo: false
    }, prefill || {});
    openDialog({
      title: 'Save to Prices',
      render: function (panel, close) {
        var form = document.createElement('form');
        function add(node) { form.appendChild(node.wrap); node.wrap.appendChild(node.input); return node.input; }
        var name = add(fieldInput('Product', seed.name));
        var brand = add(fieldInput('Brand or variant', seed.brand));
        var price = add(fieldInput('Price', seed.price, { type: 'text' }));
        price.setAttribute('inputmode', 'decimal');
        price.setAttribute('data-sh-kind', 'money');
        price.setAttribute('data-sh-currency-select', 'sh-save-currency');
        var currencyWrap = el('label', '');
        currencyWrap.appendChild(el('span', 'sh-label', 'Currency'));
        var currency = currencySelect(seed.currency);
        currency.id = 'sh-save-currency';
        currencyWrap.appendChild(currency);
        form.appendChild(currencyWrap);
        var packQty = add(fieldInput('Pack size', seed.packQty, { type: 'text' }));
        packQty.setAttribute('inputmode', 'decimal');
        var unitWrap = el('label', '');
        unitWrap.appendChild(el('span', 'sh-label', 'Unit'));
        var packUnit = unitSelect(seed.packUnit);
        unitWrap.appendChild(packUnit);
        form.appendChild(unitWrap);
        var shop = add(fieldInput('Shop', seed.shop));
        var date = add(fieldInput('Date seen', seed.date, { type: 'date' }));
        var promoWrap = el('label', 'sh-check');
        var promo = document.createElement('input');
        promo.type = 'checkbox';
        promo.checked = !!seed.promo;
        promoWrap.appendChild(promo);
        promoWrap.appendChild(document.createTextNode('Promotional or clearance price'));
        form.appendChild(promoWrap);
        var source = document.createElement('input');
        source.type = 'hidden';
        source.value = seed.source;
        form.appendChild(source);
        var fields = {
          name: name, brand: brand, price: price, currency: currency, packQty: packQty,
          packUnit: packUnit, shop: shop, date: date, promo: promo, source: source
        };

        var picker = el('div', 'sh-list');
        form.appendChild(el('span', 'sh-label', 'Save onto'));
        var createBtn = el('button', 'sh-btn primary', 'New product');
        createBtn.type = 'button';
        picker.appendChild(createBtn);
        var search = document.createElement('input');
        search.type = 'search';
        search.placeholder = 'Find a saved product';
        search.className = 'sh-input';
        form.appendChild(search);
        form.appendChild(picker);

        function products() {
          var q = search.value.trim().toLowerCase();
          return Store.load().products.filter(function (product) {
            return !q || (product.name + ' ' + (product.brand || '')).toLowerCase().indexOf(q) !== -1;
          });
        }
        function drawProducts() {
          picker.innerHTML = '';
          picker.appendChild(createBtn);
          products().forEach(function (product) {
            var card = Prices.card({ products: Store.load().products, observations: Store.load().observations }, product.id);
            var button = el('button', 'sh-btn', product.name + (card && card.usual ? ' · usual ' + money(card.usual.price, card.usual.currency) : ''));
            button.type = 'button';
            button.addEventListener('click', function () { choose(product.id); });
            picker.appendChild(button);
          });
        }
        function incoming() {
          var value = readPriceForm(fields);
          if (!value.name.trim()) { name.focus(); toast('Add a product name.'); return null; }
          if (Decimal.parse(value.price) == null) { price.focus(); toast('Enter a price.'); return null; }
          return value;
        }
        function choose(productId) {
          var value = incoming();
          if (!value) return;
          var state = Store.load();
          var decision = Prices.decide({ products: state.products, observations: state.observations }, productId, value);
          if (!productId || decision.kind === 'create') {
            commitPrice(decision.kind === 'create' ? decision : { kind: 'create' }, 'create', value);
            close();
            return;
          }
          if (decision.kind === 'immediate') {
            commitPrice(decision, 'accept', value);
            close();
            return;
          }
          showChoice(decision, value);
        }
        function showChoice(decision, value) {
          picker.innerHTML = '';
          if (decision.kind === 'price-diff') {
            picker.appendChild(el('div', 'sh-diff', money(value.price, value.currency) + ' is ' + decision.direction + ' than usual by ' + money(decision.delta, decision.currency) + '.'));
            addChoice('Update last seen only', 'last-seen');
            addChoice('Update usual too', 'usual');
          } else {
            var why = decision.reason === 'currency'
              ? 'This price is in a different currency. Usual and best stay in their original currency.'
              : 'This pack size is different, so it is not compared with the package price.';
            picker.appendChild(el('div', 'sh-diff', why));
            addChoice('Update last seen only', 'last-seen');
            addChoice('Save as a separate variant', 'variant');
          }
          var cancel = el('button', 'sh-btn', 'Cancel');
          cancel.type = 'button';
          cancel.addEventListener('click', close);
          picker.appendChild(cancel);
          function addChoice(label, choice) {
            var button = el('button', 'sh-btn primary', label);
            button.type = 'button';
            button.addEventListener('click', function () {
              var latest = incoming();
              if (!latest) return;
              commitPrice(decision, choice, latest);
              close();
            });
            picker.appendChild(button);
          }
        }
        createBtn.addEventListener('click', function () { choose(null); });
        search.addEventListener('input', drawProducts);
        drawProducts();
        panel.appendChild(form);
      }
    });
  }

  function publish(result) {
    Store.update(function (data) { Results.publish(data.results, result); });
  }

  function clearResult(slot) {
    Store.update(function (data) { Results.removeSlot(data.results, slot); });
  }

  function mount(opts) {
    opts = opts || {};
    document.body.classList.add('sh-framed');
    if (opts.home) document.body.classList.add('sh-home');
    var existing = document.querySelector('.sh-head');
    if (existing && !existing.querySelector('.sh-head-tools')) existing.remove();
    if (!document.querySelector('.sh-head')) {
      var head = el('header', 'sh-head');
      var main = el('div', 'sh-head-main');
      if (!opts.home) {
        var back = el('a', 'sh-back', t('home'));
        back.href = rootPath() + '/index.html';
        main.appendChild(back);
      }
      main.appendChild(el('h1', 'sh-title', opts.title || document.documentElement.dataset.shTitle || 'Shophelper'));
      head.appendChild(main);
      var tools = el('div', 'sh-head-tools');
      var langSeg = el('div', 'sh-langseg');
      langSeg.setAttribute('role', 'group');
      langSeg.setAttribute('aria-label', t('lang'));
      [['en', 'EN'], ['zh', '繁']].forEach(function (pair) {
        var btn = el('button', '', pair[1]);
        btn.type = 'button';
        btn.setAttribute('data-lang', pair[0]);
        btn.addEventListener('click', function () { setLang(pair[0]); });
        langSeg.appendChild(btn);
      });
      tools.appendChild(langSeg);
      var themeBtn = el('button', 'sh-iconbtn');
      themeBtn.type = 'button';
      themeBtn.id = 'shThemeToggle';
      themeBtn.innerHTML = themeIcons();
      themeBtn.addEventListener('click', function () {
        setTheme(document.documentElement.dataset.shTheme === 'dark' ? 'light' : 'dark');
      });
      tools.appendChild(themeBtn);
      head.appendChild(tools);
      document.body.insertBefore(head, document.body.firstChild);
    }
    applyTheme();
    paintLangSeg();
    applyPageI18n();
    if (!document.querySelector('.sh-bar')) document.body.appendChild(el('div', 'sh-bar'));
    renderBar();
  }

  document.addEventListener('focusin', function (event) {
    if (event.target.matches && event.target.matches('[data-sh-kind]')) lastField = event.target;
    var typing = event.target.matches && event.target.matches('input, textarea, select') && !event.target.closest('.sh-bar') && !event.target.closest('.sh-dialog');
    document.body.classList.toggle('sh-keyboard', !!typing);
    if (typing && event.target.scrollIntoView) {
      setTimeout(function () { event.target.scrollIntoView({ block: 'center', inline: 'nearest' }); }, 50);
    }
  });
  document.addEventListener('focusout', function () {
    setTimeout(function () {
      var active = document.activeElement;
      var typing = active && active.matches && active.matches('input, textarea, select') && !active.closest('.sh-bar');
      document.body.classList.toggle('sh-keyboard', !!typing);
    }, 80);
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeDialog();
  });
  window.addEventListener('shophelper-change', renderBar);

  function applyPageI18n() {
    document.querySelectorAll('[data-i18n]').forEach(function (node) {
      var key = node.getAttribute('data-i18n');
      if (!key) return;
      var value = t(key);
      if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') {
        if (node.getAttribute('placeholder') != null) node.setAttribute('placeholder', value);
      } else {
        node.textContent = value;
      }
    });
    paintLangSeg();
  }
  window.addEventListener('shophelper-lang', applyPageI18n);

  // Android shortcuts: MainActivity may leave a tool path to open (Capacitor https://localhost/...).
  function honorLaunchPath() {
    try {
      var launch = localStorage.getItem('shophelper_launch_path');
      if (!launch) return false;
      localStorage.removeItem('shophelper_launch_path');
      if (launch.indexOf('/tools/') !== 0 || launch.indexOf('..') !== -1) return false;
      if (window.location.pathname.indexOf(launch) !== -1) return false;
      window.location.replace(window.location.origin + launch);
      return true;
    } catch (err) {
      return false;
    }
  }

  function boot() {
    if (honorLaunchPath()) return;
    if (document.documentElement.dataset.shAuto !== '1') return;
    mount({
      title: document.documentElement.dataset.shTitle || 'Shophelper',
      home: document.documentElement.dataset.shHome === '1'
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.Shophelper = {
    mount: mount,
    publish: publish,
    clearResult: clearResult,
    openPriceSave: openPriceSave,
    openDialog: openDialog,
    toast: toast,
    money: money,
    homeCurrency: homeCurrency,
    applyTheme: applyTheme,
    setTheme: setTheme,
    setLang: setLang,
    lang: currentLang,
    t: t,
    applyPageI18n: applyPageI18n,
    today: today,
    currencySelect: currencySelect,
    uid: uidFactory
  };
})();
