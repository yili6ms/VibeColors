import { describe, expect, it } from 'vitest';
import * as path from 'path';
import { makePalette, mulberry32 } from '../color-utils';
import {
    CURATED_SEEDS,
    SESSION_HEARTBEAT_MS,
    SESSION_TIMEOUT_MS,
    SHUFFLE_SOURCES,
    SharedShuffleState,
    ShuffleEntry,
    ShufflePlaylist,
    buildShuffleEntries,
    builtinThemeCandidates,
    decideRebuild,
    deriveSeed,
    formatSeed,
    isSessionAlive,
    normalizeSources,
    parseSeed,
    parseSeedSpec,
    parseSharedState,
    parseShuffleEntry,
    shuffleItems,
    switchedRecently
} from '../shuffle';

const darkThemes = [
    { label: 'VibeColors Neon Dark', path: '/ext/themes/neon.json', variant: 'dark' as const },
    { label: 'VibeColors Ocean Dark', path: '/ext/themes/ocean.json', variant: 'dark' as const }
];
const lightThemes = [{ label: 'VibeColors Pastel Light', path: '/ext/themes/pastel.json', variant: 'light' as const }];

function seedEntries(count: number): ShuffleEntry[] {
    return Array.from({ length: count }, (_, i) => ({
        kind: 'seed' as const,
        id: `seed:${i}`,
        label: `Entry ${i}`,
        seed: i,
        style: 'standard' as const,
        origin: 'user' as const
    }));
}

function luminance(hex: string): number {
    const n = parseInt(hex.slice(1, 7), 16);
    const channel = (v: number) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(n >> 16) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

function contrast(a: string, b: string): number {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

describe('parseSeed / parseSeedSpec', () => {
    it('accepts numbers and hex strings with or without 0x', () => {
        expect(parseSeed(42)).toBe(42);
        expect(parseSeed('ff')).toBe(255);
        expect(parseSeed('0xF908E95E')).toBe(0xf908e95e);
        expect(parseSeed(' 2b3bb345 ')).toBe(0x2b3bb345);
    });

    it('normalizes numbers to unsigned 32-bit integers', () => {
        expect(parseSeed(-1)).toBe(0xffffffff);
        expect(parseSeed(12.9)).toBe(12);
    });

    it('rejects invalid values', () => {
        expect(parseSeed('xyz')).toBeUndefined();
        expect(parseSeed('123456789')).toBeUndefined();
        expect(parseSeed(Number.NaN)).toBeUndefined();
        expect(parseSeed(undefined)).toBeUndefined();
        expect(parseSeed({})).toBeUndefined();
    });

    it('parses optional style suffixes', () => {
        expect(parseSeedSpec('2b3bb345:vivid')).toEqual({ seed: 0x2b3bb345, style: 'vivid' });
        expect(parseSeedSpec('2b3bb345')).toEqual({ seed: 0x2b3bb345, style: 'standard' });
        expect(parseSeedSpec(7)).toEqual({ seed: 7, style: 'standard' });
        expect(parseSeedSpec('2b3bb345:auto')).toBeUndefined();
        expect(parseSeedSpec('2b3bb345:vivid:x')).toBeUndefined();
    });

    it('formats seeds as zero-padded hex', () => {
        expect(formatSeed(0xff)).toBe('000000ff');
        expect(parseSeed(formatSeed(0xd064178e))).toBe(0xd064178e);
    });
});

describe('normalizeSources', () => {
    it('defaults to every source and drops unknown values', () => {
        expect(normalizeSources(undefined)).toEqual([...SHUFFLE_SOURCES]);
        expect(normalizeSources(['random', 'bogus', 'builtinThemes'])).toEqual(['builtinThemes', 'random']);
        expect(normalizeSources([])).toEqual([]);
    });
});

describe('builtinThemeCandidates', () => {
    it('keeps only static themes and maps uiTheme to a variant', () => {
        const candidates = builtinThemeCandidates([
            { label: 'VibeColors Neon Dark', uiTheme: 'vs-dark', path: './themes/neon.json' },
            { label: 'VibeColors Pastel Light', uiTheme: 'vs', path: './themes/pastel.json' },
            { label: 'VibeColors Dynamic Dark', uiTheme: 'vs-dark', path: './themes/dyn.json' },
            { label: 'VibeColors Auto Light', uiTheme: 'vs', path: './themes/auto.json' },
            { label: 'VibeColors Shuffle Dark', uiTheme: 'vs-dark', path: './themes/shuffle.json' }
        ], '/ext');

        expect(candidates).toEqual([
            { label: 'VibeColors Neon Dark', path: path.join('/ext', './themes/neon.json'), variant: 'dark' },
            { label: 'VibeColors Pastel Light', path: path.join('/ext', './themes/pastel.json'), variant: 'light' }
        ]);
    });
});

describe('buildShuffleEntries', () => {
    const base = {
        sessionSeed: 1234,
        sources: SHUFFLE_SOURCES,
        builtinThemes: [...darkThemes, ...lightThemes],
        randomCount: 3
    };

    it('only includes entries for the requested variant', () => {
        const dark = buildShuffleEntries({ ...base, variant: 'dark' });
        const light = buildShuffleEntries({ ...base, variant: 'light' });

        expect(dark.filter(e => e.kind === 'themeFile').map(e => e.label)).toEqual(['VibeColors Neon Dark', 'VibeColors Ocean Dark']);
        expect(light.filter(e => e.kind === 'themeFile').map(e => e.label)).toEqual(['VibeColors Pastel Light']);
        expect(dark.filter(e => e.kind === 'seed' && e.origin === 'builtin').map(e => e.label))
            .toEqual(CURATED_SEEDS.filter(c => c.variant === 'dark').map(c => c.name));
    });

    it('pre-generates the same random seeds for the same session seed', () => {
        const random = (sessionSeed: number) => buildShuffleEntries({ ...base, variant: 'dark', sessionSeed, sources: ['random'] });

        expect(random(1234)).toEqual(random(1234));
        expect(random(1234)).toHaveLength(3);
        expect(random(1234).map(e => e.id)).not.toEqual(random(5678).map(e => e.id));
        expect(random(1234).every(e => e.kind === 'seed' && e.origin === 'random')).toBe(true);
    });

    it('respects the selected sources', () => {
        const entries = buildShuffleEntries({ ...base, variant: 'dark', sources: ['builtinThemes'] });
        expect(entries.map(e => e.label)).toEqual(['VibeColors Neon Dark', 'VibeColors Ocean Dark']);
    });

    it('adds user seeds, user theme files and matching saved palettes without duplicates', () => {
        const entries = buildShuffleEntries({
            ...base,
            variant: 'light',
            sources: ['themeFiles', 'seeds', 'savedPalettes'],
            themeFiles: [
                { label: 'Mine', path: '/home/me/mine.json', variant: 'light' },
                { label: 'Untyped', path: '/home/me/untyped.json', variant: undefined }
            ],
            userSeeds: ['0xabc:muted', 'abc:muted', 99, 'not-a-seed'],
            savedPalettes: [
                { name: 'Fav light', seed: 5, variant: 'light', style: 'vivid' },
                { name: 'Fav dark', seed: 6, variant: 'dark' },
                { name: 'Any', seed: 7 },
                { name: 'Dup of user seed', seed: 99, style: 'standard' }
            ]
        });

        expect(entries.map(e => [e.label, e.id])).toEqual([
            ['Mine', 'file:/home/me/mine.json'],
            ['Seed 00000abc', 'seed:00000abc:muted'],
            ['Seed 00000063', 'seed:00000063:standard'],
            ['Fav light', 'seed:00000005:vivid'],
            ['Any', 'seed:00000007:standard']
        ]);
    });

    it('falls back to one random palette when nothing else is available', () => {
        const entries = buildShuffleEntries({ ...base, variant: 'dark', sources: [] });
        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({ kind: 'seed', origin: 'random' });
    });
});

describe('ShufflePlaylist', () => {
    it('is deterministic for a given seed and differs between seeds', () => {
        const ids = (seed: number) => new ShufflePlaylist(seedEntries(10), seed).entries.map(e => e.id);
        expect(ids(1)).toEqual(ids(1));
        expect(ids(1)).not.toEqual(ids(2));
    });

    it('plays every entry once per round and never repeats across rounds', () => {
        const entries = seedEntries(6);
        const playlist = new ShufflePlaylist(entries, 42);
        const played = [playlist.current!.id];
        for (let i = 0; i < 6 * 20 - 1; i++) {
            played.push(playlist.next()!.id);
        }

        for (let round = 0; round < 20; round++) {
            expect(new Set(played.slice(round * 6, round * 6 + 6)).size).toBe(6);
        }
        for (let i = 1; i < played.length; i++) {
            expect(played[i]).not.toBe(played[i - 1]);
        }
    });

    it('keeps returning the only entry of a single-entry playlist', () => {
        const playlist = new ShufflePlaylist(seedEntries(1), 3);
        expect(playlist.next()?.id).toBe('seed:0');
        expect(playlist.next()?.id).toBe('seed:0');
    });

    it('jumps to a selected entry and continues from there', () => {
        const playlist = new ShufflePlaylist(seedEntries(5), 9);
        const order = playlist.entries.map(e => e.id);
        expect(playlist.select(order[3])?.id).toBe(order[3]);
        expect(playlist.next()?.id).toBe(order[4]);
        expect(playlist.select('missing')).toBeUndefined();
    });

    it('continues with the following entry after the current one is removed', () => {
        const playlist = new ShufflePlaylist(seedEntries(4), 5);
        const order = playlist.entries.map(e => e.id);
        playlist.select(order[1]);
        playlist.remove(order[1]);
        expect(playlist.entries).toHaveLength(3);
        expect(playlist.next()?.id).toBe(order[2]);

        const first = new ShufflePlaylist(seedEntries(3), 5);
        const firstOrder = first.entries.map(e => e.id);
        first.remove(firstOrder[0]);
        expect(first.current).toBeUndefined();
        expect(first.next()?.id).toBe(firstOrder[1]);
    });

    it('returns undefined once every entry is removed', () => {
        const playlist = new ShufflePlaylist(seedEntries(1), 5);
        playlist.remove('seed:0');
        expect(playlist.next()).toBeUndefined();
    });

    it('adopts an entry another window switched to, then continues its own order', () => {
        const playlist = new ShufflePlaylist(seedEntries(4), 8);
        const order = playlist.entries.map(e => e.id);
        playlist.select(order[1]);
        const foreign: ShuffleEntry = { kind: 'themeFile', id: 'file:/p1/mine.json', label: 'Mine', path: '/p1/mine.json', origin: 'user' };

        expect(playlist.adopt(foreign)).toBe(foreign);
        expect(playlist.current?.id).toBe(foreign.id);
        expect(playlist.entries).toHaveLength(5);
        expect(playlist.contains(foreign.id)).toBe(false);
        expect(playlist.contains(order[0])).toBe(true);
        expect(playlist.next()?.id).toBe(order[2]);

        // Adopting a known entry just selects it.
        playlist.adopt(playlist.entries.find(e => e.id === order[0])!);
        expect(playlist.current?.id).toBe(order[0]);
        expect(playlist.entries).toHaveLength(5);
    });

    it('can adopt into an empty playlist', () => {
        const playlist = new ShufflePlaylist([], 1);
        playlist.adopt(seedEntries(1)[0]);
        expect(playlist.current?.id).toBe('seed:0');
    });
});

describe('shuffleItems / deriveSeed', () => {
    it('returns a permutation without mutating the input', () => {
        const input = [1, 2, 3, 4, 5, 6, 7, 8];
        const output = shuffleItems(input, mulberry32(1));
        expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
        expect([...output].sort((a, b) => a - b)).toEqual(input);
    });

    it('derives distinct seeds per variant and purpose', () => {
        const seeds = new Set([
            deriveSeed(1, 'dark', 'order'),
            deriveSeed(1, 'dark', 'random'),
            deriveSeed(1, 'light', 'order'),
            deriveSeed(1, 'light', 'random')
        ]);
        expect(seeds.size).toBe(4);
        expect(deriveSeed(1, 'dark', 'order')).toBe(deriveSeed(1, 'dark', 'order'));
    });
});

describe('shared session state', () => {
    const state = (overrides: Partial<SharedShuffleState> = {}): SharedShuffleState => ({
        sessionSeed: 7,
        startedAt: 1_000_000,
        heartbeat: 1_000_000,
        entries: { dark: { id: 'seed:00000001:standard', at: 1_000_000 } },
        ...overrides
    });

    it('parses valid state and drops malformed entries', () => {
        expect(parseSharedState({
            sessionSeed: 7,
            startedAt: 3,
            heartbeat: 5,
            entries: { dark: { id: 'a', at: 1 }, light: { id: 2, at: 'x' }, other: { id: 'b', at: 3 } }
        })).toEqual({ sessionSeed: 7, startedAt: 3, heartbeat: 5, entries: { dark: { id: 'a', at: 1 } } });
        expect(parseSharedState({ sessionSeed: 'ff', heartbeat: 1 })).toEqual({ sessionSeed: 255, startedAt: 0, heartbeat: 1, entries: {} });
    });

    it('keeps the full entry so windows with other playlists can follow it', () => {
        const file = { kind: 'themeFile', id: 'file:/p1/mine.json', label: 'Mine', path: '/p1/mine.json', origin: 'user' };
        const seed = { kind: 'seed', id: 'seed:0000000a:vivid', label: 'Seed 0000000a', seed: 10, style: 'vivid', origin: 'user' };
        const parsed = parseSharedState(JSON.parse(JSON.stringify({
            sessionSeed: 1,
            heartbeat: 1,
            entries: { dark: { id: file.id, at: 1, entry: file }, light: { id: seed.id, at: 2, entry: seed } }
        })));
        expect(parsed?.entries.dark?.entry).toEqual(file);
        expect(parsed?.entries.light?.entry).toEqual(seed);
    });

    it('drops invalid or mismatched entry descriptors but keeps the id', () => {
        expect(parseShuffleEntry({ kind: 'seed', id: 'x', label: 'x', seed: 1, style: 'auto', origin: 'user' })).toBeUndefined();
        expect(parseShuffleEntry({ kind: 'themeFile', id: 'x', label: 'x', origin: 'user' })).toBeUndefined();
        expect(parseShuffleEntry('nope')).toBeUndefined();
        const parsed = parseSharedState({
            sessionSeed: 1,
            heartbeat: 1,
            entries: { dark: { id: 'a', at: 1, entry: { kind: 'themeFile', id: 'b', label: 'B', path: '/b', origin: 'user' } } }
        });
        expect(parsed?.entries.dark).toEqual({ id: 'a', at: 1 });
    });

    it('rejects state without a seed or heartbeat', () => {
        expect(parseSharedState(null)).toBeUndefined();
        expect(parseSharedState({ heartbeat: 1 })).toBeUndefined();
        expect(parseSharedState({ sessionSeed: 1 })).toBeUndefined();
    });

    it('treats a session as alive until its heartbeat times out', () => {
        expect(isSessionAlive(state(), 1_000_000 + SESSION_TIMEOUT_MS - 1)).toBe(true);
        expect(isSessionAlive(state(), 1_000_000 + SESSION_TIMEOUT_MS)).toBe(false);
        expect(SESSION_HEARTBEAT_MS * 2).toBeLessThan(SESSION_TIMEOUT_MS);
    });

    it('lets only the first window per interval switch a variant', () => {
        const interval = 600_000;
        expect(switchedRecently(state(), 'dark', 1_000_000 + 30_000, interval)).toBe(true);
        expect(switchedRecently(state(), 'dark', 1_000_000 + interval, interval)).toBe(false);
        // A timer firing a little early in the window that switched last still rotates.
        expect(switchedRecently(state(), 'dark', 1_000_000 + interval * 0.95, interval)).toBe(false);
        expect(switchedRecently(state(), 'light', 1_000_000, interval)).toBe(false);
    });
});

describe('decideRebuild', () => {
    it('keeps an entry that is still listed', () => {
        expect(decideRebuild({ id: 'a', listedNow: true, listedBefore: true, adoptable: true })).toBe('keep');
    });

    it('keeps following an entry adopted from another window', () => {
        expect(decideRebuild({ id: 'a', listedNow: false, listedBefore: false, adoptable: true })).toBe('follow');
    });

    it('re-picks when this window\'s own sources dropped the entry', () => {
        expect(decideRebuild({ id: 'a', listedNow: false, listedBefore: true, adoptable: true })).toBe('repick');
    });

    it('re-picks when there is nothing to follow', () => {
        expect(decideRebuild({ id: 'a', listedNow: false, listedBefore: false, adoptable: false })).toBe('repick');
        expect(decideRebuild({ id: undefined, listedNow: false, listedBefore: false, adoptable: false })).toBe('repick');
    });
});

describe('CURATED_SEEDS', () => {
    it('has unique seeds and names with dark and light coverage', () => {
        expect(new Set(CURATED_SEEDS.map(c => c.name)).size).toBe(CURATED_SEEDS.length);
        expect(new Set(CURATED_SEEDS.map(c => `${c.seed}:${c.variant}`)).size).toBe(CURATED_SEEDS.length);
        expect(CURATED_SEEDS.filter(c => c.variant === 'dark').length).toBeGreaterThanOrEqual(6);
        expect(CURATED_SEEDS.filter(c => c.variant === 'light').length).toBeGreaterThanOrEqual(6);
    });

    // Guards the curation if the palette generator changes.
    it('keeps readable text contrast', () => {
        for (const curated of CURATED_SEEDS) {
            const palette = makePalette(mulberry32(curated.seed), curated.variant, curated.style);
            const minimum = curated.variant === 'dark' ? 10 : 7;
            expect(contrast(palette.foreground, palette.background), curated.name).toBeGreaterThanOrEqual(minimum);
            expect(contrast(palette.foregroundSecondary, palette.background), curated.name).toBeGreaterThanOrEqual(3);
        }
    });

    it('keeps dark syntax accents at WCAG AA contrast', () => {
        for (const curated of CURATED_SEEDS.filter(c => c.variant === 'dark')) {
            const palette = makePalette(mulberry32(curated.seed), 'dark', curated.style);
            for (const key of ['accent1', 'accent2', 'accent3', 'accent4', 'error', 'success', 'info', 'hint'] as const) {
                expect(contrast(palette[key], palette.background), `${curated.name}.${key}`).toBeGreaterThanOrEqual(4.5);
            }
        }
    });
});
