# TripWright public site

Privacy policy, terms and support pages for the TripWright app, served with GitHub Pages:

- https://dosh8212.github.io/tripwright-site/ (support)
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
