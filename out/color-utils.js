"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makePalette = exports.withOpacity = exports.adjustBrightness = exports.hslToHex = exports.mulberry32 = void 0;
// --- Random Number Generator ------------------------------------------------
function mulberry32(seed) {
    return function () {
        let t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}
exports.mulberry32 = mulberry32;
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
exports.hslToHex = hslToHex;
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
exports.adjustBrightness = adjustBrightness;
function withOpacity(hex, opacity) {
    const alpha = Math.round(opacity * 255).toString(16).padStart(2, '0');
    return hex + alpha;
}
exports.withOpacity = withOpacity;
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
function shiftRange(range, delta, min = 0, max = 100) {
    return [
        clamp(range[0] + delta, min, max),
        clamp(range[1] + delta, min, max)
    ];
}
function applyStyle(params, style, isDark) {
    if (style === 'standard') {
        return params;
    }
    const saturationDelta = style === 'vivid' ? 12 : -12;
    const accentLightDelta = style === 'vivid' ? 6 : -6;
    const bgLightDelta = style === 'vivid' ? (isDark ? -2 : 1) : (isDark ? 2 : -1);
    const fgLightDelta = style === 'vivid' ? (isDark ? 0 : -1) : (isDark ? -2 : 2);
    return {
        bgSaturation: shiftRange(params.bgSaturation, saturationDelta),
        bgLightness: shiftRange(params.bgLightness, bgLightDelta),
        fgSaturation: shiftRange(params.fgSaturation, saturationDelta * 0.5),
        fgLightness: shiftRange(params.fgLightness, fgLightDelta),
        accentSaturation: shiftRange(params.accentSaturation, saturationDelta),
        accentLightness: shiftRange(params.accentLightness, accentLightDelta)
    };
}
function generateHarmonizedPalette(rng, isDark, style) {
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
    const baseParams = isDark ? {
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
    const params = applyStyle(baseParams, style, isDark);
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
function makePalette(rng, variant = 'dark', style = 'standard') {
    return generateHarmonizedPalette(rng, variant === 'dark', style);
}
exports.makePalette = makePalette;
//# sourceMappingURL=color-utils.js.map