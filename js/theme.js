'use strict';
try {
  var raw = localStorage.getItem('shophelper_v1');
  var settings = raw && JSON.parse(raw).settings;
  var theme = settings && settings.theme;
  var dark = theme === 'dark' || (theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.shTheme = dark ? 'dark' : 'light';
  var scale = Number(settings && settings.textScale);
  if (!isFinite(scale)) scale = 1;
  scale = Math.min(1.6, Math.max(1, Math.round(scale * 10) / 10));
  document.documentElement.style.fontSize = (16 * scale) + 'px';
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#000000' : '#f4f4f5');
} catch (e) {}
