import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ColorPalette, PaletteStyle, adjustBrightness, makePalette, mulberry32, withOpacity } from './color-utils';

let autoRefreshTimer: NodeJS.Timeout | undefined;
let extensionContext: vscode.ExtensionContext | undefined;
let suppressThemeChangeHandling = 0;

const LAST_APPLIED_THEME_KEY = 'vibeColors.lastAppliedTheme';

const STYLE_LABELS: Record<PaletteStyle, string> = {
    standard: 'Dynamic',
    vivid: 'Dynamic Vivid',
    muted: 'Dynamic Muted'
};

const STYLE_FILE_SEGMENTS: Record<PaletteStyle, string> = {
    standard: 'dynamic',
    vivid: 'dynamic-vivid',
    muted: 'dynamic-muted'
};

function getThemeVariantFromName(themeName: string): 'dark' | 'light' {
    return themeName.includes('Light') ? 'light' : 'dark';
}

function getThemeStyleFromName(themeName: string): PaletteStyle {
    if (themeName.includes('Dynamic Vivid')) {
        return 'vivid';
    }
    if (themeName.includes('Dynamic Muted')) {
        return 'muted';
    }
    return 'standard';
}

function getThemeName(variant: 'dark' | 'light', style: PaletteStyle): string {
    return `VibeColors ${STYLE_LABELS[style]} ${variant === 'dark' ? 'Dark' : 'Light'}`;
}

function getThemeFileName(variant: 'dark' | 'light', style: PaletteStyle): string {
    return `VibeColors-${STYLE_FILE_SEGMENTS[style]}-${variant}-theme.json`;
}

function isDynamicTheme(themeName: string): boolean {
    return themeName.includes('VibeColors Dynamic');
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

// --- Theme Generation -------------------------------------------------------

function generateThemeConfig(palette: ColorPalette, themeName: string, isDark: boolean): any {
    return {
        name: themeName,
        type: isDark ? 'dark' : 'light',
        colors: {
            // Editor
            'editor.background': palette.background,
            'editor.foreground': palette.foreground,
            'editorLineNumber.foreground': withOpacity(palette.foregroundSecondary, 0.6),
            'editorLineNumber.activeForeground': palette.accent1,
            'editorCursor.foreground': palette.accent1,
            'editor.selectionBackground': palette.selection,
            'editor.selectionHighlightBackground': withOpacity(palette.selection, 0.7),
            'editor.wordHighlightBackground': withOpacity(palette.highlight, 0.5),
            'editor.wordHighlightStrongBackground': withOpacity(palette.highlight, 0.8),
            'editor.findMatchBackground': palette.warning,
            'editor.findMatchHighlightBackground': withOpacity(palette.warning, 0.6),
            'editorBracketMatch.background': palette.selection,
            'editorBracketMatch.border': palette.accent1,
            'editorWhitespace.foreground': withOpacity(palette.border, 0.5),
            'editorIndentGuide.background1': palette.border,
            'editorIndentGuide.activeBackground1': palette.foregroundSecondary,
            'editorRuler.foreground': palette.border,
            'editor.lineHighlightBackground': palette.backgroundSecondary,
            'editor.inactiveSelectionBackground': withOpacity(palette.selection, 0.5),
            'editor.rangeHighlightBackground': withOpacity(palette.accent2, 0.2),
            'editor.symbolHighlightBackground': withOpacity(palette.accent3, 0.3),

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
            'statusBarItem.hoverBackground': withOpacity(palette.backgroundTertiary, 0.8),

            // Title Bar
            'titleBar.activeBackground': palette.background,
            'titleBar.activeForeground': palette.foreground,
            'titleBar.inactiveBackground': palette.backgroundSecondary,
            'titleBar.inactiveForeground': withOpacity(palette.foregroundSecondary, 0.7),

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
            'input.placeholderForeground': withOpacity(palette.foregroundSecondary, 0.7),

            // Buttons
            'button.background': palette.accent1,
            'button.foreground': isDark ? palette.background : '#ffffff',
            'button.hoverBackground': adjustBrightness(palette.accent1, isDark ? 10 : -10),

            // Lists
            'list.activeSelectionBackground': palette.selection,
            'list.activeSelectionForeground': palette.foreground,
            'list.inactiveSelectionBackground': palette.backgroundTertiary,
            'list.hoverBackground': withOpacity(palette.backgroundTertiary, 0.8),
            'list.focusBackground': palette.selection,

            // Scrollbars
            'scrollbarSlider.background': withOpacity(palette.foregroundSecondary, 0.4),
            'scrollbarSlider.hoverBackground': withOpacity(palette.foregroundSecondary, 0.6),
            'scrollbarSlider.activeBackground': withOpacity(palette.foregroundSecondary, 0.8),

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
            'diffEditor.insertedTextBackground': withOpacity(palette.success, 0.2),
            'diffEditor.removedTextBackground': withOpacity(palette.error, 0.2),

            // Extensions
            'extensionButton.prominentBackground': palette.accent1,
            'extensionButton.prominentForeground': isDark ? palette.background : '#ffffff',
            'extensionButton.prominentHoverBackground': adjustBrightness(palette.accent1, isDark ? 10 : -10),

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
                    foreground: withOpacity(palette.foregroundSecondary, 0.8)
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

async function applyTheme(
    palette: ColorPalette,
    variant: 'dark' | 'light' = 'dark',
    style: PaletteStyle = 'standard'
): Promise<void> {
    const extensionPath = vscode.extensions.getExtension('AlexLi.vibecolors')?.extensionPath;
    if (!extensionPath) {
        vscode.window.showErrorMessage('VibeColors extension not found');
        return;
    }

    const themeName = getThemeName(variant, style);
    const themeConfig = generateThemeConfig(palette, themeName, variant === 'dark');
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
    variant?: 'dark' | 'light',
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
    await applyTheme(palette, variant, style);

    if (!options.silent) {
        vscode.window.showInformationMessage(
            `Dynamic Theme: ${variant} palette refreshed with seed ${newSeed.toString(16)}.`
        );
    }
}

async function switchVariant(): Promise<void> {
    const currentTheme = vscode.workspace.getConfiguration().get<string>('workbench.colorTheme', '');
    const currentVariant = getThemeVariantFromName(currentTheme);
    const newVariant = currentVariant === 'light' ? 'dark' : 'light';
    const style = getThemeStyleFromName(currentTheme);

    await refreshTheme(newVariant, { style });
}

async function saveCurrentPalette(): Promise<void> {
    const config = vscode.workspace.getConfiguration('vibeColors');
    const lastSeed = config.get<number>('lastSeed');

    if (lastSeed) {
        const savedPalettes = config.get<any[]>('savedPalettes', []);
        const timestamp = new Date().toISOString();
        const paletteName = `Palette ${timestamp.slice(0, 10)} ${timestamp.slice(11, 19)}`;

        savedPalettes.push({
            name: paletteName,
            seed: lastSeed,
            timestamp
        });

        await config.update('savedPalettes', savedPalettes, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Saved palette: ${paletteName}`);
    }
}

async function loadSavedPalette(): Promise<void> {
    const config = vscode.workspace.getConfiguration('vibeColors');
    const savedPalettes = config.get<any[]>('savedPalettes', []);

    if (savedPalettes.length === 0) {
        vscode.window.showInformationMessage('No saved palettes found');
        return;
    }

    const items = savedPalettes.map(p => ({
        label: p.name,
        description: `Seed: ${p.seed.toString(16)}`,
        seed: p.seed
    }));

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a saved palette'
    });

    if (selected) {
        const rng = mulberry32(selected.seed);
        const currentTheme = vscode.workspace.getConfiguration().get<string>('workbench.colorTheme', '');
        const variant = getThemeVariantFromName(currentTheme);
        const style = getThemeStyleFromName(currentTheme);
        const palette = makePalette(rng, variant, style);

        await applyTheme(palette, variant, style);
        await config.update('lastSeed', selected.seed, vscode.ConfigurationTarget.Global);

        vscode.window.showInformationMessage(`Loaded palette: ${selected.label}`);
    }
}

async function regenerateDynamicConfig(): Promise<void> {
    const extensionPath = vscode.extensions.getExtension('AlexLi.vibecolors')?.extensionPath;
    if (!extensionPath) {
        vscode.window.showErrorMessage('VibeColors extension not found');
        return;
    }

    try {
        vscode.window.showInformationMessage('Regenerating dynamic configuration...');

        const themesDir = path.join(extensionPath, 'themes');
        if (!fs.existsSync(themesDir)) {
            fs.mkdirSync(themesDir, { recursive: true });
        }

        const config = vscode.workspace.getConfiguration('vibeColors');
        const styles: PaletteStyle[] = ['standard', 'vivid', 'muted'];
        const variants: Array<'dark' | 'light'> = ['dark', 'light'];
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
                const themeConfig = generateThemeConfig(palette, themeName, variant === 'dark');
                const themeFileName = getThemeFileName(variant, style);

                fs.writeFileSync(
                    path.join(themesDir, themeFileName),
                    JSON.stringify(themeConfig, null, '\t')
                );

                if (variant === activeVariant && style === activeStyle) {
                    seedToPersist = seed;
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
    const intervalMinutes = config.get<number>('autoRefreshInterval', 0);
    if (!intervalMinutes || intervalMinutes <= 0) {
        return;
    }

    const intervalMs = intervalMinutes * 60 * 1000;
    autoRefreshTimer = setInterval(() => {
        const currentTheme = vscode.workspace.getConfiguration().get<string>('workbench.colorTheme', '');
        if (!currentTheme || !isDynamicTheme(currentTheme)) {
            return;
        }
        refreshTheme(undefined, { silent: true });
    }, intervalMs);
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
            if (event.affectsConfiguration('vibeColors.autoRefreshInterval')) {
                scheduleAutoRefresh();
            }
            if (event.affectsConfiguration('workbench.colorTheme')) {
                if (suppressThemeChangeHandling > 0) {
                    return;
                }
                await ensureDynamicThemeUpToDate({ silent: true });
            }
        }),
        { dispose: clearAutoRefreshTimer }
    );

    scheduleAutoRefresh();
}

export function deactivate() {
    clearAutoRefreshTimer();
    console.log('VibeColors Dynamic Theme extension is now deactivated');
}
