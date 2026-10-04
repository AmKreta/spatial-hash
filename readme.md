# SpatialHash

SpatialHash is a uniform grid for finding nearby axis-aligned items in games, canvases, and maps. This repository is organized as a small monorepo:

- [`source/`](source/README.md) — the TypeScript library, tests, and npm package.
- [`docs/`](docs/) — Angular documentation and an interactive particle collision demo.

## Work locally

Requires Node.js 20 or newer.

```sh
npm install
npm run start -w spatialhash-docs
```

The docs site has a **Docs** guide and a **Demo** page. The demo compares every-pair collision checks with SpatialHash using two independent Web Workers and `OffscreenCanvas` instances.

## Build

```sh
npm run build:source
npm run build:docs
npm run serve:ssr
npm run build:pages
npm test
```

`npm run build:docs` builds the source workspace and the Angular server-rendered application. Start it with `npm run serve:ssr`; it listens on port 4000 by default. Deploy this output to a Node.js host for request-time SSR.

GitHub Pages serves static files, so it cannot run the SSR server. `npm run build:pages` creates prerendered `/docs` and `/demo` routes under `docs/dist/spatialhash-pages/browser` with the `/spatial-hash/` base path. The Pages workflow deploys this static build.

The Angular app is organized by responsibility under `docs/src/app`: `core` contains the shell, routing and app configuration; `features` contains the Docs and Demo pages; `shared/canvas` holds drawing code reused by the two demo workers.

## Code quality

Prettier formats TypeScript, Angular templates, styles, JSON, Markdown, and workflow files. ESLint checks TypeScript and Angular templates, including template accessibility rules.

```sh
npm run format
npm run format:check
npm run lint
```

## Publish

The `Publish source package` workflow runs on changes to `source/` on `main`. It typechecks, tests, builds, and publishes the npm package with provenance. The `Deploy documentation` workflow publishes the Angular site to GitHub Pages when docs or source files change on `main`, or when started manually. Enable **Settings → Pages → Build and deployment → GitHub Actions** in the repository for the first deployment.
