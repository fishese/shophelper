'use strict';

(function (global, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(global);
  else global.ShophelperSizesStore = factory(global);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (global) {
  var KEY = 'shophelper_sizes_v1';
  var storageOverride = null;
  var CORE = ['height', 'neck', 'shoulder', 'chest', 'underbust', 'waist', 'hip', 'inseam', 'sleeve', 'footLength', 'footWidth'];
  var SAVED = ['tops', 'bottoms', 'bra', 'shoes'];

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

  function defaults() {
    return {
      version: 1,
      selectedPersonId: null,
      displayUnit: 'cm',
      people: []
    };
  }

  function storage() {
    if (storageOverride) return storageOverride;
    try { return global.localStorage; } catch (err) { return null; }
  }

  function normalizePerson(person) {
    if (!person || typeof person !== 'object') return null;
    var id = person.id == null ? '' : String(person.id).trim();
    var name = person.name == null ? '' : String(person.name).trim();
    if (!id || !name) return null;
    var out = {};
    Object.keys(person).forEach(function (key) { out[key] = person[key]; });
    out.id = id;
    out.name = name;
    out.note = person.note == null ? '' : String(person.note);
    out.measurements = {};
    var rawMeasurements = person.measurements && typeof person.measurements === 'object' ? person.measurements : {};
    CORE.forEach(function (field) {
      if (rawMeasurements[field] == null) return;
      var value = String(rawMeasurements[field]).trim();
      if (value) out.measurements[field] = value;
    });
    out.custom = [];
    if (Array.isArray(person.custom)) {
      person.custom.forEach(function (row) {
        if (!row || row.id == null || String(row.id).trim() === '') return;
        out.custom.push({
          id: String(row.id),
          label: row.label == null ? '' : String(row.label),
          valueCm: row.valueCm == null ? '' : String(row.valueCm)
        });
      });
    }
    out.saved = {};
    var rawSaved = person.saved && typeof person.saved === 'object' ? person.saved : {};
    SAVED.forEach(function (kind) {
      if (rawSaved[kind] && typeof rawSaved[kind] === 'object') out.saved[kind] = rawSaved[kind];
    });
    if (person.displayUnit === 'cm' || person.displayUnit === 'in') out.displayUnit = person.displayUnit;
    else delete out.displayUnit;
    if (person.updatedAt != null) out.updatedAt = person.updatedAt;
    return out;
  }

  function normalizeDoc(raw) {
    var doc = defaults();
    if (!raw || typeof raw !== 'object') return doc;
    doc.displayUnit = raw.displayUnit === 'in' ? 'in' : 'cm';
    doc.people = Array.isArray(raw.people) ? raw.people.map(normalizePerson).filter(Boolean) : [];
    var selected = raw.selectedPersonId == null ? '' : String(raw.selectedPersonId);
    doc.selectedPersonId = doc.people.some(function (person) { return person.id === selected; }) ? selected : null;
    return doc;
  }

  function load() {
    var ls = storage();
    if (!ls) return defaults();
    try { return normalizeDoc(JSON.parse(ls.getItem(KEY))); }
    catch (err) { return defaults(); }
  }

  function mirrorToHome() {
    var Store = global.ShophelperStore;
    if (!Store || typeof Store.update !== 'function') return;
    try {
      var doc = load();
      Store.update(function (data) { data.sizes = doc; });
    } catch (err) {}
  }

  function save(doc) {
    var ls = storage();
    if (!ls) return;
    ls.setItem(KEY, JSON.stringify(doc));
    try { global.dispatchEvent(new CustomEvent('shophelper-sizes-change')); } catch (err) {}
    mirrorToHome();
  }

  function findPerson(doc, id) {
    for (var i = 0; i < doc.people.length; i++) {
      if (doc.people[i].id === id) return doc.people[i];
    }
    return null;
  }

  function mutate(id, fn) {
    var doc = load();
    var person = findPerson(doc, id);
    if (!person) return null;
    var result = fn(doc, person);
    person.updatedAt = Date.now();
    save(doc);
    return result === undefined ? person : result;
  }

  function addPerson(input) {
    input = input || {};
    var name = String(input.name == null ? '' : input.name).trim();
    if (!name) return null;
    var doc = load();
    var person = {
      id: uuid(),
      name: name,
      note: input.note == null ? '' : String(input.note),
      measurements: {},
      custom: [],
      saved: {},
      updatedAt: Date.now()
    };
    doc.people.push(person);
    doc.selectedPersonId = person.id;
    save(doc);
    return person;
  }

  function renamePerson(id, name) {
    var next = String(name == null ? '' : name).trim();
    if (!next) return null;
    return mutate(id, function (doc, person) {
      person.name = next;
      return person;
    });
  }

  function setNote(id, note) {
    return mutate(id, function (doc, person) {
      person.note = note == null ? '' : String(note);
      return person;
    });
  }

  function deletePerson(id) {
    var doc = load();
    var before = doc.people.length;
    doc.people = doc.people.filter(function (person) { return person.id !== id; });
    if (doc.people.length === before) return false;
    if (doc.selectedPersonId === id) doc.selectedPersonId = null;
    save(doc);
    return true;
  }

  function selectPerson(id) {
    var doc = load();
    if (id == null || id === '') {
      doc.selectedPersonId = null;
      save(doc);
      return null;
    }
    if (!findPerson(doc, id)) return null;
    doc.selectedPersonId = id;
    save(doc);
    return id;
  }

  function setMeasurement(id, field, valueCm) {
    if (CORE.indexOf(field) < 0) return null;
    return mutate(id, function (doc, person) {
      var value = valueCm == null ? '' : String(valueCm).trim();
      if (!value) delete person.measurements[field];
      else person.measurements[field] = value;
      return person;
    });
  }

  function addCustom(id, input) {
    input = input || {};
    return mutate(id, function (doc, person) {
      var row = {
        id: uuid(),
        label: input.label == null ? '' : String(input.label),
        valueCm: input.valueCm == null ? '' : String(input.valueCm)
      };
      person.custom.push(row);
      return row;
    });
  }

  function removeCustom(id, customId) {
    return mutate(id, function (doc, person) {
      var before = person.custom.length;
      person.custom = person.custom.filter(function (row) { return row.id !== customId; });
      return before !== person.custom.length;
    });
  }

  function setCustom(id, customId, input) {
    input = input || {};
    return mutate(id, function (doc, person) {
      var row = null;
      for (var i = 0; i < person.custom.length; i++) {
        if (person.custom[i].id === customId) { row = person.custom[i]; break; }
      }
      if (!row) return null;
      if (input.label != null) row.label = String(input.label);
      if (input.valueCm != null) row.valueCm = String(input.valueCm);
      return row;
    });
  }

  function setSaved(id, kind, payload) {
    if (SAVED.indexOf(kind) < 0) return null;
    return mutate(id, function (doc, person) {
      if (payload == null) delete person.saved[kind];
      else person.saved[kind] = payload;
      return person;
    });
  }

  function setDisplayUnit(idOrNull, unit) {
    if (unit !== 'cm' && unit !== 'in') return null;
    if (idOrNull == null) {
      var doc = load();
      doc.displayUnit = unit;
      save(doc);
      return doc;
    }
    return mutate(idOrNull, function (doc, person) {
      person.displayUnit = unit;
      return person;
    });
  }

  function withStorage(ls) {
    storageOverride = ls;
    var Store = global.ShophelperStore;
    if (Store && typeof Store.withStorage === 'function') Store.withStorage(ls);
    return api;
  }

  var api = {
    KEY: KEY,
    defaults: defaults,
    load: load,
    save: save,
    withStorage: withStorage,
    addPerson: addPerson,
    renamePerson: renamePerson,
    setNote: setNote,
    deletePerson: deletePerson,
    selectPerson: selectPerson,
    setMeasurement: setMeasurement,
    addCustom: addCustom,
    removeCustom: removeCustom,
    setCustom: setCustom,
    setSaved: setSaved,
    setDisplayUnit: setDisplayUnit,
    mirrorToHome: mirrorToHome
  };

  return api;
});
