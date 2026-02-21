# VecFS GitHub Pages (Hugo)

This directory contains the [Hugo](https://gohugo.io/) source for the VecFS project site, built for GitHub Pages.

## Prerequisites

- [Hugo](https://gohugo.io/installation/) (extended edition recommended, v0.110+)

## Theme

The site uses the [Hugo Book](https://themes.gohugo.io/themes/hugo-book/) theme as a Git submodule, **pinned to v9** for compatibility with Hugo 0.123.x (newer Book tags require Hugo 0.146+). After cloning the repo, initialise submodules:

```bash
git submodule update --init --recursive
```

The submodule will be at tag `v9`. If you use a newer Hugo (0.146+) and want the latest Book theme, run `git checkout main` inside `pages/themes/hugo-book` and set `BookMenuBundle = "/menu"` (string) or remove it if using the file-tree menu; then adjust `hugo.toml` for any theme changes.

## Build

From this directory (`pages/`):

```bash
hugo --minify
```

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

1. Checkout repo with submodules (theme).
2. Install Hugo extended and run `hugo --minify` in `pages/`.
3. Upload `pages/public/` as the Pages artifact and deploy.

**One-time setup:** In the repository go to **Settings → Pages → Build and deployment**: set **Source** to **GitHub Actions**. After that, each successful run of the workflow will update the live site.

## Assets

- **Logo** — `static/logo.svg` is a copy of `vecfs-plugin/assets/logo.svg`, used as the site logo (sidebar) and favicon. Update the copy here if the plugin logo changes.

## Content

- **Home** — `content/_index.md` (from README.md)
- **Requirements** — `content/docs/requirements/_index.md` (from docs/requirements.md)
- **Releases** — `content/docs/releases/_index.md` plus one page per release note; links to `docs/release-notes/` in the repo are listed for reference.

To add a new release note to the site: add a new file under `content/docs/releases/` (e.g. `0.1.2-Release-2026-03-01.md`) with Hugo front matter and the note body, and add a row to the table in `content/docs/releases/_index.md`.
