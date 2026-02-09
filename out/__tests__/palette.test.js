"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const palette_1 = require("../palette");
function expectHexColor(value, length) {
    (0, vitest_1.expect)(value).toMatch(new RegExp(`^#[0-9a-f]{${length}}$`, 'i'));
}
(0, vitest_1.describe)('withOpacity', () => {
    (0, vitest_1.it)('adds alpha information to 6 digit hex values', () => {
        const result = (0, palette_1.withOpacity)('#112233', 0.5);
        (0, vitest_1.expect)(result).toBe('#11223380');
    });
    (0, vitest_1.it)('replaces existing alpha channel instead of appending', () => {
        const result = (0, palette_1.withOpacity)('#445566cc', 0.25);
        (0, vitest_1.expect)(result).toBe('#44556640');
    });
});
(0, vitest_1.describe)('makePalette', () => {
    (0, vitest_1.it)('produces deterministic palettes for the same seed', () => {
        const seed = 0x12345678;
        const paletteA = (0, palette_1.makePalette)((0, palette_1.mulberry32)(seed), 'dark');
        const paletteB = (0, palette_1.makePalette)((0, palette_1.mulberry32)(seed), 'dark');
        (0, vitest_1.expect)(paletteA).toEqual(paletteB);
    });
    (0, vitest_1.it)('generates valid color strings for each palette entry', () => {
        const palette = (0, palette_1.makePalette)((0, palette_1.mulberry32)(0xdeadbeef), 'light');
        const eightCharKeys = ['selection', 'highlight'];
        Object.entries(palette).forEach(([key, value]) => {
            if (eightCharKeys.includes(key)) {
                expectHexColor(value, 8);
            }
            else {
                expectHexColor(value, 6);
            }
        });
    });
});
//# sourceMappingURL=palette.test.js.map