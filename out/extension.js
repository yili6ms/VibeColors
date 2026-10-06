"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const color_utils_1 = require("./color-utils");
const shuffle_controller_1 = require("./shuffle-controller");
const theme_config_1 = require("./theme-config");
const theme_naming_1 = require("./theme-naming");
let autoRefreshTimer;
let extensionContext;
let suppressThemeChangeHandling = 0;
let lastGeneratedSeed;
let lastGeneratedVariant;
let lastGeneratedStyle;
let shuffleController;
const LAST_APPLIED_THEME_KEY = 'vibeColors.lastAppliedTheme';
function getExtensionPath() {
    return extensionContext?.extensionPath;
}
function getLastAppliedTheme() {
    return extensionContext?.globalState.get(LAST_APPLIED_THEME_KEY);
}
async function rememberAppliedTheme(themeName) {
    await extensionContext?.globalState.update(LAST_APPLIED_THEME_KEY, themeName);
}
async function clearRememberedTheme() {
    await extensionContext?.globalState.update(LAST_APPLIED_THEME_KEY, undefined);
}
async function ensureDynamicThemeUpToDate(options = {}) {
    if (!extensionContext) {
        return;
    }
    const currentTheme = vscode.workspace.getConfiguration().get('workbench.colorTheme', '');
    if (!currentTheme) {
        return;
    }
    if (!(0, theme_naming_1.isDynamicTheme)(currentTheme)) {
        if (getLastAppliedTheme()) {
            await clearRememberedTheme();
        }
        return;
    }
    if (getLastAppliedTheme() === currentTheme) {
        return;
    }
    await refreshTheme(undefined, { silent: options.silent ?? true });
}
// --- Theme Application ------------------------------------------------------
async function applyTheme(palette, variant = 'dark', style = 'standard', seed) {
    const extensionPath = getExtensionPath();
    if (!extensionPath) {
        vscode.window.showErrorMessage('VibeColors extension path is not available');
        return;
    }
    const themeName = (0, theme_naming_1.getThemeName)(variant, style);
    const baseConfig = (0, theme_config_1.generateThemeConfig)(palette, themeName, variant === 'dark');
    const themeConfig = seed === undefined ? baseConfig : (0, theme_config_1.withPaletteMetadata)(baseConfig, { seed, variant, style });
    const themeFileName = (0, theme_naming_1.getThemeFileName)(variant, style);
    const themePath = path.join(extensionPath, 'themes', themeFileName);
    try {
        // Ensure themes directory exists
        const themesDir = path.dirname(themePath);
        if (!fs.existsSync(themesDir)) {
            fs.mkdirSync(themesDir, { recursive: true });
        }
        // Write the theme file
        fs.writeFileSync(themePath, JSON.stringify(themeConfig, null, '\t'));
        // Apply the theme
        const config = vscode.workspace.getConfiguration();
        suppressThemeChangeHandling += 1;
        await config.update('workbench.colorTheme', themeName, vscode.ConfigurationTarget.Global);
        await rememberAppliedTheme(themeName);
        console.log(`Applied dynamic ${variant} theme with palette:`, palette);
    }
    catch (error) {
        vscode.window.showErrorMessage(`Failed to apply dynamic theme: ${error}`);
    }
    finally {
        suppressThemeChangeHandling = Math.max(0, suppressThemeChangeHandling - 1);
    }
}
// --- Commands ---------------------------------------------------------------
async function refreshTheme(variant, options = {}) {
    const config = vscode.workspace.getConfiguration('vibeColors');
    const newSeed = Math.floor(Math.random() * 0xffffffff);
    const rng = (0, color_utils_1.mulberry32)(newSeed);
    const currentTheme = vscode.workspace.getConfiguration().get('workbench.colorTheme', '');
    // Save the seed if persistence is enabled
    if (config.get('persistSeed', false)) {
        await config.update('lastSeed', newSeed, vscode.ConfigurationTarget.Global);
    }
    // Determine which variant to apply
    if (!variant) {
        variant = (0, theme_naming_1.getThemeVariantFromName)(currentTheme);
    }
    const style = options.style ?? (0, theme_naming_1.getThemeStyleFromName)(currentTheme);
    const palette = (0, color_utils_1.makePalette)(rng, variant, style);
    lastGeneratedSeed = newSeed;
    lastGeneratedVariant = variant;
    lastGeneratedStyle = style;
    await applyTheme(palette, variant, style, newSeed);
    if (!options.silent) {
        vscode.window.showInformationMessage(`Dynamic Theme: ${variant} palette refreshed with seed ${newSeed.toString(16)}.`);
    }
}
async function switchVariant() {
    const currentTheme = vscode.workspace.getConfiguration().get('workbench.colorTheme', '');
    if ((0, theme_naming_1.isShuffleTheme)(currentTheme) && shuffleController) {
        await shuffleController.switchVariant();
        return;
    }
    const currentVariant = (0, theme_naming_1.getThemeVariantFromName)(currentTheme);
    const newVariant = currentVariant === 'light' ? 'dark' : 'light';
    const style = (0, theme_naming_1.getThemeStyleFromName)(currentTheme);
    await refreshTheme(newVariant, { style });
}
async function saveCurrentPalette() {
    const config = vscode.workspace.getConfiguration('vibeColors');
    const shuffleCurrent = shuffleController?.getCurrentEntry();
    if (shuffleCurrent) {
        const { entry, variant } = shuffleCurrent;
        if (entry.kind !== 'seed') {
            vscode.window.showInformationMessage(`The Shuffle theme is showing "${entry.label}", a theme file rather than a generated palette, so there is no seed to save.`);
            return;
        }
        // Keep a palette the Shuffle theme is showing; it then joins the
        // "savedPalettes" shuffle source as well.
        const savedPalettes = config.get('savedPalettes', []);
        const timestamp = new Date().toISOString();
        savedPalettes.push({ name: entry.label, seed: entry.seed, timestamp, variant, style: entry.style });
        await config.update('savedPalettes', savedPalettes, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Saved palette: ${entry.label}`);
        return;
    }
    const currentTheme = vscode.workspace.getConfiguration().get('workbench.colorTheme', '');
    // The shared theme file is what every window shows; this window may not
    // have generated the latest palette itself.
    const shown = (0, theme_naming_1.isDynamicTheme)(currentTheme) ? readShownPalette(currentTheme) : undefined;
    const persistedSeed = config.get('lastSeed');
    const seed = shown?.seed ?? lastGeneratedSeed ?? (persistedSeed && persistedSeed !== 0 ? persistedSeed : undefined);
    if (seed === undefined) {
        vscode.window.showInformationMessage('No dynamic palette has been generated yet. Run "VibeColors: Refresh Dynamic Theme" first.');
        return;
    }
    const variant = shown?.variant ?? lastGeneratedVariant ?? (0, theme_naming_1.getThemeVariantFromName)(currentTheme);
    const style = shown?.style ?? lastGeneratedStyle ?? (0, theme_naming_1.getThemeStyleFromName)(currentTheme);
    const savedPalettes = config.get('savedPalettes', []);
    const timestamp = new Date().toISOString();
    const paletteName = `Palette ${timestamp.slice(0, 10)} ${timestamp.slice(11, 19)}`;
    savedPalettes.push({ name: paletteName, seed, timestamp, variant, style });
    await config.update('savedPalettes', savedPalettes, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage(`Saved palette: ${paletteName}`);
}
async function loadSavedPalette() {
    const config = vscode.workspace.getConfiguration('vibeColors');
    const savedPalettes = config.get('savedPalettes', []);
    if (savedPalettes.length === 0) {
        vscode.window.showInformationMessage('No saved palettes found');
        return;
    }
    const items = savedPalettes.map(p => ({
        label: p.name,
        description: `Seed: ${p.seed.toString(16)}`,
        palette: p
    }));
    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a saved palette'
    });
    if (!selected) {
        return;
    }
    const currentTheme = vscode.workspace.getConfiguration().get('workbench.colorTheme', '');
    const variant = selected.palette.variant ?? (0, theme_naming_1.getThemeVariantFromName)(currentTheme);
    const style = selected.palette.style ?? (0, theme_naming_1.getThemeStyleFromName)(currentTheme);
    const rng = (0, color_utils_1.mulberry32)(selected.palette.seed);
    const palette = (0, color_utils_1.makePalette)(rng, variant, style);
    lastGeneratedSeed = selected.palette.seed;
    lastGeneratedVariant = variant;
    lastGeneratedStyle = style;
    await applyTheme(palette, variant, style, selected.palette.seed);
    if (config.get('persistSeed', false)) {
        await config.update('lastSeed', selected.palette.seed, vscode.ConfigurationTarget.Global);
    }
    vscode.window.showInformationMessage(`Loaded palette: ${selected.label}`);
}
async function regenerateDynamicConfig() {
    const extensionPath = getExtensionPath();
    if (!extensionPath) {
        vscode.window.showErrorMessage('VibeColors extension path is not available');
        return;
    }
    try {
        vscode.window.showInformationMessage('Regenerating dynamic configuration...');
        const themesDir = path.join(extensionPath, 'themes');
        if (!fs.existsSync(themesDir)) {
            fs.mkdirSync(themesDir, { recursive: true });
        }
        const config = vscode.workspace.getConfiguration('vibeColors');
        const styles = ['standard', 'vivid', 'muted', 'auto'];
        const variants = ['dark', 'light'];
        const currentTheme = vscode.workspace.getConfiguration().get('workbench.colorTheme', '');
        const activeVariant = (0, theme_naming_1.getThemeVariantFromName)(currentTheme);
        const activeStyle = (0, theme_naming_1.getThemeStyleFromName)(currentTheme);
        let seedToPersist;
        for (const style of styles) {
            for (const variant of variants) {
                const seed = Math.floor(Math.random() * 0xffffffff);
                const rng = (0, color_utils_1.mulberry32)(seed);
                const palette = (0, color_utils_1.makePalette)(rng, variant, style);
                const themeName = (0, theme_naming_1.getThemeName)(variant, style);
                const themeConfig = (0, theme_config_1.withPaletteMetadata)((0, theme_config_1.generateThemeConfig)(palette, themeName, variant === 'dark'), { seed, variant, style });
                const themeFileName = (0, theme_naming_1.getThemeFileName)(variant, style);
                fs.writeFileSync(path.join(themesDir, themeFileName), JSON.stringify(themeConfig, null, '\t'));
                if (variant === activeVariant && style === activeStyle) {
                    seedToPersist = seed;
                    lastGeneratedSeed = seed;
                    lastGeneratedVariant = variant;
                    lastGeneratedStyle = style;
                }
            }
        }
        if (config.get('persistSeed', false) && seedToPersist !== undefined) {
            await config.update('lastSeed', seedToPersist, vscode.ConfigurationTarget.Global);
        }
        vscode.window.showInformationMessage('Dynamic configuration regenerated! Reload VS Code or switch themes to see changes.');
    }
    catch (error) {
        vscode.window.showErrorMessage(`Failed to regenerate dynamic configuration: ${error}`);
    }
}
function clearAutoRefreshTimer() {
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
        autoRefreshTimer = undefined;
    }
}
function scheduleAutoRefresh() {
    clearAutoRefreshTimer();
    const config = vscode.workspace.getConfiguration('vibeColors');
    const currentTheme = vscode.workspace.getConfiguration().get('workbench.colorTheme', '');
    // Auto themes rotate on their own schedule; Dynamic themes rotate only
    // when the user opts in via vibeColors.autoRefreshInterval.
    const intervalMinutes = (0, theme_naming_1.isAutoTheme)(currentTheme)
        ? config.get('autoThemePeriodMinutes', 10)
        : config.get('autoRefreshInterval', 0);
    if (!intervalMinutes || intervalMinutes <= 0) {
        return;
    }
    const intervalMs = intervalMinutes * 60 * 1000;
    autoRefreshTimer = setInterval(() => {
        // Every window runs this timer, but they share the theme file. A random
        // delay de-phases windows whose timers started together, and the first
        // window to rotate the file makes the others skip this interval.
        setTimeout(() => {
            const activeTheme = vscode.workspace.getConfiguration().get('workbench.colorTheme', '');
            if (!activeTheme || !(0, theme_naming_1.isDynamicTheme)(activeTheme)) {
                return;
            }
            if (wasThemeFileWrittenWithin(activeTheme, intervalMs * 0.9)) {
                return;
            }
            refreshTheme(undefined, { silent: true });
        }, Math.random() * Math.min(3000, intervalMs * 0.1));
    }, intervalMs);
}
function generatedThemePath(themeName) {
    const extensionPath = getExtensionPath();
    if (!extensionPath) {
        return undefined;
    }
    const fileName = (0, theme_naming_1.getThemeFileName)((0, theme_naming_1.getThemeVariantFromName)(themeName), (0, theme_naming_1.getThemeStyleFromName)(themeName));
    return path.join(extensionPath, 'themes', fileName);
}
function readShownPalette(themeName) {
    const themePath = generatedThemePath(themeName);
    try {
        return themePath ? (0, theme_config_1.readPaletteMetadata)(JSON.parse(fs.readFileSync(themePath, 'utf8'))) : undefined;
    }
    catch {
        return undefined;
    }
}
function wasThemeFileWrittenWithin(themeName, ms) {
    const themePath = generatedThemePath(themeName);
    try {
        return !!themePath && Date.now() - fs.statSync(themePath).mtimeMs < ms;
    }
    catch {
        return false;
    }
}
// --- Extension Entry --------------------------------------------------------
async function activate(context) {
    extensionContext = context;
    console.log('VibeColors Dynamic Theme extension is now active');
    await ensureDynamicThemeUpToDate({ silent: true });
    // Register commands
    const refreshCommand = vscode.commands.registerCommand('vibeColors.refresh', () => refreshTheme());
    const refreshDarkCommand = vscode.commands.registerCommand('vibeColors.refreshDark', () => refreshTheme('dark'));
    const refreshLightCommand = vscode.commands.registerCommand('vibeColors.refreshLight', () => refreshTheme('light'));
    const switchVariantCommand = vscode.commands.registerCommand('vibeColors.switchVariant', switchVariant);
    const saveCommand = vscode.commands.registerCommand('vibeColors.savePalette', saveCurrentPalette);
    const loadCommand = vscode.commands.registerCommand('vibeColors.loadPalette', loadSavedPalette);
    const regenerateConfigCommand = vscode.commands.registerCommand('vibeColors.regenerateDynamicConfig', regenerateDynamicConfig);
    // Add to subscriptions
    context.subscriptions.push(refreshCommand, refreshDarkCommand, refreshLightCommand, switchVariantCommand, saveCommand, loadCommand, regenerateConfigCommand, vscode.workspace.onDidChangeConfiguration(async (event) => {
        if (event.affectsConfiguration('vibeColors.autoRefreshInterval') ||
            event.affectsConfiguration('vibeColors.autoThemePeriodMinutes')) {
            scheduleAutoRefresh();
        }
        if (event.affectsConfiguration('workbench.colorTheme')) {
            if (suppressThemeChangeHandling > 0) {
                return;
            }
            await ensureDynamicThemeUpToDate({ silent: true });
            // The interval source depends on whether the active theme is
            // an Auto theme, so re-evaluate when the theme changes.
            scheduleAutoRefresh();
        }
    }), { dispose: clearAutoRefreshTimer });
    scheduleAutoRefresh();
    // The Shuffle themes manage their own playlist, timer and commands.
    shuffleController = new shuffle_controller_1.ShuffleController(context);
    context.subscriptions.push(shuffleController, { dispose: () => { shuffleController = undefined; } });
    await shuffleController.start();
}
exports.activate = activate;
function deactivate() {
    clearAutoRefreshTimer();
    console.log('VibeColors Dynamic Theme extension is now deactivated');
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map