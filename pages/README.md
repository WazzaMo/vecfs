# VecFS GitHub Pages (Hugo)

This directory contains the [Hugo](https://gohugo.io/) source for the VecFS project site, built for GitHub Pages. The site uses the [Hugo Book](https://github.com/alex-shpak/hugo-book) theme (Hugo module).

## Prerequisites

- [Hugo](https://gohugo.io/installation/) (v0.110+). If installed via Go, it may be at `~/go/bin/hugo`; ensure `~/go/bin` is on your PATH.

## Build

From this directory (`pages/`):

```bash
hugo --minify
```

The site uses Hugo Book as a Hugo module; the first build will download the theme.

Output is written to `public/`. To preview locally:

```bash
hugo server
```

Then open the URL shown (e.g. http://localhost:1313/). For GitHub Pages with project site base URL, use:

```bash
hugo server --baseURL http://localhost:1313/vecfs/
```

## Deploy to GitHub Pages

A GitHub Actions workflow (`.github/workflows/pages.yml`) builds and publishes this site on every push to `main`:

1. Checkout repo and run `hugo --minify` in `pages/`.
2. Upload `pages/public/` as the Pages artifact and deploy.

**One-time setup:** In the repository go to **Settings → Pages → Build and deployment**: set **Source** to **GitHub Actions**. After that, each successful run of the workflow will update the live site.

**Validating the workflow:** The workflow also runs on pull requests targeting `main`. On a PR, only the build job runs; deploy is skipped. Open a PR that touches `pages/` or the workflow file to confirm the site builds in CI before merging.

## Assets

- **Logo** — `static/logo.svg` is a copy of `vecfs-plugin/assets/logo.svg`. Set `BookLogo = 'logo.svg'` in `hugo.toml` if you want it in the sidebar; the theme can also use it as favicon via `BookFavicon`. Update the copy here if the plugin logo changes.

## Content

- **Home** — `content/_index.md` (from README.md)
- **Goals** — `content/docs/goals/_index.md` (from `../docs/goals.md`)
- **Requirements** — `content/docs/requirements/_index.md` (from docs/requirements.md)
- **Releases** — `content/docs/releases/_index.md` plus one page per release note; links to `docs/release-notes/` in the repo are listed for reference.

To add a new release note to the site: add a new file under `content/docs/releases/` (e.g. `0.1.2-Release-2026-03-01.md`) with Hugo front matter and the note body, and add a row to the table in `content/docs/releases/_index.md`.
