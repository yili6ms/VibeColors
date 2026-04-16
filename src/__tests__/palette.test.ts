import { describe, expect, it } from 'vitest';
import { ColorPalette, makePalette, mulberry32, withOpacity } from '../color-utils';

function expectHexColor(value: string, length: number) {
    expect(value).toMatch(new RegExp(`^#[0-9a-f]{${length}}$`, 'i'));
}

describe('withOpacity', () => {
    it('adds alpha information to 6 digit hex values', () => {
        expect(withOpacity('#112233', 0.5)).toBe('#11223380');
    });

    it('replaces existing alpha channel instead of appending', () => {
        expect(withOpacity('#445566cc', 0.25)).toBe('#44556640');
    });

    it('tolerates input without a leading #', () => {
        expect(withOpacity('112233', 1)).toBe('#112233ff');
    });
});

describe('makePalette', () => {
    it('produces deterministic palettes for the same seed', () => {
        const seed = 0x12345678;
        const paletteA = makePalette(mulberry32(seed), 'dark');
        const paletteB = makePalette(mulberry32(seed), 'dark');
        expect(paletteA).toEqual(paletteB);
    });

    it('generates valid color strings for each palette entry', () => {
        const palette = makePalette(mulberry32(0xdeadbeef), 'light');
        const eightCharKeys: Array<keyof ColorPalette> = ['selection', 'highlight'];

        Object.entries(palette).forEach(([key, value]) => {
            expectHexColor(value, eightCharKeys.includes(key as keyof ColorPalette) ? 8 : 6);
        });
    });

    it('produces different accents across styles for the same seed', () => {
        const standard = makePalette(mulberry32(99), 'dark', 'standard');
        const vivid = makePalette(mulberry32(99), 'dark', 'vivid');
        const muted = makePalette(mulberry32(99), 'dark', 'muted');

        expect(vivid.accent1).not.toBe(standard.accent1);
        expect(muted.accent1).not.toBe(standard.accent1);
    });
});
