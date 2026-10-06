import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ColorPalette, PaletteStyle, makePalette, mulberry32 } from './color-utils';
import { ShuffleController } from './shuffle-controller';
import { PaletteMetadata, generateThemeConfig, readPaletteMetadata, withPaletteMetadata } from './theme-config';
import {
    ThemeVariant,
    getThemeFileName,
    getThemeName,
    getThemeStyleFromName,
    getThemeVariantFromName,
    isAutoTheme,
    isDynamicTheme,
    isShuffleTheme
} from './theme-naming';

interface SavedPalette {
    name: string;
    seed: number;
    timestamp: string;
    variant?: ThemeVariant;
    style?: PaletteStyle;
}

let autoRefreshTimer: NodeJS.Timeout | undefined;
let extensionContext: vscode.ExtensionContext | undefined;
let suppressThemeChangeHandling = 0;
let lastGeneratedSeed: number | undefined;
let lastGeneratedVariant: ThemeVariant | undefined;
let lastGeneratedStyle: PaletteStyle | undefined;
let shuffleController: ShuffleController | undefined;

const LAST_APPLIED_THEME_KEY = 'vibeColors.lastAppliedTheme';

function getExtensionPath(): string | undefined {
    return extensionContext?.extensionPath;
}

function getLastAppliedTheme(): string | undefined {
    return extensionContext?.globalState.get<string>(LAST_APPLIED_THEME_KEY);
}

async function rememberAppliedTheme(themeName: string): Promise<void> {
    await extensionContext?.globalState.update(LAST_APPLIED_THEME_KEY, themeName);
}

async function clearRememberedTheme(): Promise<void> {
    await extensionContext?.globalState.update(LAST_APPLIED_THEME_KEY, undefined);
}

async function ensureDynamicThemeUpToDate(options: { silent?: boolean } = {}): Promise<void> {
    if (!extensionContext) {
        return;
    }

    const currentTheme = vscode.workspace.getConfiguration().get<string>('workbench.colorTheme', '');
    if (!currentTheme) {
        return;
    }

    if (!isDynamicTheme(currentTheme)) {
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

async function applyTheme(
    palette: ColorPalette,
    variant: ThemeVariant = 'dark',
    style: PaletteStyle = 'standard',
    seed?: number
): Promise<void> {
    const extensionPath = getExtensionPath();
    if (!extensionPath) {
        vscode.window.showErrorMessage('VibeColors extension path is not available');
        return;
    }

    const themeName = getThemeName(variant, style);
    const baseConfig = generateThemeConfig(palette, themeName, variant === 'dark');
    const themeConfig = seed === undefined ? baseConfig : withPaletteMetadata(baseConfig, { seed, variant, style });
    const themeFileName = getThemeFileName(variant, style);
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
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to apply dynamic theme: ${error}`);
    } finally {
        suppressThemeChangeHandling = Math.max(0, suppressThemeChangeHandling - 1);
    }
}

// --- Commands ---------------------------------------------------------------

async function refreshTheme(
    variant?: ThemeVariant,
    options: { style?: PaletteStyle; silent?: boolean } = {}
): Promise<void> {
    const config = vscode.workspace.getConfiguration('vibeColors');
    const newSeed = Math.floor(Math.random() * 0xffffffff);
    const rng = mulberry32(newSeed);
    const currentTheme = vscode.workspace.getConfiguration().get<string>('workbench.colorTheme', '');

    // Save the seed if persistence is enabled
    if (config.get<boolean>('persistSeed', false)) {
        await config.update('lastSeed', newSeed, vscode.ConfigurationTarget.Global);
    }

    // Determine which variant to apply
    if (!variant) {
        variant = getThemeVariantFromName(currentTheme);
    }
    const style = options.style ?? getThemeStyleFromName(currentTheme);

    const palette = makePalette(rng, variant, style);
    lastGeneratedSeed = newSeed;
    lastGeneratedVariant = variant;
    lastGeneratedStyle = style;
    await applyTheme(palette, variant, style, newSeed);

    if (!options.silent) {
        vscode.window.showInformationMessage(
            `Dynamic Theme: ${variant} palette refreshed with seed ${newSeed.toString(16)}.`
        );
    }
}

async function switchVariant(): Promise<void> {
    const currentTheme = vscode.workspace.getConfiguration().get<string>('workbench.colorTheme', '');
    if (isShuffleTheme(currentTheme) && shuffleController) {
        await shuffleController.switchVariant();
        return;
    }
    const currentVariant = getThemeVariantFromName(currentTheme);
    const newVariant: ThemeVariant = currentVariant === 'light' ? 'dark' : 'light';
    const style = getThemeStyleFromName(currentTheme);

    await refreshTheme(newVariant, { style });
}

async function saveCurrentPalette(): Promise<void> {
    const config = vscode.workspace.getConfiguration('vibeColors');
    const shuffleCurrent = shuffleController?.getCurrentEntry();
    if (shuffleCurrent) {
        const { entry, variant } = shuffleCurrent;
        if (entry.kind !== 'seed') {
            vscode.window.showInformationMessage(
                `The Shuffle theme is showing "${entry.label}", a theme file rather than a generated palette, so there is no seed to save.`
            );
            return;
        }
        // Keep a palette the Shuffle theme is showing; it then joins the
        // "savedPalettes" shuffle source as well.
        const savedPalettes = config.get<SavedPalette[]>('savedPalettes', []);
        const timestamp = new Date().toISOString();
        savedPalettes.push({ name: entry.label, seed: entry.seed, timestamp, variant, style: entry.style });
        await config.update('savedPalettes', savedPalettes, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Saved palette: ${entry.label}`);
        return;
    }
    const currentTheme = vscode.workspace.getConfiguration().get<string>('workbench.colorTheme', '');
    // The shared theme file is what every window shows; this window may not
    // have generated the latest palette itself.
    const shown = isDynamicTheme(currentTheme) ? readShownPalette(currentTheme) : undefined;
    const persistedSeed = config.get<number>('lastSeed');
    const seed = shown?.seed ?? lastGeneratedSeed ?? (persistedSeed && persistedSeed !== 0 ? persistedSeed : undefined);

    if (seed === undefined) {
        vscode.window.showInformationMessage(
            'No dynamic palette has been generated yet. Run "VibeColors: Refresh Dynamic Theme" first.'
        );
        return;
    }

    const variant = shown?.variant ?? lastGeneratedVariant ?? getThemeVariantFromName(currentTheme);
    const style = shown?.style ?? lastGeneratedStyle ?? getThemeStyleFromName(currentTheme);

    const savedPalettes = config.get<SavedPalette[]>('savedPalettes', []);
    const timestamp = new Date().toISOString();
    const paletteName = `Palette ${timestamp.slice(0, 10)} ${timestamp.slice(11, 19)}`;

    savedPalettes.push({ name: paletteName, seed, timestamp, variant, style });

    await config.update('savedPalettes', savedPalettes, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage(`Saved palette: ${paletteName}`);
}

async function loadSavedPalette(): Promise<void> {
    const config = vscode.workspace.getConfiguration('vibeColors');
    const savedPalettes = config.get<SavedPalette[]>('savedPalettes', []);

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

    const currentTheme = vscode.workspace.getConfiguration().get<string>('workbench.colorTheme', '');
    const variant = selected.palette.variant ?? getThemeVariantFromName(currentTheme);
    const style = selected.palette.style ?? getThemeStyleFromName(currentTheme);
    const rng = mulberry32(selected.palette.seed);
    const palette = makePalette(rng, variant, style);

    lastGeneratedSeed = selected.palette.seed;
    lastGeneratedVariant = variant;
    lastGeneratedStyle = style;

    await applyTheme(palette, variant, style, selected.palette.seed);
    if (config.get<boolean>('persistSeed', false)) {
        await config.update('lastSeed', selected.palette.seed, vscode.ConfigurationTarget.Global);
    }

    vscode.window.showInformationMessage(`Loaded palette: ${selected.label}`);
}

async function regenerateDynamicConfig(): Promise<void> {
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
        const styles: PaletteStyle[] = ['standard', 'vivid', 'muted', 'auto'];
        const variants: ThemeVariant[] = ['dark', 'light'];
        const currentTheme = vscode.workspace.getConfiguration().get<string>('workbench.colorTheme', '');
        const activeVariant = getThemeVariantFromName(currentTheme);
        const activeStyle = getThemeStyleFromName(currentTheme);
        let seedToPersist: number | undefined;

        for (const style of styles) {
            for (const variant of variants) {
                const seed = Math.floor(Math.random() * 0xffffffff);
                const rng = mulberry32(seed);
                const palette = makePalette(rng, variant, style);
                const themeName = getThemeName(variant, style);
                const themeConfig = withPaletteMetadata(
                    generateThemeConfig(palette, themeName, variant === 'dark'),
                    { seed, variant, style }
                );
                const themeFileName = getThemeFileName(variant, style);

                fs.writeFileSync(
                    path.join(themesDir, themeFileName),
                    JSON.stringify(themeConfig, null, '\t')
                );

                if (variant === activeVariant && style === activeStyle) {
                    seedToPersist = seed;
                    lastGeneratedSeed = seed;
                    lastGeneratedVariant = variant;
                    lastGeneratedStyle = style;
                }
            }
        }

        if (config.get<boolean>('persistSeed', false) && seedToPersist !== undefined) {
            await config.update('lastSeed', seedToPersist, vscode.ConfigurationTarget.Global);
        }

        vscode.window.showInformationMessage(
            'Dynamic configuration regenerated! Reload VS Code or switch themes to see changes.'
        );

    } catch (error) {
        vscode.window.showErrorMessage(`Failed to regenerate dynamic configuration: ${error}`);
    }
}

function clearAutoRefreshTimer(): void {
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
        autoRefreshTimer = undefined;
    }
}

function scheduleAutoRefresh(): void {
    clearAutoRefreshTimer();
    const config = vscode.workspace.getConfiguration('vibeColors');
    const currentTheme = vscode.workspace.getConfiguration().get<string>('workbench.colorTheme', '');

    // Auto themes rotate on their own schedule; Dynamic themes rotate only
    // when the user opts in via vibeColors.autoRefreshInterval.
    const intervalMinutes = isAutoTheme(currentTheme)
        ? config.get<number>('autoThemePeriodMinutes', 10)
        : config.get<number>('autoRefreshInterval', 0);

    if (!intervalMinutes || intervalMinutes <= 0) {
        return;
    }

    const intervalMs = intervalMinutes * 60 * 1000;
    autoRefreshTimer = setInterval(() => {
        // Every window runs this timer, but they share the theme file. A random
        // delay de-phases windows whose timers started together, and the first
        // window to rotate the file makes the others skip this interval.
        setTimeout(() => {
            const activeTheme = vscode.workspace.getConfiguration().get<string>('workbench.colorTheme', '');
            if (!activeTheme || !isDynamicTheme(activeTheme)) {
                return;
            }
            if (wasThemeFileWrittenWithin(activeTheme, intervalMs * 0.9)) {
                return;
            }
            refreshTheme(undefined, { silent: true });
        }, Math.random() * Math.min(3_000, intervalMs * 0.1));
    }, intervalMs);
}

function generatedThemePath(themeName: string): string | undefined {
    const extensionPath = getExtensionPath();
    if (!extensionPath) {
        return undefined;
    }
    const fileName = getThemeFileName(getThemeVariantFromName(themeName), getThemeStyleFromName(themeName));
    return path.join(extensionPath, 'themes', fileName);
}

function readShownPalette(themeName: string): PaletteMetadata | undefined {
    const themePath = generatedThemePath(themeName);
    try {
        return themePath ? readPaletteMetadata(JSON.parse(fs.readFileSync(themePath, 'utf8'))) : undefined;
    } catch {
        return undefined;
    }
}

function wasThemeFileWrittenWithin(themeName: string, ms: number): boolean {
    const themePath = generatedThemePath(themeName);
    try {
        return !!themePath && Date.now() - fs.statSync(themePath).mtimeMs < ms;
    } catch {
        return false;
    }
}

// --- Extension Entry --------------------------------------------------------

export async function activate(context: vscode.ExtensionContext) {
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
    context.subscriptions.push(
        refreshCommand,
        refreshDarkCommand,
        refreshLightCommand,
        switchVariantCommand,
        saveCommand,
        loadCommand,
        regenerateConfigCommand,
        vscode.workspace.onDidChangeConfiguration(async event => {
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
        }),
        { dispose: clearAutoRefreshTimer }
    );

    scheduleAutoRefresh();

    // The Shuffle themes manage their own playlist, timer and commands.
    shuffleController = new ShuffleController(context);
    context.subscriptions.push(shuffleController, { dispose: () => { shuffleController = undefined; } });
    await shuffleController.start();
}

export function deactivate() {
    clearAutoRefreshTimer();
    console.log('VibeColors Dynamic Theme extension is now deactivated');
}
