#!/usr/bin/env node

/**
 * VibeColors Dynamic Theme Generator
 *
 * This script generates new random color schemes for the dynamic themes.
 * Run this script to get fresh random colors every time!
 *
 * Usage:
 *   node generate-dynamic-colors.js
 *
 * The script will output new theme configurations with random colors
 * that you can copy into the theme files.
 */

const fs = require('fs');
const path = require('path');

// Color generation utilities
function randomHex() {
    return Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
}

function randomColor() {
    return `#${randomHex()}${randomHex()}${randomHex()}`;
}

function generateHSL(h, s, l) {
    return `hsl(${h}, ${s}%, ${l}%)`;
}

function hslToHex(h, s, l) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

function generateRandomPalette(isDark = true) {
    // Generate a base hue (0-360)
    const baseHue = Math.floor(Math.random() * 360);

    // Generate complementary and triadic colors
    const complementaryHue = (baseHue + 180) % 360;
    const triadic1 = (baseHue + 120) % 360;
    const triadic2 = (baseHue + 240) % 360;

    if (isDark) {
        return {
            // Background colors (dark)
            background: hslToHex(baseHue, 30 + Math.random() * 20, 8 + Math.random() * 12),
            backgroundSecondary: hslToHex(baseHue, 25 + Math.random() * 15, 4 + Math.random() * 8),
            backgroundTertiary: hslToHex(baseHue, 35 + Math.random() * 25, 12 + Math.random() * 16),

            // Foreground colors (light)
            foreground: hslToHex(baseHue, 15 + Math.random() * 25, 85 + Math.random() * 10),
            foregroundSecondary: hslToHex(baseHue, 20 + Math.random() * 20, 70 + Math.random() * 15),

            // Accent colors (vibrant)
            accent1: hslToHex(complementaryHue, 60 + Math.random() * 30, 60 + Math.random() * 20),
            accent2: hslToHex(triadic1, 65 + Math.random() * 25, 55 + Math.random() * 25),
            accent3: hslToHex(triadic2, 70 + Math.random() * 20, 50 + Math.random() * 30),

            // Semantic colors
            error: hslToHex(0, 70 + Math.random() * 20, 55 + Math.random() * 15),
            warning: hslToHex(35 + Math.random() * 25, 75 + Math.random() * 15, 60 + Math.random() * 15),
            success: hslToHex(120 + Math.random() * 40, 60 + Math.random() * 25, 55 + Math.random() * 20),
            info: hslToHex(200 + Math.random() * 40, 65 + Math.random() * 25, 60 + Math.random() * 20),
            rosemaryRed: hslToHex(355 + Math.random() * 10, 45 + Math.random() * 15, 65 + Math.random() * 15),
            desertGold: hslToHex(45 + Math.random() * 15, 60 + Math.random() * 20, 70 + Math.random() * 15)
        };
    } else {
        return {
            // Background colors (light)
            background: hslToHex(baseHue, 20 + Math.random() * 30, 94 + Math.random() * 5),
            backgroundSecondary: hslToHex(baseHue, 15 + Math.random() * 25, 90 + Math.random() * 8),
            backgroundTertiary: hslToHex(baseHue, 25 + Math.random() * 35, 88 + Math.random() * 10),

            // Foreground colors (dark)
            foreground: hslToHex(baseHue, 30 + Math.random() * 20, 15 + Math.random() * 15),
            foregroundSecondary: hslToHex(baseHue, 25 + Math.random() * 25, 30 + Math.random() * 20),

            // Accent colors (saturated)
            accent1: hslToHex(complementaryHue, 55 + Math.random() * 35, 45 + Math.random() * 25),
            accent2: hslToHex(triadic1, 60 + Math.random() * 30, 40 + Math.random() * 30),
            accent3: hslToHex(triadic2, 65 + Math.random() * 25, 35 + Math.random() * 35),

            // Semantic colors
            error: hslToHex(0, 65 + Math.random() * 25, 45 + Math.random() * 20),
            warning: hslToHex(30 + Math.random() * 30, 70 + Math.random() * 20, 50 + Math.random() * 20),
            success: hslToHex(120 + Math.random() * 40, 55 + Math.random() * 30, 40 + Math.random() * 25),
            info: hslToHex(200 + Math.random() * 40, 60 + Math.random() * 30, 45 + Math.random() * 25),
            rosemaryRed: hslToHex(355 + Math.random() * 10, 45 + Math.random() * 15, 50 + Math.random() * 15),
            desertGold: hslToHex(45 + Math.random() * 15, 60 + Math.random() * 20, 55 + Math.random() * 15)
        };
    }
}

function generateThemeConfig(themeName, isDark = true) {
    const palette = generateRandomPalette(isDark);

    const themeConfig = {
        name: themeName,
        type: isDark ? "dark" : "light",
        colors: {
            "editor.background": palette.background,
            "editor.foreground": palette.foreground,
            "editorLineNumber.foreground": palette.foregroundSecondary + "80",
            "editorLineNumber.activeForeground": palette.accent1,
            "editorCursor.foreground": palette.accent1,
            "editor.selectionBackground": palette.backgroundTertiary,
            "editor.selectionHighlightBackground": palette.backgroundTertiary + "60",
            "editor.wordHighlightBackground": palette.foregroundSecondary + "40",
            "editor.wordHighlightStrongBackground": palette.foregroundSecondary + "60",
            "editor.findMatchBackground": palette.warning,
            "editor.findMatchHighlightBackground": palette.warning + "60",
            "editorBracketMatch.background": palette.backgroundTertiary,
            "editorBracketMatch.border": palette.accent1,
            "editorWhitespace.foreground": palette.backgroundTertiary,
            "editorIndentGuide.background1": palette.backgroundTertiary,
            "editorIndentGuide.activeBackground1": palette.foregroundSecondary,
            "editorRuler.foreground": palette.backgroundTertiary,
            "editor.lineHighlightBackground": palette.backgroundSecondary,
            "editorError.foreground": palette.error,
            "editorWarning.foreground": palette.warning,
            "editorInfo.foreground": palette.info,
            "editorHint.foreground": palette.success,

            "sideBar.background": palette.backgroundSecondary,
            "sideBar.foreground": palette.foregroundSecondary,
            "sideBarTitle.foreground": palette.foreground,
            "sideBarSectionHeader.background": palette.background,
            "sideBarSectionHeader.foreground": palette.accent1,

            "activityBar.background": palette.backgroundSecondary,
            "activityBar.foreground": palette.foregroundSecondary,
            "activityBar.activeBorder": palette.accent1,
            "activityBar.activeBackground": palette.backgroundTertiary,
            "activityBarBadge.background": palette.accent1,
            "activityBarBadge.foreground": isDark ? palette.backgroundSecondary : "#ffffff",

            "statusBar.background": palette.backgroundSecondary,
            "statusBar.foreground": palette.foregroundSecondary,
            "statusBarItem.activeBackground": palette.backgroundTertiary,
            "statusBarItem.hoverBackground": palette.backgroundTertiary + "80",

            "titleBar.activeBackground": palette.background,
            "titleBar.activeForeground": palette.foreground,
            "titleBar.inactiveBackground": palette.backgroundSecondary,
            "titleBar.inactiveForeground": palette.foregroundSecondary + "80",

            "tab.activeBackground": palette.background,
            "tab.activeForeground": palette.foreground,
            "tab.activeBorder": palette.accent1,
            "tab.inactiveBackground": palette.backgroundSecondary,
            "tab.inactiveForeground": palette.foregroundSecondary,
            "tab.border": palette.backgroundTertiary,

            "panel.background": palette.background,
            "panel.border": palette.backgroundTertiary,
            "panelTitle.activeBorder": palette.accent1,
            "panelTitle.activeForeground": palette.foreground,
            "panelTitle.inactiveForeground": palette.foregroundSecondary,

            "terminal.background": palette.background,
            "terminal.foreground": palette.foreground,
            "terminal.ansiBlack": palette.foregroundSecondary,
            "terminal.ansiRed": palette.error,
            "terminal.ansiGreen": palette.success,
            "terminal.ansiYellow": palette.warning,
            "terminal.ansiBlue": palette.info,
            "terminal.ansiMagenta": palette.accent1,
            "terminal.ansiCyan": palette.accent2,
            "terminal.ansiWhite": palette.foreground,

            "input.background": palette.backgroundSecondary,
            "input.border": palette.foregroundSecondary,
            "input.foreground": palette.foreground,
            "input.placeholderForeground": palette.foregroundSecondary + "80",

            "button.background": palette.accent1,
            "button.foreground": isDark ? palette.backgroundSecondary : "#ffffff",
            "button.hoverBackground": palette.accent1 + "cc",

            "list.activeSelectionBackground": palette.backgroundTertiary,
            "list.activeSelectionForeground": palette.foreground,
            "list.inactiveSelectionBackground": palette.backgroundSecondary,
            "list.hoverBackground": palette.backgroundTertiary + "80",
            "list.focusBackground": palette.backgroundTertiary,

            "scrollbarSlider.background": palette.foregroundSecondary + "80",
            "scrollbarSlider.hoverBackground": palette.foregroundSecondary + "a0",
            "scrollbarSlider.activeBackground": palette.foregroundSecondary + "c0",

            "badge.background": palette.accent1,
            "badge.foreground": isDark ? palette.backgroundSecondary : "#ffffff",
            "progressBar.background": palette.accent1,

            "editorWidget.background": palette.backgroundSecondary,
            "editorWidget.border": palette.foregroundSecondary,
            "editorSuggestWidget.background": palette.backgroundSecondary,
            "editorSuggestWidget.border": palette.foregroundSecondary,
            "editorSuggestWidget.selectedBackground": palette.backgroundTertiary,

            "peekView.border": palette.accent1,
            "peekViewEditor.background": palette.backgroundSecondary,
            "peekViewResult.background": palette.background,
            "peekViewTitle.background": palette.backgroundSecondary
        },
        tokenColors: [
            {
                "name": "Comment",
                "scope": ["comment", "punctuation.definition.comment"],
                "settings": {
                    "fontStyle": "italic",
                    "foreground": palette.foregroundSecondary + "80"
                }
            },
            {
                "name": "String",
                "scope": ["string"],
                "settings": {
                    "foreground": palette.success
                }
            },
            {
                "name": "Number",
                "scope": ["constant.numeric", "constant.language", "constant.character"],
                "settings": {
                    "foreground": palette.warning
                }
            },
            {
                "name": "Keyword",
                "scope": ["keyword", "storage.type", "storage.modifier"],
                "settings": {
                    "foreground": palette.accent1
                }
            },
            {
                "name": "Function",
                "scope": ["entity.name.function", "meta.function-call", "variable.function", "support.function"],
                "settings": {
                    "foreground": palette.info
                }
            },
            {
                "name": "Class",
                "scope": ["entity.name.class", "entity.name.type", "support.type", "support.class"],
                "settings": {
                    "foreground": palette.accent2
                }
            },
            {
                "name": "Variable",
                "scope": ["variable"],
                "settings": {
                    "foreground": palette.foreground
                }
            },
            {
                "name": "Tag",
                "scope": ["entity.name.tag"],
                "settings": {
                    "foreground": palette.error
                }
            },
            {
                "name": "Attribute",
                "scope": ["entity.other.attribute-name"],
                "settings": {
                    "foreground": palette.accent3
                }
            },
            {
                "name": "Operator",
                "scope": ["keyword.control", "punctuation", "keyword.operator"],
                "settings": {
                    "foreground": palette.foregroundSecondary
                }
            }
        ]
    };

    return themeConfig;
}

// Generate new random themes
console.log("🎨 VibeColors Dynamic Theme Generator");
console.log("=====================================");
console.log("");

const darkTheme = generateThemeConfig("VibeColors Dynamic Dark", true);
const lightTheme = generateThemeConfig("VibeColors Dynamic Light", false);

console.log("🌑 NEW DYNAMIC DARK THEME:");
console.log("Copy this to VibeColors-dynamic-dark-theme.json:");
console.log("```json");
console.log(JSON.stringify(darkTheme, null, "\t"));
console.log("```");
console.log("");

console.log("☀️ NEW DYNAMIC LIGHT THEME:");
console.log("Copy this to VibeColors-dynamic-light-theme.json:");
console.log("```json");
console.log(JSON.stringify(lightTheme, null, "\t"));
console.log("```");
console.log("");

console.log("💡 TIP: Run this script again to generate completely new random colors!");
console.log("💡 TIP: Reload VS Code after updating the theme files to see the changes.");

// Optionally write directly to files
const themesDir = path.join(__dirname, 'themes');
if (fs.existsSync(themesDir)) {
    try {
        fs.writeFileSync(
            path.join(themesDir, 'VibeColors-dynamic-dark-theme.json'),
            JSON.stringify(darkTheme, null, "\t")
        );
        fs.writeFileSync(
            path.join(themesDir, 'VibeColors-dynamic-light-theme.json'),
            JSON.stringify(lightTheme, null, "\t")
        );
        console.log("✅ Theme files have been automatically updated!");
        console.log("🔄 Reload VS Code or switch themes to see the new colors.");
    } catch (error) {
        console.log("⚠️  Could not write theme files automatically. Copy the JSON above manually.");
    }
}