import * as assert from 'assert/strict';
import { adjustBrightness, hslToHex, makePalette, mulberry32, withOpacity } from '../color-utils';

function testMulberry32Determinism() {
    const rngA = mulberry32(123456);
    const rngB = mulberry32(123456);
    const seqA = [rngA(), rngA(), rngA()];
    const seqB = [rngB(), rngB(), rngB()];

    assert.deepStrictEqual(seqA, seqB);
    assert.ok(seqA.every((value) => value >= 0 && value < 1));

    const rngC = mulberry32(123457);
    const seqC = [rngC(), rngC(), rngC()];
    assert.notDeepStrictEqual(seqA, seqC);
}

function testHslToHexKnownValues() {
    assert.equal(hslToHex(0, 0, 0), '#000000');
    assert.equal(hslToHex(0, 0, 100), '#ffffff');
    assert.equal(hslToHex(0, 100, 50), '#ff0000');
    assert.equal(hslToHex(120, 100, 50), '#00ff00');
    assert.equal(hslToHex(240, 100, 50), '#0000ff');
}

function testAdjustBrightness() {
    assert.equal(adjustBrightness('#000000', 10), '#1a1a1a');
    assert.equal(adjustBrightness('#ffffff', -10), '#e6e6e6');
}

function testWithOpacity() {
    assert.equal(withOpacity('#112233', 0.5), '#11223380');
}

function testMakePaletteShape() {
    const palette = makePalette(mulberry32(42), 'dark');
    const expectedKeys = [
        'background',
        'backgroundSecondary',
        'backgroundTertiary',
        'foreground',
        'foregroundSecondary',
        'accent1',
        'accent2',
        'accent3',
        'accent4',
        'error',
        'warning',
        'success',
        'info',
        'hint',
        'rosemaryRed',
        'desertGold',
        'selection',
        'highlight',
        'border'
    ];

    for (const key of expectedKeys) {
        assert.ok(key in palette, `Missing palette key: ${key}`);
        assert.match(palette[key as keyof typeof palette], /^#[0-9a-f]{6}([0-9a-f]{2})?$/i);
    }

    assert.equal(palette.selection.length, 9);
    assert.equal(palette.highlight.length, 9);
}

function testPaletteStylesDiffer() {
    const standard = makePalette(mulberry32(99), 'dark', 'standard');
    const vivid = makePalette(mulberry32(99), 'dark', 'vivid');
    const muted = makePalette(mulberry32(99), 'dark', 'muted');

    assert.notEqual(standard.accent1, vivid.accent1);
    assert.notEqual(standard.accent1, muted.accent1);
}

function run() {
    testMulberry32Determinism();
    testHslToHexKnownValues();
    testAdjustBrightness();
    testWithOpacity();
    testMakePaletteShape();
    testPaletteStylesDiffer();
    console.log('color-utils tests passed');
}

run();
