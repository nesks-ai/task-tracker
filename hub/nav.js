/* Shared app switcher: a slim bar at the top of every app (Home · Replies · OQ ·
   Board · Tracker). Loaded with <script src=".../hub/nav.js" defer> from each app.
   It sits in normal flow above the app's own sticky header, so it scrolls away and
   never covers anything. Colours are derived from the page's text colour, so it
   follows each app's light/dark theme without knowing how that app toggles it. */
(function () {
  if (document.getElementById('hubnav')) return;
  const me = document.currentScript || document.querySelector('script[src$="hub/nav.js"]');
  const hub = new URL('./', me.src);           // .../task-tracker/hub/
  const root = new URL('../', hub);             // .../task-tracker/
  const links = [
    ['⌂ Home', hub], ['Replies', new URL('ar/', root)], ['OQ', new URL('oq/', root)],
    ['Board', new URL('board/', root)], ['Tracker', root],
  ];
  const here = location.pathname.replace(/index\.html$/, '');

  const css = document.createElement('style');
  css.textContent =
    '#hubnav{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;padding:6px 12px;' +
    'font:500 13px/1 system-ui,-apple-system,"Segoe UI",sans-serif;' +
    'border-bottom:1px solid color-mix(in srgb,currentColor 12%,transparent)}' +
    '#hubnav::-webkit-scrollbar{display:none}' +
    '#hubnav a{flex:none;padding:7px 11px;border-radius:999px;color:inherit;text-decoration:none;opacity:.72}' +
    '#hubnav a:active{opacity:1}' +
    '#hubnav a[aria-current]{opacity:1;font-weight:600;background:color-mix(in srgb,currentColor 11%,transparent)}';
  document.head.appendChild(css);

  const nav = document.createElement('nav');
  nav.id = 'hubnav';
  nav.setAttribute('aria-label', 'Apps');
  for (const [label, url] of links) {
    const a = document.createElement('a');
    a.href = url.href;
    a.textContent = label;
    if (url.pathname === here) a.setAttribute('aria-current', 'page');
    nav.appendChild(a);
  }
  document.body.prepend(nav);
})();
