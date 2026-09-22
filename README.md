# Matthew Scholefield

A small personal index of apps, open-source projects, and ways to say hi. React, TypeScript, Vite, Tailwind, and selected shadcn/ui components; a static root page with no server or browser-side GitHub API calls.

## Development

Use current Node LTS/npm and an authenticated GitHub CLI (`gh auth login`).

```sh
npm ci
npm run catalog:inventory
npm run test:catalog
npm run build
npm run preview -- --host 127.0.0.1
```

After the first content sync, `npm run dev` serves the application without fetching GitHub again. `npm run catalog:sync` refreshes generated content independently.

## Content

- `content/site.ts`: introduction, contact links, business identity, and featured apps.
- `content/catalog.json`: exact repository identities, categories, ordering, and explicit exclusion reasons. Every reviewed candidate is recorded. New repositories remain unpublished until reviewed.
- `npm run catalog:inventory`: fetches public non-fork personal repositories and explicitly curated organization repositories. Raw preferred READMEs and provenance are available under ignored `.cache/github/` for editorial review. A missing README remains an eligible candidate.
- `npm run build`: fetches current descriptions and GitHub-rendered READMEs, sanitizes them, and builds the site. Descriptions and README content belong to GitHub; do not copy them into editorial configuration.

`src/generated/catalog.json` and `public/generated/readmes/` are ignored build outputs. README bodies have content-hashed URLs and load only when opened. Failed API requests fail the build; only README 404s represent absent content. Focused Node tests cover publication filtering, error distinctions, sanitization, and link resolution.

## Publishing

The default branch remains `master`. `.github/workflows/deploy.yml` builds on pushes, manual dispatch, and daily at 06:17 UTC. GitHub Pages must use **GitHub Actions** as its source. Only `dist/` is uploaded; the build step uses the standard GitHub Actions token for public API reads.

Recursive Corruption links only to its GitHub organization; there is no Google Play link or store-link configuration. LinkedIn retains the historical profile URL, which currently opens an authentication wall in a logged-out browser.

A failed workflow leaves the last successful deployment in place. GitHub can delay scheduled runs and may disable public-repository schedules after 60 days without activity; re-enable the workflow and dispatch it manually if needed. Independent project Pages sites such as `/spectria/` remain separate deployments; this application adds no catch-all redirects.

## History and license

The former OpenSpace-based site is preserved on the `legacy-homepage` branch at `7580711`. It originated from [EverythingMe/OpenSpace](https://github.com/EverythingMe/openspace); its runtime and Python content pipeline have been removed from this branch. `LICENSE.txt` retains the existing Apache 2.0 license. New UI primitives come from [shadcn/ui](https://ui.shadcn.com/) (MIT).
