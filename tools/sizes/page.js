'use strict';

(function () {
  var Sizes = window.ShophelperSizes;
  var Store = window.ShophelperSizesStore;
  var Decimal = window.ShophelperDecimal;
  var SH = window.Shophelper;

  var CORE = [
    ['height', 'sizesHeight', 'sizesHintHeight'],
    ['neck', 'sizesNeck', 'sizesHintNeck'],
    ['shoulder', 'sizesShoulder', 'sizesHintShoulder'],
    ['chest', 'sizesChest', 'sizesHintChest'],
    ['underbust', 'sizesUnderbust', 'sizesHintUnderbust'],
    ['waist', 'sizesWaist', 'sizesHintWaist'],
    ['hip', 'sizesHip', 'sizesHintHip'],
    ['inseam', 'sizesInseam', 'sizesHintInseam'],
    ['sleeve', 'sizesSleeve', 'sizesHintSleeve'],
    ['footLength', 'sizesFootLength', 'sizesHintFootLength'],
    ['footWidth', 'sizesFootWidth', 'sizesHintFootWidth']
  ];

  var SYS_KEY = {
    letter: 'sizesSysLetter',
    us: 'sizesSysUs',
    uk: 'sizesSysUk',
    au: 'sizesSysAu',
    'eu-de': 'sizesSysEuDe',
    'eu-fr': 'sizesSysEuFr',
    eu: 'sizesSysEu',
    it: 'sizesSysIt',
    jp: 'sizesSysJp',
    fr: 'sizesSysFr',
    'us-m': 'sizesSysUsMen',
    'us-w': 'sizesSysUsWomen',
    mondo: 'sizesSysMondo',
    mm: 'sizesSysMm',
    cm: 'sizesSysCm',
    'waist-in': 'sizesSysWaistIn',
    'waist-cm': 'sizesSysWaistCm'
  };

  var view = 'people';
  var convert = {
    category: 'women',
    from: 'us',
    size: '',
    band: '',
    cup: '',
    approximate: false,
    override: null
  };

  function t(key) {
    return SH && SH.t ? SH.t(key) : key;
  }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function btn(label, onClick, cls) {
    var button = el('button', 'sh-btn' + (cls ? ' ' + cls : ''), label);
    button.type = 'button';
    button.addEventListener('click', onClick);
    return button;
  }

  function sysLabel(id) {
    return t(SYS_KEY[id] || id);
  }

  function doc() {
    return Store.load();
  }

  function selectedPerson(data) {
    data = data || doc();
    var id = data.selectedPersonId;
    if (!id) return null;
    for (var i = 0; i < data.people.length; i++) {
      if (data.people[i].id === id) return data.people[i];
    }
    return null;
  }

  function unitOf(person, data) {
    if (person && (person.displayUnit === 'cm' || person.displayUnit === 'in')) return person.displayUnit;
    return data && data.displayUnit === 'in' ? 'in' : 'cm';
  }

  function roundCm(cm) {
    if (!cm) return '';
    return Decimal.round(cm, 1) || cm;
  }

  function paintTitle() {
    var title = document.querySelector('.sh-title');
    if (!title) return;
    title.setAttribute('data-i18n', 'toolSizes');
    title.textContent = t('toolSizes');
    document.title = t('toolSizes') + ' · Shophelper';
  }

  function paintViewTabs() {
    var host = document.getElementById('viewTabs');
    host.innerHTML = '';
    host.setAttribute('aria-label', t('toolSizes'));
    [['people', 'sizesPeople'], ['convert', 'sizesConvert']].forEach(function (pair) {
      var button = el('button', pair[0] === view ? 'on' : '', t(pair[1]));
      button.type = 'button';
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', pair[0] === view ? 'true' : 'false');
      button.addEventListener('click', function () {
        view = pair[0];
        render();
      });
      host.appendChild(button);
    });
    document.getElementById('peopleView').hidden = view !== 'people';
    document.getElementById('convertView').hidden = view !== 'convert';
  }

  function nameDialog(title, current, onOk) {
    SH.openDialog({
      title: title,
      render: function (panel, close) {
        var label = el('label', 'sh-label', t('sizesName'));
        label.setAttribute('for', 'sizesNameInput');
        var input = document.createElement('input');
        input.id = 'sizesNameInput';
        input.value = current || '';
        input.autocomplete = 'name';
        panel.appendChild(label);
        panel.appendChild(input);
        var actions = el('div', 'sh-actions');
        var save = btn(t('sizesSave'), function () {
          var name = input.value.trim();
          if (!name) return;
          onOk(name);
          close();
        }, 'primary');
        actions.appendChild(btn(t('sizesCancel'), close));
        actions.appendChild(save);
        panel.appendChild(actions);
        input.addEventListener('keydown', function (event) {
          if (event.key === 'Enter') { event.preventDefault(); save.click(); }
        });
      }
    });
  }

  function confirmDelete(person) {
    SH.openDialog({
      title: t('sizesDelete'),
      render: function (panel, close) {
        panel.appendChild(el('p', 'sh-note', t('sizesDeleteConfirm')));
        var actions = el('div', 'sh-actions');
        actions.appendChild(btn(t('sizesCancel'), close));
        actions.appendChild(btn(t('sizesDelete'), function () {
          Store.deletePerson(person.id);
          close();
          render();
        }, 'warn'));
        panel.appendChild(actions);
      }
    });
  }

  function fillSelect(select, ids, selected) {
    select.innerHTML = '';
    ids.forEach(function (id) {
      var option = document.createElement('option');
      option.value = id;
      option.textContent = sysLabel(id);
      select.appendChild(option);
    });
    select.value = ids.indexOf(selected) >= 0 ? selected : (ids[0] || '');
  }

  function savedIds(kind) {
    if (kind === 'bra') return ['us', 'uk', 'eu', 'fr', 'au', 'jp'];
    if (kind === 'shoes') return ['eu', 'uk', 'us-m', 'us-w', 'jp', 'mondo', 'cm', 'mm'];
    if (kind === 'bottoms') return ['letter', 'us', 'uk', 'au', 'eu-de', 'eu-fr', 'eu', 'it', 'jp', 'waist-in', 'waist-cm'];
    return ['letter', 'us', 'uk', 'au', 'eu-de', 'eu-fr', 'eu', 'it', 'jp'];
  }

  function fieldWrap(labelText, input, hint) {
    var wrap = el('div', 'sh-measure');
    var label = el('label', 'sh-label', labelText);
    if (input.id) label.setAttribute('for', input.id);
    wrap.appendChild(label);
    wrap.appendChild(input);
    if (hint) wrap.appendChild(el('p', 'sh-note', hint));
    return wrap;
  }

  function paintPeople() {
    var host = document.getElementById('peopleView');
    var data = doc();
    var person = selectedPerson(data);
    host.innerHTML = '';

    var card = el('section', 'sh-card');
    card.appendChild(el('h2', '', t('sizesPeople')));
    var row = el('div', 'sh-row');
    var select = document.createElement('select');
    select.id = 'sizesPerson';
    select.setAttribute('aria-label', t('sizesPeople'));
    if (!data.people.length) {
      var empty = document.createElement('option');
      empty.value = '';
      empty.textContent = t('sizesNoPeople');
      select.appendChild(empty);
    }
    data.people.forEach(function (item) {
      var option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.name;
      select.appendChild(option);
    });
    select.value = person ? person.id : '';
    select.addEventListener('change', function () {
      Store.selectPerson(select.value || null);
      render();
    });
    row.appendChild(select);
    card.appendChild(row);
    var actions = el('div', 'sh-actions');
    actions.appendChild(btn(t('sizesAddPerson'), function () {
      nameDialog(t('sizesAddPerson'), '', function (name) {
        Store.addPerson({ name: name });
        render();
      });
    }, 'primary'));
    if (person) {
      actions.appendChild(btn(t('sizesRename'), function () {
        nameDialog(t('sizesRename'), person.name, function (name) {
          Store.renamePerson(person.id, name);
          render();
        });
      }));
      actions.appendChild(btn(t('sizesDelete'), function () { confirmDelete(person); }, 'warn'));
    }
    card.appendChild(actions);
    host.appendChild(card);

    if (!person) {
      host.appendChild(el('p', 'sh-note', t('sizesNoPeople')));
      return;
    }

    var unit = unitOf(person, data);
    var form = el('section', 'sh-card');
    var noteLabel = el('label', 'sh-label', t('sizesNote'));
    noteLabel.setAttribute('for', 'sizesNoteInput');
    var note = document.createElement('input');
    note.id = 'sizesNoteInput';
    note.value = person.note || '';
    note.placeholder = t('sizesPersonNote');
    note.addEventListener('change', function () {
      Store.setNote(person.id, note.value);
    });
    form.appendChild(noteLabel);
    form.appendChild(note);

    form.appendChild(el('p', 'sh-label', t('sizesUnit')));
    var units = el('div', 'sh-pill');
    ['cm', 'in'].forEach(function (choice) {
      var button = el('button', choice === unit ? 'on' : '', t(choice === 'in' ? 'sizesIn' : 'sizesCm'));
      button.type = 'button';
      button.setAttribute('aria-pressed', choice === unit ? 'true' : 'false');
      button.addEventListener('click', function () {
        Store.setDisplayUnit(person.id, choice);
        render();
      });
      units.appendChild(button);
    });
    form.appendChild(units);

    CORE.forEach(function (spec) {
      var stored = person.measurements && person.measurements[spec[0]] || '';
      var input = document.createElement('input');
      input.id = 'sizes-m-' + spec[0];
      input.inputMode = 'decimal';
      input.autocomplete = 'off';
      input.value = stored ? Sizes.displayLength(stored, unit) : '';
      var other = unit === 'in' ? 'cm' : 'in';
      var hint = t(spec[2]);
      if (stored) hint += ' · ' + Sizes.displayLength(stored, other) + ' ' + t(other === 'in' ? 'sizesIn' : 'sizesCm');
      input.addEventListener('change', function () {
        if (input.value.trim() === '') {
          Store.setMeasurement(person.id, spec[0], '');
          render();
          return;
        }
        var cm = Sizes.parseLength(input.value, unit);
        if (!cm) {
          input.value = stored ? Sizes.displayLength(stored, unit) : '';
          return;
        }
        Store.setMeasurement(person.id, spec[0], roundCm(cm));
        render();
      });
      form.appendChild(fieldWrap(t(spec[1]), input, hint));
    });
    host.appendChild(form);

    var customCard = el('section', 'sh-card');
    customCard.appendChild(el('h2', '', t('sizesCustom')));
    (person.custom || []).forEach(function (rowItem) {
      var block = el('div', 'sh-measure');
      var label = document.createElement('input');
      label.value = rowItem.label || '';
      label.setAttribute('aria-label', t('sizesCustomLabel'));
      label.addEventListener('change', function () {
        Store.setCustom(person.id, rowItem.id, { label: label.value, valueCm: rowItem.valueCm });
      });
      var value = document.createElement('input');
      value.inputMode = 'decimal';
      value.value = rowItem.valueCm ? Sizes.displayLength(rowItem.valueCm, unit) : '';
      value.setAttribute('aria-label', t('sizesSize'));
      value.addEventListener('change', function () {
        if (value.value.trim() === '') {
          Store.setCustom(person.id, rowItem.id, { label: label.value, valueCm: '' });
          render();
          return;
        }
        var cm = Sizes.parseLength(value.value, unit);
        if (!cm) return;
        Store.setCustom(person.id, rowItem.id, { label: label.value, valueCm: roundCm(cm) });
        render();
      });
      var line = el('div', 'sh-row');
      line.appendChild(label);
      line.appendChild(value);
      block.appendChild(line);
      block.appendChild(btn(t('sizesRemove'), function () {
        Store.removeCustom(person.id, rowItem.id);
        render();
      }));
      customCard.appendChild(block);
    });
    customCard.appendChild(btn(t('sizesAddCustom'), function () {
      Store.addCustom(person.id, { label: '', valueCm: '' });
      render();
    }));
    host.appendChild(customCard);

    var savedCard = el('section', 'sh-card');
    savedCard.appendChild(el('h2', '', t('sizesSaved')));
    savedCard.appendChild(el('p', 'sh-note', t('sizesSavedHint')));
    [
      ['tops', 'sizesTops'],
      ['bottoms', 'sizesBottoms'],
      ['bra', 'sizesBra'],
      ['shoes', 'sizesShoes']
    ].forEach(function (kind) {
      paintSaved(savedCard, person, kind[0], t(kind[1]));
    });
    host.appendChild(savedCard);
    host.appendChild(suggestCard(person));
  }

  function paintSaved(card, person, kind, title) {
    var saved = (person.saved && person.saved[kind]) || {};
    card.appendChild(el('h3', 'sh-subhead', title));
    var system = document.createElement('select');
    system.id = 'sizes-saved-' + kind + '-system';
    fillSelect(system, savedIds(kind), saved.system || savedIds(kind)[0]);
    var size = document.createElement('input');
    size.id = 'sizes-saved-' + kind + '-size';
    size.value = saved.size || '';
    size.autocomplete = 'off';
    var note = document.createElement('input');
    note.id = 'sizes-saved-' + kind + '-note';
    note.value = saved.note || '';
    note.placeholder = t('sizesNote');
    function write(extra) {
      var payload = {
        system: system.value,
        size: kind === 'bra' ? (saved.size || '') : size.value.trim(),
        note: note.value
      };
      if (kind === 'bra') {
        payload.band = (extra && extra.band != null) ? extra.band : (saved.band || '');
        payload.cup = (extra && extra.cup != null) ? extra.cup : (saved.cup || '');
        payload.size = payload.band && payload.cup ? payload.band + payload.cup : (payload.band || payload.cup || '');
      }
      if (kind === 'shoes') payload.width = (extra && extra.width != null) ? extra.width : (saved.width || '');
      var blank = !payload.size && !payload.note && !(payload.band || payload.cup || payload.width);
      Store.setSaved(person.id, kind, blank ? null : payload);
    }
    system.addEventListener('change', function () { write(); });
    note.addEventListener('change', function () { write(); });
    card.appendChild(fieldWrap(t('sizesSystem'), system));
    if (kind === 'bra') {
      var band = document.createElement('input');
      band.id = 'sizes-saved-bra-band';
      band.inputMode = 'numeric';
      band.value = saved.band || '';
      var cup = document.createElement('input');
      cup.id = 'sizes-saved-bra-cup';
      cup.value = saved.cup || '';
      band.addEventListener('change', function () { write({ band: band.value.trim(), cup: cup.value.trim() }); });
      cup.addEventListener('change', function () { write({ band: band.value.trim(), cup: cup.value.trim() }); });
      var pair = el('div', 'sh-row');
      pair.appendChild(fieldWrap(t('sizesBand'), band));
      pair.appendChild(fieldWrap(t('sizesCup'), cup));
      card.appendChild(pair);
    } else {
      size.addEventListener('change', function () { write(); });
      card.appendChild(fieldWrap(t('sizesSize'), size));
    }
    if (kind === 'shoes') {
      var width = document.createElement('input');
      width.id = 'sizes-saved-shoes-width';
      width.value = saved.width || '';
      width.placeholder = 'D, E, EE';
      width.addEventListener('change', function () { write({ width: width.value.trim() }); });
      card.appendChild(fieldWrap(t('sizesWidth'), width));
    }
    card.appendChild(fieldWrap(t('sizesNote'), note));
  }

  function summaryOf(category, result) {
    if (!result || !result.ok) return '';
    if (result.between && result.neighbours) {
      return result.neighbours.map(function (item) {
        var eq = item.equivalents || {};
        return eq.letter || eq.us || '';
      }).filter(Boolean).join(' – ');
    }
    var eq = result.equivalents || {};
    if (category === 'bra') return eq.uk && eq.uk.label ? eq.uk.label : '';
    if (category === 'shoes') return [eq.eu, eq.uk, eq.usMen, eq.jp].filter(Boolean).join(' · ');
    return [eq.letter, eq.us, eq.eu || eq['eu-de']].filter(Boolean).join(' · ');
  }

  function suggestCard(person) {
    var card = el('section', 'sh-card');
    card.appendChild(el('h2', '', t('sizesSuggest')));
    card.appendChild(el('p', 'sh-note', t('sizesApproximate')));
    var m = person.measurements || {};
    var any = false;
    function add(labelKey, category) {
      var result = Sizes.suggestFromMeasurements({ category: category, measurements: m });
      if (!result.ok) return;
      any = true;
      var line = el('div', 'sh-line');
      line.appendChild(el('em', '', t(labelKey)));
      line.appendChild(el('span', '', summaryOf(category, result)));
      card.appendChild(line);
    }
    if (m.chest) {
      add('sizesWomen', 'women');
      add('sizesMen', 'men');
    }
    if (m.underbust) add('sizesBra', 'bra');
    if (m.footLength) add('sizesShoes', 'shoes');
    if (m.height && m.chest) {
      var cn = Sizes.suggestFromMeasurements({ category: 'women', measurements: m }).cn
        || Sizes.suggestFromMeasurements({ category: 'men', measurements: m }).cn;
      if (cn) card.appendChild(el('p', 'sh-note', t('sizesCn') + ': ' + cn));
    } else if (m.height || m.chest) {
      card.appendChild(el('p', 'sh-note', t('sizesCnMissing')));
    }
    if (!any) card.appendChild(el('p', 'sh-note', t('sizesCannotSuggest')));
    return card;
  }

  function categories() {
    return [
      ['women', 'sizesWomen'],
      ['men', 'sizesMen'],
      ['bra', 'sizesBra'],
      ['shoes', 'sizesShoes']
    ];
  }

  function systemsFor(category) {
    if (category === 'men') return Sizes.clothingSystems('men');
    if (category === 'bra') return Sizes.braSystems();
    if (category === 'shoes') return Sizes.shoeSystems();
    return Sizes.clothingSystems('women');
  }

  function paintConvertTabs() {
    var host = document.getElementById('convertTabs');
    host.innerHTML = '';
    host.setAttribute('aria-label', t('sizesConvert'));
    categories().forEach(function (pair) {
      var button = el('button', pair[0] === convert.category ? 'on' : '', t(pair[1]));
      button.type = 'button';
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', pair[0] === convert.category ? 'true' : 'false');
      button.addEventListener('click', function () {
        convert.category = pair[0];
        convert.from = systemsFor(pair[0])[0].id;
        convert.size = '';
        convert.band = '';
        convert.cup = '';
        convert.approximate = false;
        convert.override = null;
        render();
      });
      host.appendChild(button);
    });
  }

  function paintConvert() {
    paintConvertTabs();
    var body = document.getElementById('convertBody');
    body.innerHTML = '';
    var systems = systemsFor(convert.category);
    if (!systems.some(function (item) { return item.id === convert.from; })) convert.from = systems[0].id;

    var from = document.createElement('select');
    from.id = 'sizesFrom';
    systems.forEach(function (item) {
      var option = document.createElement('option');
      option.value = item.id;
      option.textContent = sysLabel(item.id);
      from.appendChild(option);
    });
    from.value = convert.from;
    from.addEventListener('change', function () {
      convert.from = from.value;
      convert.override = null;
      paintResults();
    });
    body.appendChild(fieldWrap(t('sizesSystem'), from));

    if (convert.category === 'bra') {
      var band = document.createElement('input');
      band.id = 'sizesBand';
      band.inputMode = 'numeric';
      band.value = convert.band;
      band.autocomplete = 'off';
      var cup = document.createElement('input');
      cup.id = 'sizesCup';
      cup.value = convert.cup;
      cup.autocomplete = 'off';
      function onBra() {
        convert.band = band.value.trim();
        convert.cup = cup.value.trim();
        convert.approximate = false;
        convert.override = null;
        paintResults();
      }
      band.addEventListener('input', onBra);
      cup.addEventListener('input', onBra);
      var pair = el('div', 'sh-row');
      pair.appendChild(fieldWrap(t('sizesBand'), band));
      pair.appendChild(fieldWrap(t('sizesCup'), cup));
      body.appendChild(pair);
      body.appendChild(el('p', 'sh-note', t('sizesAuBra')));
      body.appendChild(el('p', 'sh-note', t('sizesJpCup')));
    } else {
      var size = document.createElement('input');
      size.id = 'sizesValue';
      size.value = convert.size;
      size.autocomplete = 'off';
      size.addEventListener('input', function () {
        convert.size = size.value.trim();
        convert.approximate = false;
        convert.override = null;
        paintResults();
      });
      body.appendChild(fieldWrap(t('sizesSize'), size));
    }

    var person = selectedPerson();
    var useLabel = t('sizesUsePerson').replace('{name}', person ? person.name : '').replace(/\s+/g, ' ').trim();
    var use = btn(useLabel, function () { usePerson(person); });
    use.disabled = !person;
    body.appendChild(el('div', 'sh-actions')).appendChild(use);
    var results = el('div', 'sh-lines');
    results.id = 'convertResults';
    body.appendChild(results);
    if (convert.category === 'bra') paintSisterNote(body);
    paintResults();
  }

  function paintSisterNote(body) {
    body.appendChild(el('p', 'sh-note', t('sizesSisterNote')));
    var links = el('p', 'sh-note', t('sizesSisterLinks') + ' ');
    var reddit = document.createElement('a');
    reddit.className = 'sh-link';
    reddit.href = 'https://www.reddit.com/r/ABraThatFits/';
    reddit.target = '_blank';
    reddit.rel = 'noopener';
    reddit.textContent = t('sizesAbtfReddit');
    var calc = document.createElement('a');
    calc.className = 'sh-link';
    calc.href = 'https://www.abrathatfits.org/';
    calc.target = '_blank';
    calc.rel = 'noopener';
    calc.textContent = t('sizesAbtfCalc');
    links.appendChild(reddit);
    links.appendChild(document.createTextNode(' · '));
    links.appendChild(calc);
    body.appendChild(links);
  }

  function usePerson(person) {
    if (!person) return;
    var m = person.measurements || {};
    if (convert.category === 'shoes') {
      if (!m.footLength) { SH.toast(t('sizesMissingMeasure')); return; }
      convert.from = 'cm';
      convert.size = m.footLength;
      convert.approximate = true;
      convert.override = null;
      render();
      return;
    }
    if (convert.category === 'bra') {
      if (!m.underbust) { SH.toast(t('sizesMissingMeasure')); return; }
      var bra = Sizes.suggestFromMeasurements({ category: 'bra', measurements: m });
      if (!bra.ok) { SH.toast(t('sizesMissingMeasure')); return; }
      var part = bra.equivalents[convert.from] || bra.equivalents.uk;
      convert.band = part.band || '';
      convert.cup = part.cup || '';
      convert.approximate = true;
      convert.override = null;
      render();
      return;
    }
    if (!m.chest) { SH.toast(t('sizesMissingMeasure')); return; }
    var clothing = Sizes.suggestFromMeasurements({ category: convert.category, measurements: m });
    if (!clothing.ok) { SH.toast(t('sizesMissingMeasure')); return; }
    convert.approximate = true;
    if (clothing.between) {
      convert.size = '';
      convert.override = clothing;
      render();
      return;
    }
    convert.override = null;
    convert.from = 'us';
    convert.size = clothing.equivalents.us || '';
    render();
  }

  function currentResult() {
    if (convert.override) return convert.override;
    if (convert.category === 'bra') {
      if (!convert.band || !convert.cup) return null;
      return Sizes.convertBra({ from: convert.from, band: convert.band, cup: convert.cup });
    }
    if (!convert.size) return null;
    if (convert.category === 'shoes') return Sizes.convertShoe({ from: convert.from, size: convert.size });
    return Sizes.convertClothing({ category: convert.category, from: convert.from, size: convert.size });
  }

  function addLine(host, label, value, quiet) {
    var line = el('div', 'sh-line' + (quiet ? ' sh-quiet' : ''));
    line.appendChild(el('em', '', label));
    line.appendChild(el('span', '', value));
    host.appendChild(line);
  }

  function fitLine(range) {
    var person = selectedPerson();
    if (!person || !person.measurements) return '';
    var value = person.measurements.chest;
    var band = range && (range.bustCm || range.chestCm);
    if (!value || !band) return '';
    var n = Number(value);
    var min = Number(band.min);
    var max = Number(band.max);
    if (!isFinite(n) || !isFinite(min) || !isFinite(max)) return '';
    if (n < min) return t('sizesFitBelow');
    if (n > max) return t('sizesFitAbove');
    return t('sizesFitIn');
  }

  function rangeText(range) {
    if (!range) return '';
    var band = range.bustCm || range.chestCm;
    if (!band) return '';
    var unit = unitOf(selectedPerson(), doc());
    var min = Sizes.displayLength(String(band.min), unit);
    var max = Sizes.displayLength(String(band.max), unit);
    var name = range.bustCm ? t('sizesChest') : t('sizesChest');
    return name + ' ' + min + '–' + max + ' ' + t(unit === 'in' ? 'sizesIn' : 'sizesCm');
  }

  function paintEquivalents(host, equivalents, skip) {
    var alias = { 'us-m': 'usMen', 'us-w': 'usWomen' };
    var skipKey = alias[skip] || skip;
    Object.keys(equivalents).forEach(function (id) {
      if (id === skipKey) return;
      var value = equivalents[id];
      if (value && typeof value === 'object') value = value.label || '';
      if (!value) return;
      addLine(host, sysLabel(id), value);
    });
  }

  function paintOne(host, packed) {
    paintEquivalents(host, packed.equivalents || {}, convert.from);
    var range = rangeText(packed.range);
    var fit = fitLine(packed.range);
    if (range) addLine(host, t('sizesApproximate'), range + (fit ? ' · ' + fit : ''));
  }

  function paintResults() {
    var host = document.getElementById('convertResults');
    if (!host) return;
    host.innerHTML = '';
    var result = currentResult();
    if (!result) {
      host.appendChild(el('p', 'sh-result', '—'));
      return;
    }
    if (convert.approximate) host.appendChild(el('p', 'sh-note', t('sizesApproximate')));
    if (!result.ok) {
      host.appendChild(el('p', 'sh-note', result.reason === 'out-of-range' ? t('sizesOutOfRange') : t('sizesCannotConvert')));
      return;
    }
    if (result.neighbours) {
      if (result.between) host.appendChild(el('p', 'sh-note', t('sizesBetween')));
      result.neighbours.forEach(function (item) {
        var block = el('div', 'sh-list');
        paintOne(block, item);
        host.appendChild(block);
      });
    } else {
      paintOne(host, result);
    }
    if (result.nearest) addLine(host, t('sizesNearest'), (result.footMm || '') + ' mm');
    if ((convert.category === 'women' || convert.category === 'men') && !result.cn) {
      var person = selectedPerson();
      var m = person && person.measurements;
      if (m && m.height && m.chest) {
        var suggested = Sizes.suggestFromMeasurements({ category: convert.category, measurements: m });
        if (suggested.cn) addLine(host, t('sizesCn'), suggested.cn);
      } else {
        host.appendChild(el('p', 'sh-note', t('sizesCnMissing')));
      }
    } else if (result.cn) {
      addLine(host, t('sizesCn'), result.cn);
    }
    if (convert.category === 'bra' && result.sisters) {
      host.appendChild(el('h3', 'sh-subhead', t('sizesSister')));
      result.sisters.forEach(function (item) {
        addLine(host, sysLabel(convert.from), (item.equivalents[convert.from] || {}).label || '');
        if (convert.from !== 'uk' && item.equivalents.uk) addLine(host, sysLabel('uk'), item.equivalents.uk.label);
      });
      if (result.sistersMore && result.sistersMore.length) {
        var quiet = el('div', 'sh-quiet');
        quiet.appendChild(el('h3', 'sh-subhead', t('sizesSisterMore')));
        result.sistersMore.forEach(function (item) {
          addLine(quiet, sysLabel(convert.from), (item.equivalents[convert.from] || {}).label || '');
          if (convert.from !== 'uk' && item.equivalents.uk) addLine(quiet, sysLabel('uk'), item.equivalents.uk.label);
        });
        host.appendChild(quiet);
      }
    }
  }

  function render() {
    paintTitle();
    paintViewTabs();
    if (view === 'people') paintPeople();
    else paintConvert();
  }

  window.addEventListener('shophelper-lang', render);
  render();
})();
