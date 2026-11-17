'use strict';

(function (global, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else global.ShophelperListCodec = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function bytesToB64Url(u8) {
    var bin = '';
    for (var i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
    var b64 = (typeof btoa === 'function')
      ? btoa(bin)
      : Buffer.from(u8).toString('base64');
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function b64UrlToBytes(s) {
    var b64 = String(s).replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    if (typeof atob === 'function') {
      var bin = atob(b64);
      var out = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }

  function gzipSync(u8) {
    if (typeof require === 'function') {
      try { return new Uint8Array(require('zlib').gzipSync(Buffer.from(u8))); } catch (e) {}
    }
    if (globalThis.pako && pako.gzip) return pako.gzip(u8);
    throw new Error('gzip unavailable');
  }

  function gunzipSync(u8) {
    if (typeof require === 'function') {
      try { return new Uint8Array(require('zlib').gunzipSync(Buffer.from(u8))); } catch (e) {}
    }
    if (globalThis.pako && pako.ungzip) return pako.ungzip(u8);
    throw new Error('gunzip unavailable');
  }

  function encodeShare(payload) {
    var json = JSON.stringify(payload);
    var raw = (typeof TextEncoder !== 'undefined')
      ? new TextEncoder().encode(json)
      : Uint8Array.from(Buffer.from(json, 'utf8'));
    return bytesToB64Url(gzipSync(raw));
  }

  function decodeShare(text) {
    var s = String(text || '').trim();
    // Accept raw b64 or full URL
    var fromUrl = parseUrl(s);
    if (fromUrl) s = fromUrl;
    var bytes = gunzipSync(b64UrlToBytes(s));
    var json = (typeof TextDecoder !== 'undefined')
      ? new TextDecoder().decode(bytes)
      : Buffer.from(bytes).toString('utf8');
    var payload = JSON.parse(json);
    if (!payload || payload.v !== 1 || !Array.isArray(payload.i)) throw new Error('bad payload');
    return payload;
  }

  function buildUrl(b64, baseHref) {
    var base = String(baseHref || '').split('#')[0];
    return base + '#d=' + b64;
  }

  function parseUrl(urlOrHash) {
    var s = String(urlOrHash || '');
    var m = s.match(/[#&?]d=([A-Za-z0-9\-_]+)/);
    return m ? m[1] : null;
  }

  return { encodeShare: encodeShare, decodeShare: decodeShare, buildUrl: buildUrl, parseUrl: parseUrl };
});
