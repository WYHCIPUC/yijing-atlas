# Repository Guidelines

## Project Structure & Module Organization

The active application is a dependency-free static site under `web/`. `web/index.html` is the entry point, `web/js/` contains ES modules, `web/styles/main.css` holds shared styles, and `web/data/` stores the hexagram and almanac JSON datasets. Data-generation utilities live in `web/tool/`. Web-focused tests are in `web/test/`; broader almanac regression and rendering tests are in `test/almanac/`. Design records and implementation plans belong in `docs/specs/` and `docs/plans/`. Treat `legacy-flutter/` as archived code unless a task explicitly targets it. Root PDF files are source references, not runtime assets.

## Build, Test, and Development Commands

There is no build step or package installation for the web app. Use Node.js 22 or newer.

```bash
npm start
```

Open `http://localhost:3030/`; do not use `file://`, because JSON loading depends on HTTP. On Windows, `web/serve.bat` provides the same development server.

Use the repository scripts for verification:

```bash
npm test
npm run test:coverage
npm run validate
```

`npm run validate` is the release gate. The archived Flutter app can be checked from `legacy-flutter/` with `flutter test` and `flutter analyze` when modified.

## Coding Style & Naming Conventions

Follow existing native HTML/CSS/JavaScript patterns: two-space indentation, semicolons, single-quoted JavaScript strings, and ES module `import`/`export`. Use `camelCase` for variables and functions, `PascalCase` only for classes, and kebab-case filenames such as `star-relations.js`. Keep calculations in pure logic modules and DOM work in page/render modules. Preserve the six-bit, bottom-to-top hexagram representation (for example, Qian is `111111`). Avoid adding dependencies or a build system without prior agreement.

## Testing Guidelines

Tests are self-contained Node scripts with `.test.mjs` names. Add regression coverage beside the affected module or under `test/almanac/`. Cover invalid inputs, boundary dates, data integrity, and known calendrical fixtures. The quality runner supplies the required working directories.

## Commit & Pull Request Guidelines

Use the repository’s Conventional Commit pattern: `feat: ...`, `fix: ...`, or a scoped form such as `feat(star-map): ...`. Keep commits focused and describe the user-visible outcome. Pull requests should summarize behavior changes, list commands actually run, link related issues or design documents, and include screenshots for visual changes. Call out dataset or calendrical-algorithm changes and any unverified risks.
