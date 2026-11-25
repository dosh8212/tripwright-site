# TripWright public site

Landing page, privacy policy, terms and support for the TripWright app, served with GitHub Pages:

- https://dosh8212.github.io/tripwright-site/ (landing page; the support section is `#support`, the store's Support URL)
- https://dosh8212.github.io/tripwright-site/privacy/
- https://dosh8212.github.io/tripwright-site/terms/

The source of truth is `site/` in the private app repo; copy changes from there. Keep the text in
step with the in-app pages and update the "Last updated" date when it changes.

## The web app (`app/`) and trip links

Share links from the app open `https://dosh8212.github.io/tripwright-site/app/...`
(`/trip/<slug>`, `/collab/<key>`, `/shared?t=...`). `app/` is the web build of the app
(`npm run build:site` in the app repo). The app repo's `publish-web.yml` workflow replaces it
on every push to main once its `SITE_DEPLOY_TOKEN` secret is set. `404.html` sends trip
addresses to `app/` (GitHub Pages has no rewrites), and `.nojekyll` serves every file as is.

## Images

Only images the site or web app load (icons, `og-image.jpg`) belong here. Don't commit preview or feature screenshots.

## Landing page

`index.html` + `landing.css` + `js/` are the landing page: a scroll film where a seabird flies from
island to island over a 3D sea (three.js, vendored in `vendor/` with its MIT licence). Each island is
one feature; its card rises in while the bird circles it, and the sky runs from dawn to night and back.

- `js/main.js` turns the scroll position into a film position and shows the right card.
- `js/world.js` draws the sky, clouds, lights, shadows and the camera's flight. `js/ocean.js` is the sea:
  Gerstner swell, ripples, sky reflections, sun glitter and clear water that shows the seabed (drawn first
  into a texture) tinted by depth, with foam along the shores. `js/terrain.js` makes natural island
  terrain, palms, jungle and boulders, with light caustics on the seabed; `js/islands.js` builds the
  seven islands and their landmarks; `js/bird.js` builds the gull (smooth body, painted feathers, wings that bend at the wrist) and flaps it. Everything is made in code, no models or images.
- Without WebGL, or with reduced motion turned on, the same content shows as a normal stacked page.
- No third-party requests: three.js and the Fraunces heading font (SIL OFL, `fonts/`) are served from here.
- Keep the `#support` section and its email address: the App Store listing's Support URL points here.
  `style.css` is still used by `privacy/`, `terms/` and `404.html`.
