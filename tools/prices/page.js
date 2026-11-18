'use strict';
(function () {
  var Store = window.ShophelperStore;
  var Prices = window.ShophelperPrices;
  var SH = window.Shophelper;
  var list = document.getElementById('list');
  var detail = document.getElementById('detail');
  var query = document.getElementById('q');

  function state() { return Store.load(); }

  function packText(obs) {
    if (!obs || !obs.packQty) return '';
    return obs.packQty + ' ' + (obs.packUnit || '');
  }

  var openId = null;
  var disposeDetailBack = null;
  function clearDetailBack() {
    if (disposeDetailBack) { disposeDetailBack(); disposeDetailBack = null; }
  }
  function renderList() {
    clearDetailBack();
    openId = null;
    list.innerHTML = '';
    detail.hidden = true;
    var q = query.value.trim().toLowerCase();
    var data = state();
    var products = data.products.filter(function (product) {
      var card = Prices.card(data, product.id);
      var shop = card && card.last && card.last.shop || '';
      var blob = (product.name + ' ' + (product.brand || '') + ' ' + shop).toLowerCase();
      return !q || blob.indexOf(q) !== -1;
    });
    if (!products.length) {
      list.appendChild(Object.assign(document.createElement('p'), { className: 'sh-note', textContent: SH.t('pricesEmpty') }));
      return;
    }
    products.forEach(function (product) {
      var card = Prices.card(data, product.id);
      var article = document.createElement('article');
      article.className = 'sh-card';
      var title = document.createElement('strong');
      title.textContent = product.name + (product.brand ? ' · ' + product.brand : '') + (packText(card.usual) ? ' · ' + packText(card.usual) : '');
      article.appendChild(title);
      var row = document.createElement('p');
      row.textContent = SH.t('pricesUsual') + ' ' + SH.money(card.usual.price, card.usual.currency)
        + '    ' + SH.t('pricesBest') + ' ' + SH.money(card.best.price, card.best.currency)
        + '    ' + SH.t('pricesLast') + ' ' + SH.money(card.last.price, card.last.currency);
      article.appendChild(row);
      var where = document.createElement('p');
      where.className = 'sh-note';
      where.textContent = (card.last.shop || SH.t('shopNotSet')) + ' · ' + (card.last.date || '');
      article.appendChild(where);
      var open = document.createElement('button');
      open.className = 'sh-btn';
      open.type = 'button';
      open.textContent = SH.t('history');
      open.addEventListener('click', function () { renderDetail(product.id); });
      article.appendChild(open);
      list.appendChild(article);
    });
  }

  function renderDetail(id) {
    clearDetailBack();
    openId = id;
    list.innerHTML = '';
    detail.hidden = false;
    detail.innerHTML = '';
    var data = state();
    var card = Prices.card(data, id);
    if (!card) { renderList(); return; }
    if (SH.pushBack) {
      disposeDetailBack = SH.pushBack(function () {
        renderList();
        return true;
      });
    }
    var back = document.createElement('button');
    back.className = 'sh-btn';
    back.type = 'button';
    back.textContent = SH.t('allProducts');
    back.addEventListener('click', renderList);
    detail.appendChild(back);
    var title = document.createElement('h2');
    title.textContent = card.product.name;
    detail.appendChild(title);
    card.history.forEach(function (obs) {
      var row = document.createElement('div');
      row.className = 'sh-line';
      var text = document.createElement('em');
      text.textContent = obs.date + ' · ' + (obs.shop || 'No shop') + ' · ' + obs.source + (obs.promo ? ' · promo' : '');
      var value = document.createElement('span');
      value.textContent = SH.money(obs.price, obs.currency);
      row.appendChild(text);
      row.appendChild(value);
      var mark = document.createElement('button');
      mark.className = 'sh-btn';
      mark.type = 'button';
      mark.textContent = card.usual && card.usual.id === obs.id ? 'Usual' : 'Mark usual';
      mark.disabled = card.usual && card.usual.id === obs.id;
      mark.addEventListener('click', function () {
        Store.update(function (current) {
          var next = Prices.markUsual(current, id, obs.id);
          current.products = next.products;
        });
        renderDetail(id);
      });
      detail.appendChild(row);
      detail.appendChild(mark);
    });
    var add = document.createElement('button');
    add.className = 'sh-btn primary';
    add.type = 'button';
    add.textContent = SH.t('addPrice');
    add.addEventListener('click', function () {
      SH.openPriceSave({
        name: card.product.name,
        brand: card.product.brand,
        currency: card.usual.currency,
        packQty: card.product.packQty,
        packUnit: card.product.packUnit,
        source: 'manual'
      });
    });
    var remove = document.createElement('button');
    remove.className = 'sh-btn warn';
    remove.type = 'button';
    remove.textContent = SH.t('deleteProduct');
    remove.addEventListener('click', function () {
      if (!window.confirm(SH.t('confirmDeleteProduct'))) return;
      Store.update(function (current) {
        current.products = current.products.filter(function (product) { return product.id !== id; });
        current.observations = current.observations.filter(function (obs) { return obs.productId !== id; });
      });
      renderList();
    });
    var actions = document.createElement('div');
    actions.className = 'sh-actions';
    actions.appendChild(add);
    actions.appendChild(remove);
    detail.appendChild(actions);
  }

  document.getElementById('add').addEventListener('click', function () { SH.openPriceSave({ source: 'manual' }); });
  query.addEventListener('input', function () { if (detail.hidden) renderList(); });
  window.addEventListener('shophelper-change', function () {
    if (openId) renderDetail(openId);
    else renderList();
  });
  window.addEventListener('shophelper-lang', function () {
    if (openId) renderDetail(openId);
    else renderList();
  });
  renderList();
})();
