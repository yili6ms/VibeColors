import { describe, expect, it } from 'vitest';
import { makePalette, mulberry32, withOpacity, ColorPalette } from '../palette';

function expectHexColor(value: string, length: number) {
    expect(value).toMatch(new RegExp(`^#[0-9a-f]{${length}}$`, 'i'));
}

describe('withOpacity', () => {
    it('adds alpha information to 6 digit hex values', () => {
        const result = withOpacity('#112233', 0.5);
        expect(result).toBe('#11223380');
    });

    it('replaces existing alpha channel instead of appending', () => {
        const result = withOpacity('#445566cc', 0.25);
        expect(result).toBe('#44556640');
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
            if (eightCharKeys.includes(key as keyof ColorPalette)) {
                expectHexColor(value, 8);
            } else {
                expectHexColor(value, 6);
            }
        });
    });
});
