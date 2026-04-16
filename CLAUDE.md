# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

VibeColors is a VS Code theme extension. It ships 11 static JSON themes, 6 "Dynamic" themes (`standard | vivid | muted` × `dark | light`), and 2 "Auto" themes (`auto` × `dark | light`) that rotate on a timer. The Dynamic/Auto theme JSON is (re)written at runtime by the extension host. The published extension ID is `AlexLi.vibecolors`.

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
- On activation and on every `workbench.colorTheme` config change, `ensureDynamicThemeUpToDate` checks whether the currently-selected theme is a Dynamic/Auto variant and whether its cached name matches `globalState[LAST_APPLIED_THEME_KEY]`. If stale, it triggers `refreshTheme`. `isDynamicTheme` covers both the `Dynamic` and `Auto` label prefixes.
- `applyTheme` generates a full theme object via `generateThemeConfig` and **writes JSON to `themes/VibeColors-<style>-<variant>-theme.json` inside the installed extension directory** (via `context.extensionPath`), then calls `config.update('workbench.colorTheme', ...)`. The on-disk theme files for Dynamic/Auto variants are therefore ephemeral — treat the versions committed in `themes/` as just the most recent snapshot / initial fallback.
- `suppressThemeChangeHandling` is a re-entrancy counter that prevents the `onDidChangeConfiguration` handler from re-triggering a refresh while `applyTheme` is mid-update. Always increment before `config.update('workbench.colorTheme', …)` and decrement in `finally`.
- `regenerateDynamicConfig` rewrites all eight generated theme files at once (3 Dynamic styles + Auto, × dark/light) with fresh seeds; `refreshTheme` only rewrites the one currently selected.
- `scheduleAutoRefresh` reads its interval from `vibeColors.autoThemePeriodMinutes` (default 10) when an Auto theme is active, and from `vibeColors.autoRefreshInterval` (default 0 = disabled) for Dynamic themes. Re-schedule on both config keys **and** on `workbench.colorTheme` changes, since the interval source depends on the active theme.

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
- `theme-naming.test.ts` — the string-parsing helpers (`getThemeVariantFromName`, `getThemeStyleFromName`, `getThemeName`, `getThemeFileName`, `isDynamicTheme`, `isAutoTheme`). These live in `src/theme-naming.ts` — a pure module with no `vscode` imports — so they can be unit-tested without mocking.
