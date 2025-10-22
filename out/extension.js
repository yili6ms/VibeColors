"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
// --- Random Number Generator ------------------------------------------------
function mulberry32(seed) {
    return function () {
        let t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}
function getSeed() {
    const config = vscode.workspace.getConfiguration('vibeColors');
    const savedSeed = config.get('lastSeed');
    if (savedSeed && config.get('persistSeed', false)) {
        return savedSeed;
    }
    return Math.floor(Math.random() * 0xffffffff);
}
// --- Color Utilities --------------------------------------------------------
function hslToHex(h, s, l) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = (n) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}
function adjustBrightness(hex, factor) {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * factor);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
        (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
        (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
}
function withOpacity(hex, opacity) {
    const alpha = Math.round(opacity * 255).toString(16).padStart(2, '0');
    return hex + alpha;
}
// --- Advanced Palette Generation --------------------------------------------
function generateHarmonizedPalette(rng, isDark) {
    // Generate base hue with golden ratio for pleasing distributions
    const baseHue = Math.floor(rng() * 360);
    const goldenRatio = 137.508; // Golden angle in degrees
    // Generate multiple harmonious hues
    const hues = [
        baseHue,
        (baseHue + goldenRatio) % 360,
        (baseHue + goldenRatio * 2) % 360,
        (baseHue + 180) % 360, // Complementary
    ];
    // Color generation parameters based on theme type
    const params = isDark ? {
        bgSaturation: [15, 35],
        bgLightness: [8, 18],
        fgSaturation: [10, 30],
        fgLightness: [80, 95],
        accentSaturation: [60, 90],
        accentLightness: [50, 80]
    } : {
        bgSaturation: [10, 30],
        bgLightness: [92, 98],
        fgSaturation: [20, 40],
        fgLightness: [10, 25],
        accentSaturation: [50, 80],
        accentLightness: [35, 65]
    };
    // Generate background colors
    const bgSat = params.bgSaturation[0] + rng() * (params.bgSaturation[1] - params.bgSaturation[0]);
    const bgLight = params.bgLightness[0] + rng() * (params.bgLightness[1] - params.bgLightness[0]);
    const background = hslToHex(hues[0], bgSat, bgLight);
    const backgroundSecondary = hslToHex(hues[0], bgSat * 0.8, bgLight + (isDark ? -3 : 3));
    const backgroundTertiary = hslToHex(hues[0], bgSat * 1.2, bgLight + (isDark ? 5 : -5));
    // Generate foreground colors
    const fgSat = params.fgSaturation[0] + rng() * (params.fgSaturation[1] - params.fgSaturation[0]);
    const fgLight = params.fgLightness[0] + rng() * (params.fgLightness[1] - params.fgLightness[0]);
    const foreground = hslToHex(hues[0], fgSat, fgLight);
    const foregroundSecondary = hslToHex(hues[0], fgSat * 0.7, fgLight - (isDark ? 15 : -15));
    // Generate accent colors with different hues
    const accentSat = params.accentSaturation[0] + rng() * (params.accentSaturation[1] - params.accentSaturation[0]);
    const accentLight = params.accentLightness[0] + rng() * (params.accentLightness[1] - params.accentLightness[0]);
    const accent1 = hslToHex(hues[1], accentSat, accentLight);
    const accent2 = hslToHex(hues[2], accentSat * 0.9, accentLight + 10);
    const accent3 = hslToHex(hues[3], accentSat * 1.1, accentLight - 5);
    const accent4 = hslToHex((hues[0] + 90) % 360, accentSat * 0.8, accentLight + 5);
    // Generate semantic colors with consistent hue ranges
    const error = hslToHex(0 + rng() * 20, 70 + rng() * 20, isDark ? 60 + rng() * 15 : 45 + rng() * 20);
    const warning = hslToHex(35 + rng() * 25, 75 + rng() * 15, isDark ? 65 + rng() * 15 : 50 + rng() * 20);
    const success = hslToHex(120 + rng() * 40, 60 + rng() * 25, isDark ? 60 + rng() * 20 : 40 + rng() * 25);
    const info = hslToHex(200 + rng() * 40, 65 + rng() * 25, isDark ? 65 + rng() * 20 : 45 + rng() * 25);
    const hint = hslToHex(180 + rng() * 40, 55 + rng() * 30, isDark ? 70 + rng() * 15 : 50 + rng() * 20);
    const rosemaryRed = hslToHex(355 + rng() * 10, 45 + rng() * 15, isDark ? 65 + rng() * 15 : 50 + rng() * 15);
    const desertGold = hslToHex(45 + rng() * 15, 60 + rng() * 20, isDark ? 70 + rng() * 15 : 55 + rng() * 15);
    // Generate special colors
    const selection = withOpacity(accent1, 0.3);
    const highlight = withOpacity(accent2, 0.2);
    const border = isDark ?
        adjustBrightness(background, 15) :
        adjustBrightness(background, -10);
    return {
        background,
        backgroundSecondary,
        backgroundTertiary,
        foreground,
        foregroundSecondary,
        accent1,
        accent2,
        accent3,
        accent4,
        error,
        warning,
        success,
        info,
        hint,
        rosemaryRed,
        desertGold,
        selection,
        highlight,
        border
    };
}
function makePalette(rng, variant = 'dark') {
    return generateHarmonizedPalette(rng, variant === 'dark');
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
async function applyTheme(palette, variant = 'dark') {
    const extensionPath = vscode.extensions.getExtension('AlexLi.vibecolors')?.extensionPath;
    if (!extensionPath) {
        vscode.window.showErrorMessage('VibeColors extension not found');
        return;
    }
    const themeName = `VibeColors Dynamic ${variant === 'dark' ? 'Dark' : 'Light'}`;
    const themeConfig = generateThemeConfig(palette, themeName, variant === 'dark');
    const themeFileName = `VibeColors-dynamic-${variant}-theme.json`;
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
        await config.update('workbench.colorTheme', themeName, vscode.ConfigurationTarget.Global);
        console.log(`Applied dynamic ${variant} theme with palette:`, palette);
    }
    catch (error) {
        vscode.window.showErrorMessage(`Failed to apply dynamic theme: ${error}`);
    }
}
// --- Commands ---------------------------------------------------------------
async function refreshTheme(variant) {
    const config = vscode.workspace.getConfiguration('vibeColors');
    const newSeed = Math.floor(Math.random() * 0xffffffff);
    const rng = mulberry32(newSeed);
    // Save the seed if persistence is enabled
    if (config.get('persistSeed', false)) {
        await config.update('lastSeed', newSeed, vscode.ConfigurationTarget.Global);
    }
    // Determine which variant to apply
    if (!variant) {
        const currentTheme = vscode.workspace.getConfiguration().get('workbench.colorTheme', '');
        variant = currentTheme.includes('Light') ? 'light' : 'dark';
    }
    const palette = makePalette(rng, variant);
    await applyTheme(palette, variant);
    vscode.window.showInformationMessage(`Dynamic Theme: ${variant} palette refreshed with seed ${newSeed.toString(16)}.`);
}
async function switchVariant() {
    const currentTheme = vscode.workspace.getConfiguration().get('workbench.colorTheme', '');
    const newVariant = currentTheme.includes('Light') ? 'dark' : 'light';
    await refreshTheme(newVariant);
}
async function saveCurrentPalette() {
    const config = vscode.workspace.getConfiguration('vibeColors');
    const lastSeed = config.get('lastSeed');
    if (lastSeed) {
        const savedPalettes = config.get('savedPalettes', []);
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
        seed: p.seed
    }));
    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a saved palette'
    });
    if (selected) {
        const rng = mulberry32(selected.seed);
        const currentTheme = vscode.workspace.getConfiguration().get('workbench.colorTheme', '');
        const variant = currentTheme.includes('Light') ? 'light' : 'dark';
        const palette = makePalette(rng, variant);
        await applyTheme(palette, variant);
        await config.update('lastSeed', selected.seed, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Loaded palette: ${selected.label}`);
    }
}
async function regenerateDynamicConfig() {
    const extensionPath = vscode.extensions.getExtension('AlexLi.vibecolors')?.extensionPath;
    if (!extensionPath) {
        vscode.window.showErrorMessage('VibeColors extension not found');
        return;
    }
    try {
        vscode.window.showInformationMessage('Regenerating dynamic configuration...');
        // Generate new random seeds for both dark and light themes
        const darkSeed = Math.floor(Math.random() * 0xffffffff);
        const lightSeed = Math.floor(Math.random() * 0xffffffff);
        // Generate both dark and light palettes
        const darkRng = mulberry32(darkSeed);
        const lightRng = mulberry32(lightSeed);
        const darkPalette = makePalette(darkRng, 'dark');
        const lightPalette = makePalette(lightRng, 'light');
        // Generate and write theme files
        const darkThemeConfig = generateThemeConfig(darkPalette, 'VibeColors Dynamic Dark', true);
        const lightThemeConfig = generateThemeConfig(lightPalette, 'VibeColors Dynamic Light', false);
        const themesDir = path.join(extensionPath, 'themes');
        if (!fs.existsSync(themesDir)) {
            fs.mkdirSync(themesDir, { recursive: true });
        }
        // Write both theme files
        fs.writeFileSync(path.join(themesDir, 'VibeColors-dynamic-dark-theme.json'), JSON.stringify(darkThemeConfig, null, '\t'));
        fs.writeFileSync(path.join(themesDir, 'VibeColors-dynamic-light-theme.json'), JSON.stringify(lightThemeConfig, null, '\t'));
        // Save the new seeds if persistence is enabled
        const config = vscode.workspace.getConfiguration('vibeColors');
        if (config.get('persistSeed', false)) {
            await config.update('lastSeed', darkSeed, vscode.ConfigurationTarget.Global);
        }
        vscode.window.showInformationMessage(`Dynamic configuration regenerated! Dark seed: ${darkSeed.toString(16)}, Light seed: ${lightSeed.toString(16)}. Reload VS Code or switch themes to see changes.`);
    }
    catch (error) {
        vscode.window.showErrorMessage(`Failed to regenerate dynamic configuration: ${error}`);
    }
}
// --- Extension Entry --------------------------------------------------------
async function activate(context) {
    console.log('VibeColors Dynamic Theme extension is now active');
    // Initialize with random theme
    const rng = mulberry32(getSeed());
    const palette = makePalette(rng);
    await applyTheme(palette);
    // Register commands
    const refreshCommand = vscode.commands.registerCommand('vibeColors.refresh', () => refreshTheme());
    const refreshDarkCommand = vscode.commands.registerCommand('vibeColors.refreshDark', () => refreshTheme('dark'));
    const refreshLightCommand = vscode.commands.registerCommand('vibeColors.refreshLight', () => refreshTheme('light'));
    const switchVariantCommand = vscode.commands.registerCommand('vibeColors.switchVariant', switchVariant);
    const saveCommand = vscode.commands.registerCommand('vibeColors.savePalette', saveCurrentPalette);
    const loadCommand = vscode.commands.registerCommand('vibeColors.loadPalette', loadSavedPalette);
    const regenerateConfigCommand = vscode.commands.registerCommand('vibeColors.regenerateDynamicConfig', regenerateDynamicConfig);
    // Add to subscriptions
    context.subscriptions.push(refreshCommand, refreshDarkCommand, refreshLightCommand, switchVariantCommand, saveCommand, loadCommand, regenerateConfigCommand);
}
exports.activate = activate;
function deactivate() {
    console.log('VibeColors Dynamic Theme extension is now deactivated');
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map