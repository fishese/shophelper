'use strict';

(function (global, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(global);
  else global.ShophelperListStore = factory(global);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (global) {
  var KEY = 'shophelper_list_v1';
  var storageOverride = null;

  function uuid() {
    try {
      if (global.crypto && typeof global.crypto.randomUUID === 'function') {
        return global.crypto.randomUUID();
      }
    } catch (err) {}
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function normalizeTitle(t) {
    return String(t == null ? '' : t).trim().toLowerCase();
  }

  function defaults() {
    var listId = uuid();
    return {
      version: 1,
      activeListId: listId,
      lists: [{ id: listId, name: 'Shopping', items: [] }]
    };
  }

  function storage() {
    if (storageOverride) return storageOverride;
    try { return global.localStorage; } catch (err) { return null; }
  }

  function load() {
    var ls = storage();
    if (!ls) return defaults();
    try {
      var raw = JSON.parse(ls.getItem(KEY));
      if (!raw || typeof raw !== 'object') return defaults();
      if (!raw.activeListId || !Array.isArray(raw.lists) || !raw.lists.length) return defaults();
      return raw;
    } catch (err) {
      return defaults();
    }
  }

  function mirrorToHome() {
    var Store = global.ShophelperStore;
    if (!Store || typeof Store.update !== 'function') return;
    try {
      Store.update(function (d) {
        d.shoppingList = load();
      });
    } catch (err) {}
  }

  function save(doc) {
    var ls = storage();
    if (!ls) return;
    ls.setItem(KEY, JSON.stringify(doc));
    try { global.dispatchEvent(new CustomEvent('shophelper-list-change')); } catch (err) {}
    mirrorToHome();
  }

  function activeList(doc) {
    var d = doc || load();
    var list = null;
    for (var i = 0; i < d.lists.length; i++) {
      if (d.lists[i].id === d.activeListId) {
        list = d.lists[i];
        break;
      }
    }
    return list || d.lists[0];
  }

  function maxSort(items) {
    var m = 0;
    for (var i = 0; i < items.length; i++) {
      var s = Number(items[i].sort);
      if (isFinite(s) && s > m) m = s;
    }
    return m;
  }

  function findClearMatch(items, titleNorm) {
    var matches = [];
    for (var i = 0; i < items.length; i++) {
      if (normalizeTitle(items[i].title) === titleNorm) matches.push(items[i]);
    }
    return matches.length === 1 ? matches[0] : null;
  }

  function persistMutation(mutator) {
    var doc = load();
    var list = activeList(doc);
    var result = mutator(doc, list);
    save(doc);
    return result;
  }

  function addItem(input) {
    input = input || {};
    var title = String(input.title == null ? '' : input.title).trim();
    var titleNorm = normalizeTitle(title);
    var quantity = input.quantity == null ? '' : String(input.quantity);
    var note = input.note == null ? '' : String(input.note);
    var incomingRecurring = !!input.isRecurring;

    return persistMutation(function (doc, list) {
      var match = titleNorm ? findClearMatch(list.items, titleNorm) : null;
      if (match) {
        match.isActive = true;
        match.isChecked = false;
        match.isRecurring = !!match.isRecurring || incomingRecurring;
        if (input.quantity != null) match.quantity = quantity;
        if (input.note != null) match.note = note;
        match.title = title || match.title;
        return match;
      }
      var item = {
        id: uuid(),
        title: title,
        quantity: quantity,
        note: note,
        isRecurring: incomingRecurring,
        isActive: true,
        isChecked: false,
        sort: maxSort(list.items) + 1
      };
      list.items.push(item);
      return item;
    });
  }

  function toggleChecked(id, value) {
    return persistMutation(function (doc, list) {
      var item = null;
      for (var i = 0; i < list.items.length; i++) {
        if (list.items[i].id === id) { item = list.items[i]; break; }
      }
      if (!item) return null;
      item.isChecked = value === undefined ? !item.isChecked : !!value;
      return item;
    });
  }

  function setRecurring(id, value) {
    return persistMutation(function (doc, list) {
      var item = null;
      for (var i = 0; i < list.items.length; i++) {
        if (list.items[i].id === id) { item = list.items[i]; break; }
      }
      if (!item) return null;
      item.isRecurring = !!value;
      return item;
    });
  }

  function removeItem(id) {
    return persistMutation(function (doc, list) {
      var before = list.items.length;
      list.items = list.items.filter(function (i) { return i.id !== id; });
      return before !== list.items.length;
    });
  }

  function activateStaple(id) {
    return persistMutation(function (doc, list) {
      var item = null;
      for (var i = 0; i < list.items.length; i++) {
        if (list.items[i].id === id) { item = list.items[i]; break; }
      }
      if (!item) return null;
      item.isActive = true;
      item.isChecked = false;
      item.sort = maxSort(list.items) + 1;
      return item;
    });
  }

  function finishTrip() {
    // Spec UI is "clear checked"; plan tests also idle unchecked staples via finishTrip.
    // Process every active item: staples → idle pool; one-offs → delete.
    return persistMutation(function (doc, list) {
      var kept = [];
      for (var i = 0; i < list.items.length; i++) {
        var item = list.items[i];
        if (!item.isActive) {
          kept.push(item);
          continue;
        }
        if (item.isRecurring) {
          item.isActive = false;
          item.isChecked = false;
          kept.push(item);
        }
        // active one-offs are dropped
      }
      list.items = kept;
      return list;
    });
  }

  function sectionPeers(items, item) {
    return items.filter(function (i) {
      return i.isActive && !!i.isChecked === !!item.isChecked;
    }).sort(function (a, b) {
      return (Number(a.sort) || 0) - (Number(b.sort) || 0);
    });
  }

  function moveItem(id, direction) {
    return persistMutation(function (doc, list) {
      var item = null;
      for (var i = 0; i < list.items.length; i++) {
        if (list.items[i].id === id) { item = list.items[i]; break; }
      }
      if (!item || !item.isActive) return null;
      var peers = sectionPeers(list.items, item);
      var idx = -1;
      for (var p = 0; p < peers.length; p++) {
        if (peers[p].id === id) { idx = p; break; }
      }
      var swapIdx = idx + (direction < 0 ? -1 : 1);
      if (idx < 0 || swapIdx < 0 || swapIdx >= peers.length) return item;
      var other = peers[swapIdx];
      var tmp = item.sort;
      item.sort = other.sort;
      other.sort = tmp;
      return item;
    });
  }

  function rowToItem(row, sort) {
    return {
      id: uuid(),
      title: String(row && row.t != null ? row.t : '').trim(),
      quantity: row && row.q != null ? String(row.q) : '',
      note: '',
      isRecurring: !!(row && row.r),
      isActive: true,
      isChecked: !!(row && row.c),
      sort: row && row.o != null && isFinite(Number(row.o)) ? Number(row.o) : sort
    };
  }

  function importMerge(rows) {
    rows = Array.isArray(rows) ? rows : [];
    return persistMutation(function (doc, list) {
      var nextSort = maxSort(list.items) + 1;
      for (var i = 0; i < rows.length; i++) {
        list.items.push(rowToItem(rows[i], nextSort++));
      }
      return list;
    });
  }

  function importReplace(rows) {
    rows = Array.isArray(rows) ? rows : [];
    return persistMutation(function (doc, list) {
      var idle = list.items.filter(function (i) { return !i.isActive; });
      var nextSort = maxSort(idle) + 1;
      var imported = [];
      for (var i = 0; i < rows.length; i++) {
        imported.push(rowToItem(rows[i], nextSort++));
      }
      list.items = idle.concat(imported);
      return list;
    });
  }

  function withStorage(ls) {
    storageOverride = ls;
    return api;
  }

  function activeListExport() {
    return activeList();
  }

  var api = {
    KEY: KEY,
    defaults: defaults,
    load: load,
    save: save,
    activeList: activeListExport,
    normalizeTitle: normalizeTitle,
    addItem: addItem,
    toggleChecked: toggleChecked,
    setRecurring: setRecurring,
    removeItem: removeItem,
    activateStaple: activateStaple,
    finishTrip: finishTrip,
    moveItem: moveItem,
    importMerge: importMerge,
    importReplace: importReplace,
    mirrorToHome: mirrorToHome,
    withStorage: withStorage
  };

  return api;
});
