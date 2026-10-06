import { ColorPalette, PaletteStyle, adjustBrightness, withOpacity } from './color-utils';
import { ThemeVariant } from './theme-naming';

// Pure theme-document builder shared by the Dynamic/Auto and Shuffle themes.
// Kept free of `vscode` imports so it can be unit-tested and reused by scripts.

// Generated theme files record the palette they were built from, because the
// file (shared by all windows) is the only reliable record of what is shown.
// VS Code ignores unknown top-level keys in theme files.
export const PALETTE_METADATA_KEY = 'vibeColorsPalette';

export interface PaletteMetadata {
    seed: number;
    variant: ThemeVariant;
    style: PaletteStyle;
}

export function withPaletteMetadata<T extends object>(theme: T, metadata: PaletteMetadata): T {
    return { ...theme, [PALETTE_METADATA_KEY]: { ...metadata, seed: metadata.seed >>> 0 } };
}

export function readPaletteMetadata(theme: unknown): PaletteMetadata | undefined {
    const raw = (theme as Record<string, unknown> | null)?.[PALETTE_METADATA_KEY] as Partial<PaletteMetadata> | undefined;
    if (!raw || typeof raw.seed !== 'number' || !Number.isInteger(raw.seed) ||
        (raw.variant !== 'dark' && raw.variant !== 'light') ||
        !['standard', 'vivid', 'muted', 'auto'].includes(raw.style as string)) {
        return undefined;
    }
    return { seed: raw.seed >>> 0, variant: raw.variant, style: raw.style as PaletteStyle };
}

export function generateThemeConfig(palette: ColorPalette, themeName: string, isDark: boolean): any {
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
