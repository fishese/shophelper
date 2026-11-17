'use strict';
(function () {
  var ListStore = window.ShophelperListStore;
  var SH = window.Shophelper;

  var els = {
    form: document.getElementById('addForm'),
    title: document.getElementById('title'),
    qty: document.getElementById('qty'),
    asStaple: document.getElementById('asStaple'),
    hints: document.getElementById('stapleHints'),
    toBuy: document.getElementById('toBuy'),
    checked: document.getElementById('checked'),
    staples: document.getElementById('staples'),
    finish: document.getElementById('finishTrip'),
    shareBtn: document.getElementById('shareBtn'),
    importBtn: document.getElementById('importBtn'),
    shareDialog: document.getElementById('shareDialog'),
    importDialog: document.getElementById('importDialog')
  };

  function t(key) { return SH && SH.t ? SH.t(key) : key; }
  function toast(msg) { if (SH && SH.toast) SH.toast(msg); }

  function bySort(a, b) { return (Number(a.sort) || 0) - (Number(b.sort) || 0); }

  function sections() {
    var list = ListStore.activeList();
    var items = list.items || [];
    return {
      toBuy: items.filter(function (i) { return i.isActive && !i.isChecked; }).sort(bySort),
      checked: items.filter(function (i) { return i.isActive && i.isChecked; }).sort(bySort),
      staples: items.filter(function (i) { return !i.isActive && i.isRecurring; }).sort(bySort)
    };
  }

  /* ---------- reorder (drag and drop) ---------- */

  // Rewrite `sort` for one section: reuse the section's existing sort values in the new order.
  function reorderSection(sectionKey, orderedIds) {
    var doc = ListStore.load();
    var list = doc.lists.filter(function (l) { return l.id === doc.activeListId; })[0] || doc.lists[0];
    var wantChecked = sectionKey === 'checked';
    var peers = list.items.filter(function (i) { return i.isActive && !!i.isChecked === wantChecked; });
    var slots = peers.map(function (i) { return Number(i.sort) || 0; }).sort(function (a, b) { return a - b; });
    var byId = {};
    peers.forEach(function (i) { byId[i.id] = i; });
    var n = 0;
    orderedIds.forEach(function (id) {
      if (byId[id] && n < slots.length) { byId[id].sort = slots[n++]; }
    });
    ListStore.save(doc);
  }

  var drag = null; // { id, section }

  function clearDropMarks() {
    document.querySelectorAll('.drop-before, .drop-after, .is-dragging').forEach(function (n) {
      n.classList.remove('drop-before', 'drop-after', 'is-dragging');
    });
  }

  function wireDnD(li, ul, sectionKey, item) {
    li.draggable = true;
    li.addEventListener('dragstart', function (e) {
      drag = { id: item.id, section: sectionKey };
      li.classList.add('is-dragging');
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', item.id); } catch (err) {}
      }
    });
    li.addEventListener('dragend', function () { drag = null; clearDropMarks(); });
    li.addEventListener('dragover', function (e) {
      if (!drag || drag.section !== sectionKey || drag.id === item.id) return;
      e.preventDefault();
      var rect = li.getBoundingClientRect();
      var after = e.clientY > rect.top + rect.height / 2;
      li.classList.toggle('drop-after', after);
      li.classList.toggle('drop-before', !after);
    });
    li.addEventListener('dragleave', function () { li.classList.remove('drop-before', 'drop-after'); });
    li.addEventListener('drop', function (e) {
      if (!drag || drag.section !== sectionKey || drag.id === item.id) return;
      e.preventDefault();
      var after = li.classList.contains('drop-after');
      var dragId = drag.id;
      drag = null;
      clearDropMarks();
      var ids = Array.prototype.map.call(ul.children, function (n) { return n.getAttribute('data-id'); })
        .filter(function (id) { return id !== dragId; });
      var at = ids.indexOf(item.id);
      ids.splice(at + (after ? 1 : 0), 0, dragId);
      reorderSection(sectionKey, ids);
      render();
    });
  }

  /* ---------- rendering ---------- */

  function iconButton(label, text, onClick, extra) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'list-icon-btn';
    btn.textContent = text;
    btn.setAttribute('aria-label', label);
    btn.title = label;
    if (extra && extra.disabled) btn.disabled = true;
    if (extra && extra.pressed != null) btn.setAttribute('aria-pressed', extra.pressed ? 'true' : 'false');
    btn.addEventListener('click', onClick);
    return btn;
  }

  function rowFor(item, ul, sectionKey, index, count) {
    var li = document.createElement('li');
    li.className = 'list-row' + (item.isChecked ? ' is-checked' : '');
    li.setAttribute('data-id', item.id);

    var handle = document.createElement('span');
    handle.className = 'list-handle';
    handle.textContent = '\u22EE\u22EE';
    handle.setAttribute('aria-hidden', 'true');
    li.appendChild(handle);

    var box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = !!item.isChecked;
    box.setAttribute('aria-label', item.title);
    box.addEventListener('change', function () {
      ListStore.toggleChecked(item.id, box.checked);
      render();
    });
    li.appendChild(box);

    var text = document.createElement('span');
    text.className = 'list-text';
    var title = document.createElement('span');
    title.className = 'list-title';
    title.textContent = item.title;
    text.appendChild(title);
    if (item.quantity) {
      var qty = document.createElement('span');
      qty.className = 'list-qty';
      qty.textContent = '\u00D7 ' + item.quantity;
      text.appendChild(qty);
    }
    li.appendChild(text);

    li.appendChild(iconButton(t('listStapleToggle'), item.isRecurring ? '\u2605' : '\u2606', function () {
      ListStore.setRecurring(item.id, !item.isRecurring);
      render();
    }, { pressed: !!item.isRecurring }));
    li.appendChild(iconButton(t('listMoveUp'), '\u2191', function () {
      ListStore.moveItem(item.id, -1);
      render();
    }, { disabled: index === 0 }));
    li.appendChild(iconButton(t('listMoveDown'), '\u2193', function () {
      ListStore.moveItem(item.id, 1);
      render();
    }, { disabled: index === count - 1 }));
    li.appendChild(iconButton(t('listRemove'), '\u00D7', function () {
      ListStore.removeItem(item.id);
      render();
    }));

    wireDnD(li, ul, sectionKey, item);
    return li;
  }

  function fillRows(ul, items, sectionKey, emptyKey) {
    ul.innerHTML = '';
    if (!items.length) {
      var empty = document.createElement('li');
      empty.className = 'sh-note';
      empty.textContent = t(emptyKey);
      ul.appendChild(empty);
      return;
    }
    items.forEach(function (item, i) {
      ul.appendChild(rowFor(item, ul, sectionKey, i, items.length));
    });
  }

  function renderStaples(idle) {
    els.staples.innerHTML = '';
    if (!idle.length) {
      var empty = document.createElement('p');
      empty.className = 'sh-note';
      empty.textContent = t('listEmptyStaples');
      els.staples.appendChild(empty);
      return;
    }
    idle.forEach(function (item) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'staple-chip';
      chip.textContent = item.title + (item.quantity ? ' \u00D7 ' + item.quantity : '');
      chip.addEventListener('click', function () {
        ListStore.activateStaple(item.id);
        render();
      });
      els.staples.appendChild(chip);
    });
  }

  function renderHints(all) {
    els.hints.innerHTML = '';
    var seen = {};
    all.forEach(function (item) {
      var key = ListStore.normalizeTitle(item.title);
      if (!key || seen[key]) return;
      seen[key] = true;
      var opt = document.createElement('option');
      opt.value = item.title;
      els.hints.appendChild(opt);
    });
  }

  function render() {
    var s = sections();
    fillRows(els.toBuy, s.toBuy, 'toBuy', 'listEmptyToBuy');
    fillRows(els.checked, s.checked, 'checked', 'listEmptyChecked');
    renderStaples(s.staples);
    renderHints(s.staples.concat(s.toBuy, s.checked));
    els.finish.disabled = !s.checked.length;
  }

  /* ---------- dialogs (empty shells; Task 4 fills them) ---------- */

  var disposeBack = { shareDialog: null, importDialog: null };

  function closeDialog(dlg) {
    if (!dlg) return;
    if (dlg.open) {
      try { dlg.close(); } catch (err) { dlg.removeAttribute('open'); }
    }
    var key = dlg.id;
    if (disposeBack[key]) { disposeBack[key](); disposeBack[key] = null; }
  }

  function openDialog(dlg) {
    if (!dlg || dlg.open) return;
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', '');
    if (SH && SH.pushBack) {
      disposeBack[dlg.id] = SH.pushBack(function () {
        if (!dlg.open) return false;
        closeDialog(dlg);
        return true;
      });
    }
  }

  function wireDialog(dlg) {
    // Esc / native close keeps the back stack in sync.
    dlg.addEventListener('close', function () { closeDialog(dlg); });
    // Backdrop click closes.
    dlg.addEventListener('click', function (e) { if (e.target === dlg) closeDialog(dlg); });
  }

  function stubDialog(dlg, titleKey) {
    dlg.innerHTML = '';
    var h = document.createElement('h3');
    h.textContent = t(titleKey);
    var note = document.createElement('p');
    note.className = 'sh-note';
    note.textContent = t('listComing');
    var actions = document.createElement('div');
    actions.className = 'sh-actions';
    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'sh-btn';
    close.textContent = t('listClose');
    close.addEventListener('click', function () { closeDialog(dlg); });
    actions.appendChild(close);
    dlg.appendChild(h);
    dlg.appendChild(note);
    dlg.appendChild(actions);
  }

  // Task 4 replaces these to build real Share / Import UIs.
  var handlers = {
    share: function () { stubDialog(els.shareDialog, 'listShareTitle'); openDialog(els.shareDialog); },
    importer: function () { stubDialog(els.importDialog, 'listImportTitle'); openDialog(els.importDialog); }
  };

  wireDialog(els.shareDialog);
  wireDialog(els.importDialog);

  /* ---------- events ---------- */

  els.form.addEventListener('submit', function (e) {
    e.preventDefault();
    var title = els.title.value.trim();
    if (!title) return;
    var input = { title: title, isRecurring: els.asStaple.checked };
    var qty = els.qty.value.trim();
    if (qty) input.quantity = qty;
    ListStore.addItem(input);
    els.title.value = '';
    els.qty.value = '';
    els.asStaple.checked = false;
    render();
    els.title.focus();
  });

  els.finish.addEventListener('click', function () {
    var s = sections();
    if (!s.checked.length) { toast(t('listNothingChecked')); return; }
    if (!window.confirm(t('listFinishConfirm'))) return;
    ListStore.finishTrip();
    render();
  });

  els.shareBtn.addEventListener('click', function () { handlers.share(); });
  els.importBtn.addEventListener('click', function () { handlers.importer(); });

  window.addEventListener('shophelper-lang', render);
  window.addEventListener('storage', function (e) {
    if (e.key === ListStore.KEY) render();
  });

  // Hooks for Task 4 (share / import UI).
  window.ShophelperListPage = {
    render: render,
    openDialog: openDialog,
    closeDialog: closeDialog,
    dialogs: { share: els.shareDialog, importer: els.importDialog },
    setHandlers: function (h) {
      if (h && h.share) handlers.share = h.share;
      if (h && h.importer) handlers.importer = h.importer;
    }
  };

  render();
})();
