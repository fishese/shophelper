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
  var closeHooks = { shareDialog: null, importDialog: null };

  function closeDialog(dlg) {
    if (!dlg) return;
    if (dlg.open) {
      try { dlg.close(); } catch (err) { dlg.removeAttribute('open'); }
    }
    var key = dlg.id;
    if (disposeBack[key]) { disposeBack[key](); disposeBack[key] = null; }
    if (closeHooks[key]) { var hook = closeHooks[key]; closeHooks[key] = null; hook(); }
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

  /* ---------- share / import ---------- */

  var Codec = window.ShophelperListCodec;
  var SCAN_HOST_ID = 'importScanHost';

  function mk(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function mkBtn(label, onClick, cls) {
    var b = mk('button', 'sh-btn' + (cls ? ' ' + cls : ''), label);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }

  function closeBtn(dlg) { return mkBtn(t('listClose'), function () { closeDialog(dlg); }); }

  // Active items only (to buy + checked); idle staples and `s` are never shared.
  function buildSharePayload() {
    var list = ListStore.activeList();
    var rows = (list.items || []).filter(function (i) { return i.isActive; }).sort(bySort).map(function (i) {
      var row = { t: i.title };
      if (i.quantity) row.q = i.quantity;
      row.r = i.isRecurring ? 1 : 0;
      row.c = i.isChecked ? 1 : 0;
      row.o = Number(i.sort) || 0;
      return row;
    });
    return { v: 1, n: list.name, i: rows };
  }

  function copyText(text, field) {
    var done = function () { toast(t('listLinkCopied')); };
    var fallback = function () {
      try {
        if (field) { field.focus(); field.select(); }
        if (document.execCommand && document.execCommand('copy')) { done(); return; }
      } catch (err) {}
      toast(t('listCopyFailed'));
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else {
      fallback();
    }
  }

  function qrDataUrl(text) {
    if (typeof window.qrcode !== 'function') return { err: 'listShareNoLib' };
    try {
      var qr = window.qrcode(0, 'M');
      qr.addData(text);
      qr.make();
      return { url: qr.createDataURL(6, 8) };
    } catch (err) {
      return { err: 'listShareQrTooBig' };
    }
  }

  function openShare() {
    var dlg = els.shareDialog;
    dlg.innerHTML = '';
    dlg.appendChild(mk('h3', null, t('listShareTitle')));
    var payload = buildSharePayload();
    var actions = mk('div', 'sh-actions');

    if (!payload.i.length) {
      dlg.appendChild(mk('p', 'sh-note', t('listShareEmpty')));
      actions.appendChild(closeBtn(dlg));
      dlg.appendChild(actions);
      openDialog(dlg);
      return;
    }

    var link = '';
    try {
      link = Codec.buildUrl(Codec.encodeShare(payload), location.href.split('#')[0]);
    } catch (err) {
      dlg.appendChild(mk('p', 'sh-note', t('listShareFailed')));
      actions.appendChild(closeBtn(dlg));
      dlg.appendChild(actions);
      openDialog(dlg);
      toast(t('listShareFailed'));
      return;
    }

    dlg.appendChild(mk('p', 'sh-note', t('listShareHint')));
    var qr = qrDataUrl(link);
    if (qr.url) {
      var img = mk('img', 'share-qr');
      img.alt = 'QR';
      img.src = qr.url;
      dlg.appendChild(img);
    } else {
      dlg.appendChild(mk('p', 'sh-note', t(qr.err)));
    }

    var field = mk('textarea', 'share-link');
    field.readOnly = true;
    field.rows = 3;
    field.value = link;
    field.setAttribute('aria-label', t('listCopyLink'));
    field.addEventListener('focus', function () { field.select(); });
    dlg.appendChild(field);

    actions.appendChild(mkBtn(t('listCopyLink'), function () { copyText(link, field); }, 'primary'));
    actions.appendChild(mkBtn(t('listShareNative'), function () {
      if (navigator.share) {
        navigator.share({ title: payload.n || t('toolList'), url: link }).catch(function () {});
      } else {
        copyText(link, field);
      }
    }));
    actions.appendChild(closeBtn(dlg));
    dlg.appendChild(actions);
    openDialog(dlg);
  }

  function stripShareHash() {
    if (Codec && Codec.parseUrl(location.hash) && window.history && history.replaceState) {
      try { history.replaceState(null, '', location.pathname + location.search); } catch (err) {}
    }
  }

  function decodeImageFile(file) {
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(file);
      var done = function (text) { URL.revokeObjectURL(url); resolve(text || null); };
      var viaHtml5 = function () {
        if (typeof window.Html5Qrcode !== 'function') { done(null); return; }
        var reader;
        try { reader = new window.Html5Qrcode(SCAN_HOST_ID, { verbose: false }); } catch (err) { done(null); return; }
        reader.scanFile(file, false).then(function (text) {
          try { reader.clear(); } catch (err) {}
          done(text);
        }, function () { done(null); });
      };
      if (typeof window.jsQR !== 'function') { viaHtml5(); return; }
      var img = new Image();
      img.onload = function () {
        try {
          var scale = Math.min(1200 / img.naturalWidth, 1) || 1;
          var cv = document.createElement('canvas');
          cv.width = Math.round(img.naturalWidth * scale);
          cv.height = Math.round(img.naturalHeight * scale);
          var ctx = cv.getContext('2d');
          ctx.drawImage(img, 0, 0, cv.width, cv.height);
          var d = ctx.getImageData(0, 0, cv.width, cv.height);
          var code = window.jsQR(d.data, cv.width, cv.height, { inversionAttempts: 'attemptBoth' });
          if (code && code.data) { done(code.data); return; }
        } catch (err) {}
        viaHtml5();
      };
      img.onerror = function () { done(null); };
      img.src = url;
    });
  }

  function openImport(prefill) {
    var dlg = els.importDialog;
    dlg.innerHTML = '';
    dlg.appendChild(mk('h3', null, t('listImportTitle')));

    var pending = null; // { payload, rows }
    var scanner = null;
    var scanStart = null;
    var lastBadScan = '';

    var field = mk('textarea', 'import-field');
    field.rows = 3;
    field.placeholder = t('listImportPaste');
    field.setAttribute('aria-label', t('listImportPaste'));
    var host = mk('div', 'import-host');
    host.id = SCAN_HOST_ID;
    var previewBox = mk('div');
    var msg = mk('p', 'sh-note');
    msg.setAttribute('role', 'status');
    var mergeBtn = mkBtn(t('listImportMerge'), function () { apply('merge'); }, 'primary');
    var replaceBtn = mkBtn(t('listImportReplace'), function () { apply('replace'); });
    mergeBtn.disabled = true;
    replaceBtn.disabled = true;

    function stopScan() {
      var s = scanner, started = scanStart;
      scanner = null;
      scanStart = null;
      scanBtn.textContent = t('listImportScan');
      if (!s) return;
      var cleanup = function () {
        var p;
        try { p = s.stop(); } catch (err) { p = null; }
        Promise.resolve(p).catch(function () {}).then(function () { try { s.clear(); } catch (err) {} });
      };
      if (started) started.then(cleanup, function () {}); else cleanup();
    }

    function setPending(p, message) {
      pending = p;
      previewBox.innerHTML = '';
      mergeBtn.disabled = !p || !p.rows.length;
      replaceBtn.disabled = !p || !p.rows.length;
      msg.textContent = message || '';
      if (!p) return;
      var head = mk('p', null, (p.payload.n ? String(p.payload.n) + ' \u00B7 ' : '') + p.rows.length + ' ' + t('listImportItems'));
      head.style.fontWeight = '650';
      previewBox.appendChild(head);
      var ul = mk('ul', 'import-preview');
      p.rows.forEach(function (row) {
        var li = mk('li', null, String(row.t) + (row.q ? ' \u00D7 ' + row.q : ''));
        if (row.c) li.style.textDecoration = 'line-through';
        ul.appendChild(li);
      });
      previewBox.appendChild(ul);
    }

    // Returns true when the text decoded to a usable payload.
    function tryDecode(text, silent) {
      var payload = null;
      try { payload = Codec.decodeShare(text); } catch (err) { payload = null; }
      if (!payload) {
        setPending(null, silent ? '' : t('listImportBad'));
        return false;
      }
      var rows = payload.i.filter(function (r) { return r && typeof r.t === 'string' && r.t.trim(); });
      setPending({ payload: payload, rows: rows }, rows.length ? '' : t('listImportEmpty'));
      return true;
    }

    function apply(mode) {
      if (!pending || !pending.rows.length) return;
      if (mode === 'replace' && !window.confirm(t('listImportReplaceConfirm'))) return;
      if (mode === 'replace') ListStore.importReplace(pending.rows);
      else ListStore.importMerge(pending.rows);
      render();
      toast(t(mode === 'replace' ? 'listImportReplaced' : 'listImportMerged'));
      closeDialog(dlg);
    }

    var previewBtn = mkBtn(t('listImportPreview'), function () {
      if (!field.value.trim()) { setPending(null, ''); return; }
      tryDecode(field.value, false);
    });
    field.addEventListener('input', function () {
      if (field.value.trim()) tryDecode(field.value, true); else setPending(null, '');
    });

    var scanBtn = mkBtn(t('listImportScan'), function () {
      if (scanner) { stopScan(); return; }
      if (typeof window.Html5Qrcode !== 'function') { msg.textContent = t('listImportNoLib'); return; }
      try {
        var s = new window.Html5Qrcode(SCAN_HOST_ID, { verbose: false });
        scanner = s;
        scanBtn.textContent = t('listImportStopScan');
        scanStart = s.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 220, height: 220 } }, function (text) {
          if (scanner !== s) return;
          if (tryDecode(text, true)) {
            field.value = text;
            stopScan();
          } else if (text !== lastBadScan) {
            lastBadScan = text;
            msg.textContent = t('listImportBad');
          }
        }, function () {});
        scanStart.catch(function () {
          if (scanner === s) {
            scanner = null;
            scanStart = null;
            scanBtn.textContent = t('listImportScan');
            try { s.clear(); } catch (err) {}
          }
          msg.textContent = t('listImportCamFail');
        });
      } catch (err) {
        scanner = null;
        scanStart = null;
        scanBtn.textContent = t('listImportScan');
        msg.textContent = t('listImportCamFail');
      }
    });

    var fileLabel = mk('label', 'sh-label', t('listImportFile'));
    var file = mk('input');
    file.type = 'file';
    file.accept = 'image/*';
    fileLabel.htmlFor = 'importFile';
    file.id = 'importFile';
    file.addEventListener('change', function () {
      var f = file.files && file.files[0];
      if (!f) return;
      decodeImageFile(f).then(function (text) {
        file.value = '';
        if (!text) { setPending(null, t('listImportNoQr')); return; }
        field.value = text;
        tryDecode(text, false);
      });
    });

    dlg.appendChild(field);
    var row1 = mk('div', 'sh-actions');
    row1.appendChild(previewBtn);
    row1.appendChild(scanBtn);
    dlg.appendChild(row1);
    dlg.appendChild(host);
    dlg.appendChild(fileLabel);
    dlg.appendChild(file);
    dlg.appendChild(msg);
    dlg.appendChild(previewBox);
    var row2 = mk('div', 'sh-actions');
    row2.appendChild(mergeBtn);
    row2.appendChild(replaceBtn);
    row2.appendChild(closeBtn(dlg));
    dlg.appendChild(row2);

    closeHooks.importDialog = function () {
      stopScan();
      stripShareHash();
    };

    if (prefill) {
      field.value = prefill;
      tryDecode(prefill, false);
    }
    openDialog(dlg);
  }

  var handlers = {
    share: openShare,
    importer: function () { openImport(''); }
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

  // Opened via a shared link: show the import preview (hash is stripped once dismissed/applied).
  function openFromHash() {
    var incoming = Codec && Codec.parseUrl(location.hash);
    if (incoming) {
      if (els.importDialog.open) closeDialog(els.importDialog);
      openImport(incoming);
    }
  }
  window.addEventListener('hashchange', openFromHash);
  openFromHash();
})();
