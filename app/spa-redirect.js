// Runs before the app starts and puts the real address in place.
// Kept as a file, not inline, so production builds can forbid inline scripts.
(function() {
  var query = window.location.search.slice(1);
  // 1. From 404.html (GitHub Pages): /base/trip/x?a=1 arrives as
  //    /base/?p=base/trip/x&q=a=1 ("&" inside either part written as "~and~").
  if (query.indexOf('p=') === 0) {
    var parts = query.slice(2).split('&q=');
    var path = '/' + parts[0].replace(/~and~/g, '&');
    var search = parts[1] ? '?' + parts[1].replace(/~and~/g, '&') : '';
    window.history.replaceState(null, null, path + search + window.location.hash);
    return;
  }
  // 2. Share links: /base/trip/?id=<slug> and /base/collab/?id=<key> are real
  //    pages (so link previews work); the app reads them as /base/trip/<slug>.
  var m = window.location.pathname.match(/\/(trip|collab)\/$/);
  var id = m && /(?:^|&)id=([A-Za-z0-9_-]{1,200})(?:&|$)/.exec(query);
  if (id) {
    window.history.replaceState(null, null, window.location.pathname + id[1] + window.location.hash);
  }
})();
