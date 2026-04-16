import { PaletteStyle } from './color-utils';

export const STYLE_LABELS: Record<PaletteStyle, string> = {
    standard: 'Dynamic',
    vivid: 'Dynamic Vivid',
    muted: 'Dynamic Muted',
    auto: 'Auto'
};

export const STYLE_FILE_SEGMENTS: Record<PaletteStyle, string> = {
    standard: 'dynamic',
    vivid: 'dynamic-vivid',
    muted: 'dynamic-muted',
    auto: 'auto'
};

export type ThemeVariant = 'dark' | 'light';

export function getThemeVariantFromName(themeName: string): ThemeVariant {
    return /(?:^|\s)Light$/.test(themeName) ? 'light' : 'dark';
}

export function getThemeStyleFromName(themeName: string): PaletteStyle {
    if (themeName.startsWith('VibeColors Auto')) {
        return 'auto';
    }
    if (themeName.includes('Dynamic Vivid')) {
        return 'vivid';
    }
    if (themeName.includes('Dynamic Muted')) {
        return 'muted';
    }
    return 'standard';
}

export function getThemeName(variant: ThemeVariant, style: PaletteStyle): string {
    return `VibeColors ${STYLE_LABELS[style]} ${variant === 'dark' ? 'Dark' : 'Light'}`;
}

export function getThemeFileName(variant: ThemeVariant, style: PaletteStyle): string {
    return `VibeColors-${STYLE_FILE_SEGMENTS[style]}-${variant}-theme.json`;
}

export function isDynamicTheme(themeName: string): boolean {
    return themeName.startsWith('VibeColors Dynamic') || themeName.startsWith('VibeColors Auto');
}

export function isAutoTheme(themeName: string): boolean {
    return themeName.startsWith('VibeColors Auto');
}
