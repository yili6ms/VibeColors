import { describe, expect, it } from 'vitest';
import { adjustBrightness, hslToHex, mulberry32, withOpacity } from '../color-utils';

describe('mulberry32', () => {
    it('is deterministic for a given seed', () => {
        const a = mulberry32(123456);
        const b = mulberry32(123456);
        for (let i = 0; i < 5; i++) {
            expect(a()).toBe(b());
        }
    });

    it('produces distinct sequences for different seeds', () => {
        const a = mulberry32(123456);
        const b = mulberry32(123457);
        const seqA = [a(), a(), a()];
        const seqB = [b(), b(), b()];
        expect(seqA).not.toEqual(seqB);
    });

    it('yields values within [0, 1)', () => {
        const rng = mulberry32(1);
        for (let i = 0; i < 100; i++) {
            const value = rng();
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThan(1);
        }
    });
});

describe('hslToHex', () => {
    it('produces the canonical corner values', () => {
        expect(hslToHex(0, 0, 0)).toBe('#000000');
        expect(hslToHex(0, 0, 100)).toBe('#ffffff');
        expect(hslToHex(0, 100, 50)).toBe('#ff0000');
        expect(hslToHex(120, 100, 50)).toBe('#00ff00');
        expect(hslToHex(240, 100, 50)).toBe('#0000ff');
    });
});

describe('adjustBrightness', () => {
    it('brightens pure black by the expected amount', () => {
        expect(adjustBrightness('#000000', 10)).toBe('#1a1a1a');
    });

    it('darkens pure white by the expected amount', () => {
        expect(adjustBrightness('#ffffff', -10)).toBe('#e6e6e6');
    });

    it('ignores an existing alpha channel in the input', () => {
        expect(adjustBrightness('#00000080', 10)).toBe('#1a1a1a');
    });
});

describe('withOpacity', () => {
    it('appends alpha to 6-digit hex input', () => {
        expect(withOpacity('#112233', 0.5)).toBe('#11223380');
    });

    it('replaces an existing alpha channel instead of appending', () => {
        expect(withOpacity('#44556680', 0.5)).toBe('#44556680');
        expect(withOpacity('#445566cc', 0.25)).toBe('#44556640');
    });

    it('tolerates input without a leading #', () => {
        expect(withOpacity('112233', 1)).toBe('#112233ff');
    });
});
