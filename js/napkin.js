'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./decimal'));
  else root.ShophelperNapkin = factory(root.ShophelperDecimal);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (decimal) {
  function evaluateExpression(expr) {
    var tokens = expr.match(/\d+(?:\.\d+)?|[+\-*/()]/g);
    if (!tokens || !tokens.length) return null;
    var pos = 0;
    function peek() { return tokens[pos]; }
    function consume() { return tokens[pos++]; }
    function parseExpr() {
      var value = parseTerm();
      if (value == null) return null;
      while (peek() === '+' || peek() === '-') {
        var op = consume();
        var right = parseTerm();
        if (right == null) return null;
        value = op === '+' ? decimal.add(value, right) : decimal.sub(value, right);
        if (value == null) return null;
      }
      return value;
    }
    function parseTerm() {
      var value = parseFactor();
      if (value == null) return null;
      while (peek() === '*' || peek() === '/') {
        var op = consume();
        var right = parseFactor();
        if (right == null) return null;
        value = op === '*' ? decimal.mul(value, right) : decimal.div(value, right);
        if (value == null) return null;
      }
      return value;
    }
    function parseFactor() {
      if (peek() === '(') {
        consume();
        var value = parseExpr();
        if (peek() === ')') consume();
        else return null;
        return value;
      }
      if (!peek() || !/^\d/.test(peek())) return null;
      return decimal.format(decimal.parse(consume()));
    }
    var value = parseExpr();
    if (value == null || pos !== tokens.length) return null;
    return value;
  }

  function findContiguousExpression(line) {
    var runs = line.match(/[0-9.,\s+\-*/×÷xX()]+/g) || [];
    var best = null;
    runs.forEach(function (run) {
      var trimmed = run.trim();
      if (/\d/.test(trimmed) && /[+\-*/×÷xX]/.test(trimmed)) {
        if (!best || trimmed.length > best.length) best = trimmed;
      }
    });
    if (!best) return null;
    return best.replace(/,/g, '').replace(/[×xX]/g, '*').replace(/÷/g, '/');
  }

  function findOperatorInGap(gap) {
    var symbol = gap.match(/[+\-*/×÷]/);
    if (symbol) {
      var s = symbol[0];
      if (s === '×') return '*';
      if (s === '÷') return '/';
      return s;
    }
    if (/(?:^|\s)[xX](?:\s|$)/.test(gap)) return '*';
    return null;
  }

  function findGapChainedExpression(line) {
    var numbers = [];
    var re = /\d[\d,]*(?:\.\d+)?/g;
    var m;
    while ((m = re.exec(line))) numbers.push({ text: m[0], index: m.index });
    if (numbers.length < 2) return null;
    var chain = [];
    var last = null;
    function flush() {
      if (chain.length >= 3) last = chain.join('');
      chain = [];
    }
    for (var i = 0; i < numbers.length; i++) {
      if (!chain.length) chain.push(numbers[i].text.replace(/,/g, ''));
      if (i === numbers.length - 1) break;
      var gapStart = numbers[i].index + numbers[i].text.length;
      var gapEnd = numbers[i + 1].index;
      var op = findOperatorInGap(line.slice(gapStart, gapEnd));
      if (op) chain.push(op, numbers[i + 1].text.replace(/,/g, ''));
      else flush();
    }
    flush();
    return last;
  }

  function classifyLine(line) {
    var text = String(line == null ? '' : line);
    if (!text.trim() || /^\s*#/.test(text) || /^\s*note\s*:/i.test(text)) return { kind: 'note' };
    var contiguous = findContiguousExpression(text);
    if (contiguous) {
      var result = evaluateExpression(contiguous);
      if (result != null) return { kind: 'math', value: result };
    }
    var chained = findGapChainedExpression(text);
    if (chained) {
      var chainedResult = evaluateExpression(chained);
      if (chainedResult != null) return { kind: 'math', value: chainedResult };
    }
    var bare = text.trim().match(/^(?:[$€£¥]|[A-Z]{3})?\s*(\d+(?:\.\d+)?)\s*(?:[$€£¥]|[A-Z]{3})?$/);
    if (bare) {
      var value = decimal.format(decimal.parse(bare[1]));
      if (value != null) return { kind: 'bare', value: value };
    }
    return { kind: 'note' };
  }

  function lines(text) {
    return String(text == null ? '' : text).split(/\r?\n/).map(function (textLine) {
      return { text: textLine, result: classifyLine(textLine) };
    });
  }

  function total(text) {
    var sum = '0';
    var any = false;
    lines(text).forEach(function (line) {
      if (line.result.kind === 'math' || line.result.kind === 'bare') {
        sum = decimal.add(sum, line.result.value);
        any = true;
      }
    });
    return any ? sum : '0';
  }

  return { classifyLine: classifyLine, lines: lines, total: total };
});
