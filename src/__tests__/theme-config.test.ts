import { describe, expect, it } from 'vitest';
import { makePalette, mulberry32 } from '../color-utils';
import { PALETTE_METADATA_KEY, generateThemeConfig, readPaletteMetadata, withPaletteMetadata } from '../theme-config';

describe('palette metadata', () => {
    const theme = generateThemeConfig(makePalette(mulberry32(1), 'dark', 'vivid'), 'VibeColors Auto Dark', true);

    it('round-trips through a serialized theme file', () => {
        const withMeta = withPaletteMetadata(theme, { seed: 0xd064178e, variant: 'dark', style: 'auto' });
        const reloaded = JSON.parse(JSON.stringify(withMeta));
        expect(readPaletteMetadata(reloaded)).toEqual({ seed: 0xd064178e, variant: 'dark', style: 'auto' });
        expect(reloaded.colors).toEqual(theme.colors);
    });

    it('does not mutate the theme it decorates', () => {
        withPaletteMetadata(theme, { seed: 1, variant: 'light', style: 'standard' });
        expect(theme[PALETTE_METADATA_KEY]).toBeUndefined();
    });

    it('ignores themes without valid metadata', () => {
        expect(readPaletteMetadata(theme)).toBeUndefined();
        expect(readPaletteMetadata(null)).toBeUndefined();
        expect(readPaletteMetadata({ [PALETTE_METADATA_KEY]: { seed: 'x', variant: 'dark', style: 'vivid' } })).toBeUndefined();
        expect(readPaletteMetadata({ [PALETTE_METADATA_KEY]: { seed: 1, variant: 'dim', style: 'vivid' } })).toBeUndefined();
        expect(readPaletteMetadata({ [PALETTE_METADATA_KEY]: { seed: 1, variant: 'dark', style: 'loud' } })).toBeUndefined();
    });
});
