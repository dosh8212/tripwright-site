// SPA redirect handler: receives the redirect from 404.html (GitHub Pages).
// 404.html sends /base/trip/x?a=1 here as /base/?p=base/trip/x&q=a=1 ("&" inside
// either part written as "~and~"); this puts the real address back before the
// app starts. Kept as a file, not inline, so production builds can forbid
// inline scripts.
(function() {
  var query = window.location.search.slice(1);
  if (query.indexOf('p=') !== 0) return;
  var parts = query.slice(2).split('&q=');
  var path = '/' + parts[0].replace(/~and~/g, '&');
  var search = parts[1] ? '?' + parts[1].replace(/~and~/g, '&') : '';
  window.history.replaceState(null, null, path + search + window.location.hash);
})();
