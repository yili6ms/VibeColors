# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

VibeColors is a VS Code theme extension. It ships 11 static JSON themes, 6 "Dynamic" themes (`standard | vivid | muted` × `dark | light`), 2 "Auto" themes (`auto` × `dark | light`) that rotate on a timer, and 2 "Shuffle" themes (`dark | light`) that rotate through a playlist of static themes, user theme files and seeds. The Dynamic/Auto/Shuffle theme JSON is (re)written at runtime by the extension host. The published extension ID is `AlexLi.vibecolors`.

## Commands

```bash
npm install              # also wires .githooks via scripts/setup-hooks.js (skipped on CI)
npm run compile          # tsc -p ./  → out/
npm run watch            # tsc -watch
npm test                 # runs compiled node ./out/tests/color-utils.test.js (requires compile first)
npx vitest run           # runs the vitest suite under src/__tests__/ (NOT invoked by `npm test`)
npx vsce package         # build .vsix; `vscode:prepublish` chains version:bump + compile
```

Press **F5** in VS Code to launch an Extension Development Host using `.vscode/launch.json` (uses the `npm: compile` preLaunchTask). There is no lint step — `npm run lint` is a no-op echo.

## Architecture

### Two parallel palette modules — do not merge blindly
- `src/color-utils.ts` — used by the **runtime extension** (`extension.ts`). Exports `PaletteStyle` and a 3-arg `makePalette(rng, variant, style)` with the `applyStyle` saturation/lightness shifts for vivid/muted.
- `src/palette.ts` — used **only** by the vitest suite. Has a 2-arg `makePalette(rng, variant)` with no style support and its own `withOpacity` that strips an existing alpha channel before appending.
- `tsconfig.json` excludes `src/__tests__/` from the production build, which is why the vitest-only `palette.ts` can diverge without breaking `npm run compile`. If you change palette generation, update **both** files or the two test suites will disagree.

### Runtime theme generation (`src/extension.ts`)
- **Every generated theme contribution in `package.json` must keep `"_watch": true`.** It is VS Code's (undocumented) switch that makes the workbench reload the *active* theme when its file changes. Without it, rewriting the file of the theme that is already selected never repaints in an installed extension, because `config.update('workbench.colorTheme', <same name>)` is a no-op. The Extension Development Host (F5) watches theme files regardless, so a missing `_watch` only shows up in a packaged `.vsix`. `src/__tests__/theme-file.test.ts` enforces this.
- `generateThemeConfig` (palette → theme JSON) and the `vibeColorsPalette` metadata helpers live in `src/theme-config.ts`, a pure module shared by the Dynamic/Auto and Shuffle code (`theme-config.test.ts`).
- On activation and on every `workbench.colorTheme` config change, `ensureDynamicThemeUpToDate` checks whether the currently-selected theme is a Dynamic/Auto variant and whether its cached name matches `globalState[LAST_APPLIED_THEME_KEY]`. If stale, it triggers `refreshTheme`. `isDynamicTheme` covers both the `Dynamic` and `Auto` label prefixes.
- `applyTheme` generates a full theme object via `generateThemeConfig` and **writes JSON to `themes/VibeColors-<style>-<variant>-theme.json` inside the installed extension directory** (via `context.extensionPath`), then calls `config.update('workbench.colorTheme', ...)`. The on-disk theme files for Dynamic/Auto variants are therefore ephemeral — treat the versions committed in `themes/` as just the most recent snapshot / initial fallback.
- `suppressThemeChangeHandling` is a re-entrancy counter that prevents the `onDidChangeConfiguration` handler from re-triggering a refresh while `applyTheme` is mid-update. Always increment before `config.update('workbench.colorTheme', …)` and decrement in `finally`.
- `regenerateDynamicConfig` rewrites all eight generated theme files at once (3 Dynamic styles + Auto, × dark/light) with fresh seeds; `refreshTheme` only rewrites the one currently selected.
- `scheduleAutoRefresh` reads its interval from `vibeColors.autoThemePeriodMinutes` (default 10) when an Auto theme is active, and from `vibeColors.autoRefreshInterval` (default 0 = disabled) for Dynamic themes. Re-schedule on both config keys **and** on `workbench.colorTheme` changes, since the interval source depends on the active theme.

### Shuffle themes (`src/shuffle*.ts`, `src/theme-file.ts`)
- `isShuffleTheme` names (`VibeColors Shuffle Dark|Light`) are deliberately **not** matched by `isDynamicTheme`, so the Dynamic refresh/auto-refresh paths leave them alone. `switchVariant` and `savePalette` in `extension.ts` delegate to the controller while a Shuffle theme is active.
- `src/shuffle.ts` (pure): `CURATED_SEEDS` (pre-generated seeds picked for WCAG contrast and hue spread — a test re-checks their contrast if the generator changes), seed parsing (`"hex"` / `"hex:style"`), `buildShuffleEntries` (sources → per-variant, de-duplicated entries; random entries are derived from the session seed) and `ShufflePlaylist` (seeded shuffle, reshuffled each round, no back-to-back repeats).
- `src/theme-file.ts` (pure Node): JSONC parsing, `include` inlining, dark/light inference from `type` or editor background, user path resolution. Built-in `VibeColors-dark/light-theme.json` contain comments, so never `JSON.parse` theme files directly.
- `src/shuffle-controller.ts` owns the playlists, timer, status bar item, commands and quick-pick preview. It writes `themes/VibeColors-shuffle-<variant>-theme.json`. VS Code caches theme files it has already loaded, so the controller rewrites the file whenever a Shuffle theme becomes active — in `onDidChangeActiveColorTheme`, which fires only after VS Code has attached its file watcher. All file/playlist work goes through its `enqueue` queue.
- **Multiple windows share the one theme file** (each window has its own extension host), so they share one session via `<globalStorage>/shuffle-state.json` (seed, `startedAt`, and per variant the current entry's id, switch time and full descriptor) and a `shuffle-heartbeat` file whose mtime marks liveness. On start a window joins any live session (even one reshuffled away from a configured seed) or creates one under a `.lock` file. Decisions that every window makes at the same moment — switching into Shuffle, settings rebuilds, configured-seed restarts, timed switches — run under that lock (`withLock`/`tryLock`) after `syncShared()`, so later windows follow the earlier window's pick. A switch records the shared state *before* rewriting the theme file; the resulting reload reaches other windows as `onDidChangeActiveColorTheme` → `syncShared`. Windows can have different playlists (e.g. `${workspaceFolder}` theme files), so a shared entry missing locally is `adopt`ed from its descriptor (`ShufflePlaylist.contains` ignores adopted entries, and `decideRebuild` re-picks after a settings change only when this window's own sources dropped the entry). Picker previews are not recorded and the rotation timer is paused while the picker is open.
- With `_watch`, the Auto/Dynamic themes have the same multi-window issues: the `autoRefreshTimer` waits a random de-phasing delay and skips a tick when the theme file was written within the interval (`wasThemeFileWrittenWithin`), and generated files embed `vibeColorsPalette` metadata (`withPaletteMetadata`) so "Save Current Palette" saves what the shared file shows rather than this window's `lastGeneratedSeed`.

### Palette generation (`color-utils.ts`)
- Seeded via `mulberry32`; seeds are 32-bit ints surfaced in user-facing messages as hex. The same seed + variant + style is reproducible across machines.
- Hues are chosen using the golden angle (137.508°) to derive four harmonious hues from a random base hue.
- `applyStyle` mutates HSL ranges: `vivid` pushes saturation/lightness up, `muted` pulls them down, with variant-specific sign flips for background lightness so dark themes still read as dark. `standard` and `auto` share the same untouched ranges — the `auto` style is a marker used only so `scheduleAutoRefresh` can pick the right interval source.
- `withOpacity` and `adjustBrightness` both `stripAlpha` first, so passing an already-`#RRGGBBAA` value (e.g., `palette.selection`, `palette.highlight`) is safe and idempotent. Before that was fixed, stacking `withOpacity` produced invalid 11-char hex strings that VS Code silently discarded.

### Legacy script
`generate-dynamic-colors.js` at the repo root is a pre-extension standalone generator. It is **not** wired into the build, tests, or extension runtime — leave it alone unless explicitly asked.

## Release flow

- `.githooks/pre-push` runs `npm version patch --no-git-tag-version`, commits `package.json` + `package-lock.json` as `chore: bump version to X`, and then **aborts the push with exit 1** asking you to re-run `git push`. This is intentional — the bump commit must be included in the pushed range. Skip with `VIBECOLORS_SKIP_VERSION_BUMP=1` or `SKIP_VERSION_BUMP=1`. The hook is also skipped if the last commit already modified `package.json`/`package-lock.json` or if the working tree is dirty (fails loudly).
- `scripts/bump-version.js` runs via `vscode:prepublish` and does the same bump locally; it no-ops under `CI=true`.
- GitHub Actions (`.github/workflows/ci.yml`) builds on push/PR and, on `v*` tags, uploads the `.vsix` as a GitHub Release asset.

## Tests

All tests are under `src/__tests__/` and run via `vitest run` (what `npm test` invokes after `tsc -p ./` via pretest). `tsconfig.json` excludes `src/__tests__/` from the production build; vitest transforms TS itself.

- `color-utils.test.ts` — primitives: `mulberry32`, `hslToHex`, `adjustBrightness`, `withOpacity`.
- `palette.test.ts` — `makePalette` determinism, hex-shape contract, style differentiation.
- `theme-naming.test.ts` — the string-parsing helpers (`getThemeVariantFromName`, `getThemeStyleFromName`, `getThemeName`, `getThemeFileName`, `isDynamicTheme`, `isAutoTheme`, and the Shuffle helpers). These live in `src/theme-naming.ts` — a pure module with no `vscode` imports — so they can be unit-tested without mocking.
- `shuffle.test.ts` — seed parsing, playlist building per source, `ShufflePlaylist` ordering guarantees, cross-window session helpers, curated-seed contrast.
- `theme-file.test.ts` — JSONC/`include` loading, variant inference, path resolution, and that every shipped static theme loads and every generated theme declares `_watch`.
