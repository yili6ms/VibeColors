import { describe, expect, it } from 'vitest';
import {
    getThemeFileName,
    getThemeName,
    getThemeStyleFromName,
    getThemeVariantFromName,
    isAutoTheme,
    isDynamicTheme
} from '../theme-naming';

describe('getThemeVariantFromName', () => {
    it('detects built-in dark themes', () => {
        expect(getThemeVariantFromName('VibeColors Dark')).toBe('dark');
        expect(getThemeVariantFromName('VibeColors High Contrast Dark')).toBe('dark');
        expect(getThemeVariantFromName('VibeColors Dynamic Vivid Dark')).toBe('dark');
    });

    it('detects built-in light themes', () => {
        expect(getThemeVariantFromName('VibeColors Light')).toBe('light');
        expect(getThemeVariantFromName('VibeColors Dynamic Muted Light')).toBe('light');
    });

    it('does not misclassify names that merely contain "light" as a substring', () => {
        expect(getThemeVariantFromName('Highlight Dark')).toBe('dark');
        expect(getThemeVariantFromName('Moonlight Midnight')).toBe('dark');
    });

    it('falls back to dark for unknown theme names', () => {
        expect(getThemeVariantFromName('Monokai')).toBe('dark');
        expect(getThemeVariantFromName('')).toBe('dark');
    });
});

describe('getThemeStyleFromName', () => {
    it('identifies vivid and muted variants', () => {
        expect(getThemeStyleFromName('VibeColors Dynamic Vivid Dark')).toBe('vivid');
        expect(getThemeStyleFromName('VibeColors Dynamic Muted Light')).toBe('muted');
    });

    it('identifies Auto themes', () => {
        expect(getThemeStyleFromName('VibeColors Auto Dark')).toBe('auto');
        expect(getThemeStyleFromName('VibeColors Auto Light')).toBe('auto');
    });

    it('defaults to standard when no style keyword is present', () => {
        expect(getThemeStyleFromName('VibeColors Dynamic Dark')).toBe('standard');
        expect(getThemeStyleFromName('VibeColors Dark')).toBe('standard');
        expect(getThemeStyleFromName('Monokai')).toBe('standard');
    });
});

describe('getThemeName / getThemeFileName', () => {
    it('round-trips every dynamic variant back to the expected label', () => {
        const cases = [
            { variant: 'dark' as const, style: 'standard' as const, label: 'VibeColors Dynamic Dark' },
            { variant: 'light' as const, style: 'standard' as const, label: 'VibeColors Dynamic Light' },
            { variant: 'dark' as const, style: 'vivid' as const, label: 'VibeColors Dynamic Vivid Dark' },
            { variant: 'light' as const, style: 'vivid' as const, label: 'VibeColors Dynamic Vivid Light' },
            { variant: 'dark' as const, style: 'muted' as const, label: 'VibeColors Dynamic Muted Dark' },
            { variant: 'light' as const, style: 'muted' as const, label: 'VibeColors Dynamic Muted Light' },
            { variant: 'dark' as const, style: 'auto' as const, label: 'VibeColors Auto Dark' },
            { variant: 'light' as const, style: 'auto' as const, label: 'VibeColors Auto Light' }
        ];

        for (const { variant, style, label } of cases) {
            expect(getThemeName(variant, style)).toBe(label);
            expect(getThemeVariantFromName(label)).toBe(variant);
            expect(getThemeStyleFromName(label)).toBe(style);
        }
    });

    it('builds file names that match the paths package.json contributes', () => {
        expect(getThemeFileName('dark', 'standard')).toBe('VibeColors-dynamic-dark-theme.json');
        expect(getThemeFileName('light', 'vivid')).toBe('VibeColors-dynamic-vivid-light-theme.json');
        expect(getThemeFileName('dark', 'muted')).toBe('VibeColors-dynamic-muted-dark-theme.json');
    });
});

describe('isDynamicTheme', () => {
    it('matches every dynamic and auto variant', () => {
        expect(isDynamicTheme('VibeColors Dynamic Dark')).toBe(true);
        expect(isDynamicTheme('VibeColors Dynamic Vivid Light')).toBe(true);
        expect(isDynamicTheme('VibeColors Dynamic Muted Dark')).toBe(true);
        expect(isDynamicTheme('VibeColors Auto Dark')).toBe(true);
        expect(isDynamicTheme('VibeColors Auto Light')).toBe(true);
    });

    it('rejects non-dynamic VibeColors themes and unrelated names', () => {
        expect(isDynamicTheme('VibeColors Dark')).toBe(false);
        expect(isDynamicTheme('VibeColors Ocean Dark')).toBe(false);
        expect(isDynamicTheme('Monokai')).toBe(false);
    });
});

describe('isAutoTheme', () => {
    it('matches only the Auto variants', () => {
        expect(isAutoTheme('VibeColors Auto Dark')).toBe(true);
        expect(isAutoTheme('VibeColors Auto Light')).toBe(true);
        expect(isAutoTheme('VibeColors Dynamic Dark')).toBe(false);
        expect(isAutoTheme('VibeColors Dark')).toBe(false);
        expect(isAutoTheme('Monokai')).toBe(false);
    });
});
