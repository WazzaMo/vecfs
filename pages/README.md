# VecFS GitHub Pages (Hugo)

This directory contains the [Hugo](https://gohugo.io/) source for the VecFS project site, built for GitHub Pages.

## Prerequisites

- [Hugo](https://gohugo.io/installation/) (extended edition recommended, v0.110+)

## Theme

The site uses the [Hugo Book](https://themes.gohugo.io/themes/hugo-book/) theme as a Git submodule. After cloning the repo, initialise submodules:

```bash
git submodule update --init --recursive
```

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

1. Build: `hugo --minify`
2. Deploy the contents of `public/` to the branch or directory your repository uses for GitHub Pages (e.g. `gh-pages` branch, or `docs/` on the default branch, depending on repo settings).

If you use GitHub Actions, add a workflow that runs `hugo --minify` from `pages/` and publishes `pages/public/` to the Pages branch or folder.

## Content

- **Home** — `content/_index.md` (from README.md)
- **Requirements** — `content/docs/requirements/_index.md` (from docs/requirements.md)
- **Releases** — `content/docs/releases/_index.md` plus one page per release note; links to `docs/release-notes/` in the repo are listed for reference.

To add a new release note to the site: add a new file under `content/docs/releases/` (e.g. `0.1.2-Release-2026-03-01.md`) with Hugo front matter and the note body, and add a row to the table in `content/docs/releases/_index.md`.
