"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const color_utils_1 = require("./color-utils");
const theme_naming_1 = require("./theme-naming");
let autoRefreshTimer;
let extensionContext;
let suppressThemeChangeHandling = 0;
let lastGeneratedSeed;
let lastGeneratedVariant;
let lastGeneratedStyle;
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
// --- Theme Generation -------------------------------------------------------
function generateThemeConfig(palette, themeName, isDark) {
    return {
        name: themeName,
        type: isDark ? 'dark' : 'light',
        colors: {
            // Editor
            'editor.background': palette.background,
            'editor.foreground': palette.foreground,
            'editorLineNumber.foreground': (0, color_utils_1.withOpacity)(palette.foregroundSecondary, 0.6),
            'editorLineNumber.activeForeground': palette.accent1,
            'editorCursor.foreground': palette.accent1,
            'editor.selectionBackground': palette.selection,
            'editor.selectionHighlightBackground': (0, color_utils_1.withOpacity)(palette.selection, 0.7),
            'editor.wordHighlightBackground': (0, color_utils_1.withOpacity)(palette.highlight, 0.5),
            'editor.wordHighlightStrongBackground': (0, color_utils_1.withOpacity)(palette.highlight, 0.8),
            'editor.findMatchBackground': palette.warning,
            'editor.findMatchHighlightBackground': (0, color_utils_1.withOpacity)(palette.warning, 0.6),
            'editorBracketMatch.background': palette.selection,
            'editorBracketMatch.border': palette.accent1,
            'editorWhitespace.foreground': (0, color_utils_1.withOpacity)(palette.border, 0.5),
            'editorIndentGuide.background1': palette.border,
            'editorIndentGuide.activeBackground1': palette.foregroundSecondary,
            'editorRuler.foreground': palette.border,
            'editor.lineHighlightBackground': palette.backgroundSecondary,
            'editor.inactiveSelectionBackground': (0, color_utils_1.withOpacity)(palette.selection, 0.5),
            'editor.rangeHighlightBackground': (0, color_utils_1.withOpacity)(palette.accent2, 0.2),
            'editor.symbolHighlightBackground': (0, color_utils_1.withOpacity)(palette.accent3, 0.3),
            // Error/Warning/Info
            'editorError.foreground': palette.error,
            'editorWarning.foreground': palette.warning,
            'editorInfo.foreground': palette.info,
            'editorHint.foreground': palette.hint,
            'problemsErrorIcon.foreground': palette.error,
            'problemsWarningIcon.foreground': palette.warning,
            'problemsInfoIcon.foreground': palette.info,
            // Sidebar
            'sideBar.background': palette.backgroundSecondary,
            'sideBar.foreground': palette.foregroundSecondary,
            'sideBarTitle.foreground': palette.foreground,
            'sideBarSectionHeader.background': palette.background,
            'sideBarSectionHeader.foreground': palette.accent1,
            // Activity Bar
            'activityBar.background': palette.backgroundSecondary,
            'activityBar.foreground': palette.foregroundSecondary,
            'activityBar.activeBorder': palette.accent1,
            'activityBar.activeBackground': palette.backgroundTertiary,
            'activityBarBadge.background': palette.accent1,
            'activityBarBadge.foreground': isDark ? palette.background : '#ffffff',
            // Status Bar
            'statusBar.background': palette.backgroundSecondary,
            'statusBar.foreground': palette.foregroundSecondary,
            'statusBar.noFolderBackground': palette.backgroundSecondary,
            'statusBarItem.activeBackground': palette.backgroundTertiary,
            'statusBarItem.hoverBackground': (0, color_utils_1.withOpacity)(palette.backgroundTertiary, 0.8),
            // Title Bar
            'titleBar.activeBackground': palette.background,
            'titleBar.activeForeground': palette.foreground,
            'titleBar.inactiveBackground': palette.backgroundSecondary,
            'titleBar.inactiveForeground': (0, color_utils_1.withOpacity)(palette.foregroundSecondary, 0.7),
            // Tabs
            'tab.activeBackground': palette.background,
            'tab.activeForeground': palette.foreground,
            'tab.activeBorder': palette.accent1,
            'tab.inactiveBackground': palette.backgroundSecondary,
            'tab.inactiveForeground': palette.foregroundSecondary,
            'tab.border': palette.border,
            // Panel
            'panel.background': palette.background,
            'panel.border': palette.border,
            'panelTitle.activeBorder': palette.accent1,
            'panelTitle.activeForeground': palette.foreground,
            'panelTitle.inactiveForeground': palette.foregroundSecondary,
            // Terminal
            'terminal.background': palette.background,
            'terminal.foreground': palette.foreground,
            'terminal.ansiBlack': palette.foregroundSecondary,
            'terminal.ansiRed': palette.error,
            'terminal.ansiGreen': palette.success,
            'terminal.ansiYellow': palette.warning,
            'terminal.ansiBlue': palette.info,
            'terminal.ansiMagenta': palette.accent1,
            'terminal.ansiCyan': palette.accent2,
            'terminal.ansiWhite': palette.foreground,
            'terminal.ansiBrightRed': palette.rosemaryRed,
            'terminal.ansiBrightYellow': palette.desertGold,
            // Input controls
            'input.background': palette.backgroundTertiary,
            'input.border': palette.border,
            'input.foreground': palette.foreground,
            'input.placeholderForeground': (0, color_utils_1.withOpacity)(palette.foregroundSecondary, 0.7),
            // Buttons
            'button.background': palette.accent1,
            'button.foreground': isDark ? palette.background : '#ffffff',
            'button.hoverBackground': (0, color_utils_1.adjustBrightness)(palette.accent1, isDark ? 10 : -10),
            // Lists
            'list.activeSelectionBackground': palette.selection,
            'list.activeSelectionForeground': palette.foreground,
            'list.inactiveSelectionBackground': palette.backgroundTertiary,
            'list.hoverBackground': (0, color_utils_1.withOpacity)(palette.backgroundTertiary, 0.8),
            'list.focusBackground': palette.selection,
            // Scrollbars
            'scrollbarSlider.background': (0, color_utils_1.withOpacity)(palette.foregroundSecondary, 0.4),
            'scrollbarSlider.hoverBackground': (0, color_utils_1.withOpacity)(palette.foregroundSecondary, 0.6),
            'scrollbarSlider.activeBackground': (0, color_utils_1.withOpacity)(palette.foregroundSecondary, 0.8),
            // Badges and progress
            'badge.background': palette.accent1,
            'badge.foreground': isDark ? palette.background : '#ffffff',
            'progressBar.background': palette.accent1,
            // Editor widgets
            'editorWidget.background': palette.backgroundTertiary,
            'editorWidget.border': palette.border,
            'editorSuggestWidget.background': palette.backgroundTertiary,
            'editorSuggestWidget.border': palette.border,
            'editorSuggestWidget.selectedBackground': palette.selection,
            // Peek view
            'peekView.border': palette.accent1,
            'peekViewEditor.background': palette.backgroundSecondary,
            'peekViewResult.background': palette.background,
            'peekViewTitle.background': palette.backgroundTertiary,
            // Git decorations
            'gitDecoration.modifiedResourceForeground': palette.warning,
            'gitDecoration.deletedResourceForeground': palette.error,
            'gitDecoration.untrackedResourceForeground': palette.success,
            'gitDecoration.conflictingResourceForeground': palette.accent1,
            // Diff editor
            'diffEditor.insertedTextBackground': (0, color_utils_1.withOpacity)(palette.success, 0.2),
            'diffEditor.removedTextBackground': (0, color_utils_1.withOpacity)(palette.error, 0.2),
            // Extensions
            'extensionButton.prominentBackground': palette.accent1,
            'extensionButton.prominentForeground': isDark ? palette.background : '#ffffff',
            'extensionButton.prominentHoverBackground': (0, color_utils_1.adjustBrightness)(palette.accent1, isDark ? 10 : -10),
            // Notifications
            'notifications.background': palette.backgroundTertiary,
            'notifications.border': palette.border,
            'notifications.foreground': palette.foreground,
            'notificationLink.foreground': palette.accent1,
            // Breadcrumbs
            'breadcrumb.foreground': palette.foregroundSecondary,
            'breadcrumb.background': palette.background,
            'breadcrumb.focusForeground': palette.foreground,
            'breadcrumb.activeSelectionForeground': palette.accent1,
            // Menu
            'menu.foreground': palette.foreground,
            'menu.background': palette.backgroundTertiary,
            'menu.selectionForeground': palette.foreground,
            'menu.selectionBackground': palette.selection,
            'menu.selectionBorder': palette.accent1,
            'menu.separatorBackground': palette.border,
            // Settings
            'settings.headerForeground': palette.foreground,
            'settings.modifiedItemIndicator': palette.accent1,
            'settings.dropdownBackground': palette.backgroundTertiary,
            'settings.dropdownForeground': palette.foreground,
            'settings.dropdownBorder': palette.border,
            'settings.textInputBackground': palette.backgroundTertiary,
            'settings.textInputForeground': palette.foreground,
            'settings.textInputBorder': palette.border,
        },
        tokenColors: [
            {
                name: 'Comment',
                scope: ['comment', 'punctuation.definition.comment'],
                settings: {
                    fontStyle: 'italic',
                    foreground: (0, color_utils_1.withOpacity)(palette.foregroundSecondary, 0.8)
                }
            },
            {
                name: 'String',
                scope: ['string'],
                settings: {
                    foreground: palette.success
                }
            },
            {
                name: 'Number',
                scope: ['constant.numeric', 'constant.language', 'constant.character'],
                settings: {
                    foreground: palette.warning
                }
            },
            {
                name: 'Keyword',
                scope: ['keyword', 'storage.type', 'storage.modifier'],
                settings: {
                    foreground: palette.accent1
                }
            },
            {
                name: 'Function',
                scope: ['entity.name.function', 'meta.function-call', 'variable.function', 'support.function'],
                settings: {
                    foreground: palette.info
                }
            },
            {
                name: 'Class',
                scope: ['entity.name.class', 'entity.name.type', 'support.type', 'support.class'],
                settings: {
                    foreground: palette.accent2
                }
            },
            {
                name: 'Variable',
                scope: ['variable'],
                settings: {
                    foreground: palette.foreground
                }
            },
            {
                name: 'Property',
                scope: ['variable.other.property', 'support.type.property-name'],
                settings: {
                    foreground: palette.accent3
                }
            },
            {
                name: 'Tag',
                scope: ['entity.name.tag'],
                settings: {
                    foreground: palette.error
                }
            },
            {
                name: 'Attribute',
                scope: ['entity.other.attribute-name'],
                settings: {
                    foreground: palette.accent4
                }
            },
            {
                name: 'Operator',
                scope: ['keyword.control', 'punctuation', 'keyword.operator'],
                settings: {
                    foreground: palette.foregroundSecondary
                }
            },
            {
                name: 'Import/Export',
                scope: ['keyword.control.import', 'keyword.control.export', 'keyword.control.from'],
                settings: {
                    foreground: palette.accent1
                }
            },
            {
                name: 'Type',
                scope: ['entity.name.type', 'support.type.primitive'],
                settings: {
                    foreground: palette.hint
                }
            },
            {
                name: 'Invalid',
                scope: ['invalid', 'invalid.illegal'],
                settings: {
                    background: palette.error,
                    foreground: palette.background
                }
            },
            {
                name: 'Deprecated',
                scope: ['invalid.deprecated'],
                settings: {
                    foreground: palette.rosemaryRed,
                    fontStyle: 'italic strikethrough'
                }
            },
            {
                name: 'Constants',
                scope: ['constant.other', 'support.constant'],
                settings: {
                    foreground: palette.rosemaryRed
                }
            },
            {
                name: 'Documentation',
                scope: ['comment.block.documentation', 'string.quoted.docstring'],
                settings: {
                    foreground: palette.desertGold,
                    fontStyle: 'italic'
                }
            },
            {
                name: 'String Escape Characters',
                scope: ['constant.character.escape'],
                settings: {
                    foreground: palette.desertGold
                }
            }
        ]
    };
}
// --- Theme Application ------------------------------------------------------
async function applyTheme(palette, variant = 'dark', style = 'standard') {
    const extensionPath = getExtensionPath();
    if (!extensionPath) {
        vscode.window.showErrorMessage('VibeColors extension path is not available');
        return;
    }
    const themeName = (0, theme_naming_1.getThemeName)(variant, style);
    const themeConfig = generateThemeConfig(palette, themeName, variant === 'dark');
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
    await applyTheme(palette, variant, style);
    if (!options.silent) {
        vscode.window.showInformationMessage(`Dynamic Theme: ${variant} palette refreshed with seed ${newSeed.toString(16)}.`);
    }
}
async function switchVariant() {
    const currentTheme = vscode.workspace.getConfiguration().get('workbench.colorTheme', '');
    const currentVariant = (0, theme_naming_1.getThemeVariantFromName)(currentTheme);
    const newVariant = currentVariant === 'light' ? 'dark' : 'light';
    const style = (0, theme_naming_1.getThemeStyleFromName)(currentTheme);
    await refreshTheme(newVariant, { style });
}
async function saveCurrentPalette() {
    const config = vscode.workspace.getConfiguration('vibeColors');
    const persistedSeed = config.get('lastSeed');
    const seed = lastGeneratedSeed ?? (persistedSeed && persistedSeed !== 0 ? persistedSeed : undefined);
    if (seed === undefined) {
        vscode.window.showInformationMessage('No dynamic palette has been generated yet. Run "VibeColors: Refresh Dynamic Theme" first.');
        return;
    }
    const currentTheme = vscode.workspace.getConfiguration().get('workbench.colorTheme', '');
    const variant = lastGeneratedVariant ?? (0, theme_naming_1.getThemeVariantFromName)(currentTheme);
    const style = lastGeneratedStyle ?? (0, theme_naming_1.getThemeStyleFromName)(currentTheme);
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
    await applyTheme(palette, variant, style);
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
                const themeConfig = generateThemeConfig(palette, themeName, variant === 'dark');
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
        const activeTheme = vscode.workspace.getConfiguration().get('workbench.colorTheme', '');
        if (!activeTheme || !(0, theme_naming_1.isDynamicTheme)(activeTheme)) {
            return;
        }
        refreshTheme(undefined, { silent: true });
    }, intervalMs);
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
}
exports.activate = activate;
function deactivate() {
    clearAutoRefreshTimer();
    console.log('VibeColors Dynamic Theme extension is now deactivated');
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map