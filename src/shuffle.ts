import * as path from 'path';
import { PaletteStyle, mulberry32 } from './color-utils';
import { ThemeVariant, isDynamicTheme, isShuffleTheme } from './theme-naming';

// Styles a seed entry can be rendered with. `auto` is only a scheduling
// marker for the Auto themes, so it is folded into `standard` here.
export type SeedStyle = Exclude<PaletteStyle, 'auto'>;

export type ShuffleSource = 'builtinThemes' | 'themeFiles' | 'builtinSeeds' | 'seeds' | 'savedPalettes' | 'random';

export const SHUFFLE_SOURCES: readonly ShuffleSource[] = [
    'builtinThemes',
    'themeFiles',
    'builtinSeeds',
    'seeds',
    'savedPalettes',
    'random'
];

export interface ThemeFileEntry {
    kind: 'themeFile';
    id: string;
    label: string;
    path: string;
    origin: 'builtin' | 'user';
}

export interface SeedEntry {
    kind: 'seed';
    id: string;
    label: string;
    seed: number;
    style: SeedStyle;
    origin: 'builtin' | 'user' | 'saved' | 'random';
}

export type ShuffleEntry = ThemeFileEntry | SeedEntry;

export interface CuratedSeed {
    name: string;
    seed: number;
    style: SeedStyle;
    variant: ThemeVariant;
}

// Pre-generated seeds, picked by scanning tens of thousands of candidates for
// WCAG contrast (foreground and syntax accents vs. background) and keeping the
// best one per hue band so the playlist spans the color wheel.
export const CURATED_SEEDS: readonly CuratedSeed[] = [
    { name: 'Ember', seed: 0xf908e95e, style: 'standard', variant: 'dark' },
    { name: 'Driftwood', seed: 0x0d335252, style: 'muted', variant: 'dark' },
    { name: 'Fern', seed: 0x4b9d5fb9, style: 'vivid', variant: 'dark' },
    { name: 'Jade', seed: 0x47c58513, style: 'standard', variant: 'dark' },
    { name: 'Lagoon', seed: 0x2b3bb345, style: 'vivid', variant: 'dark' },
    { name: 'Slate', seed: 0xba1745f8, style: 'muted', variant: 'dark' },
    { name: 'Ultraviolet', seed: 0xd064178e, style: 'vivid', variant: 'dark' },
    { name: 'Rosewood', seed: 0xaf8418ca, style: 'standard', variant: 'dark' },
    { name: 'Blush', seed: 0xf29ca1b4, style: 'standard', variant: 'light' },
    { name: 'Apricot', seed: 0x23b07c1b, style: 'vivid', variant: 'light' },
    { name: 'Sand', seed: 0x3e14f660, style: 'muted', variant: 'light' },
    { name: 'Meadow', seed: 0x6d951a8a, style: 'vivid', variant: 'light' },
    { name: 'Mint', seed: 0x7dca3eb8, style: 'muted', variant: 'light' },
    { name: 'Glacier', seed: 0x3eb1a573, style: 'muted', variant: 'light' },
    { name: 'Lavender', seed: 0x69455d82, style: 'standard', variant: 'light' },
    { name: 'Peony', seed: 0x6dd392a3, style: 'muted', variant: 'light' }
];

const SEED_STYLES: readonly SeedStyle[] = ['standard', 'vivid', 'muted'];

// --- Seeds ------------------------------------------------------------------

export function formatSeed(seed: number): string {
    return (seed >>> 0).toString(16).padStart(8, '0');
}

export function randomSeed(random: () => number = Math.random): number {
    return Math.floor(random() * 0x100000000) >>> 0;
}

/**
 * Parses a seed given as a number or as a hex string (the format VibeColors
 * shows seeds in, with or without a `0x` prefix).
 */
export function parseSeed(value: unknown): number | undefined {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? Math.trunc(value) >>> 0 : undefined;
    }
    if (typeof value === 'string') {
        const match = /^\s*(?:0x)?([0-9a-f]{1,8})\s*$/i.exec(value);
        return match ? parseInt(match[1], 16) >>> 0 : undefined;
    }
    return undefined;
}

/** Parses `seed`, `"hex"` or `"hex:style"` (style = standard | vivid | muted). */
export function parseSeedSpec(value: unknown): { seed: number; style: SeedStyle } | undefined {
    if (typeof value === 'string') {
        const [seedPart, stylePart, ...rest] = value.split(':');
        const style = (stylePart?.trim().toLowerCase() || 'standard') as SeedStyle;
        const seed = parseSeed(seedPart);
        if (rest.length || seed === undefined || !SEED_STYLES.includes(style)) {
            return undefined;
        }
        return { seed, style };
    }
    const seed = parseSeed(value);
    return seed === undefined ? undefined : { seed, style: 'standard' };
}

function toSeedStyle(style: PaletteStyle | undefined): SeedStyle {
    return style && style !== 'auto' && SEED_STYLES.includes(style) ? style : 'standard';
}

/** Derives an independent 32-bit seed for a purpose (e.g. ordering) from the session seed. */
export function deriveSeed(sessionSeed: number, variant: ThemeVariant, purpose: 'order' | 'random'): number {
    const salt = (variant === 'light' ? 0x9e3779b9 : 0x85ebca6b) ^ (purpose === 'order' ? 0x27d4eb2f : 0x165667b1);
    return randomSeed(mulberry32((sessionSeed ^ salt) >>> 0));
}

export function normalizeSources(value: unknown): ShuffleSource[] {
    if (!Array.isArray(value)) {
        return [...SHUFFLE_SOURCES];
    }
    return SHUFFLE_SOURCES.filter(source => value.includes(source));
}

// --- Playlist entries -------------------------------------------------------

export interface ThemeFileCandidate {
    label: string;
    path: string;
    variant: ThemeVariant | undefined;
}

export interface SavedPaletteLike {
    name: string;
    seed: number;
    variant?: ThemeVariant;
    style?: PaletteStyle;
}

export interface ShuffleEntryInputs {
    variant: ThemeVariant;
    sessionSeed: number;
    sources: readonly ShuffleSource[];
    builtinThemes?: readonly ThemeFileCandidate[];
    themeFiles?: readonly ThemeFileCandidate[];
    curatedSeeds?: readonly CuratedSeed[];
    userSeeds?: readonly unknown[];
    savedPalettes?: readonly SavedPaletteLike[];
    randomCount?: number;
}

export interface ContributedTheme {
    label?: string;
    uiTheme?: string;
    path?: string;
}

/**
 * The extension's own static themes (from package.json `contributes.themes`),
 * excluding the generated Dynamic/Auto/Shuffle themes.
 */
export function builtinThemeCandidates(contributed: readonly ContributedTheme[], extensionPath: string): ThemeFileCandidate[] {
    return contributed
        .filter(theme => theme.label && theme.path && !isDynamicTheme(theme.label) && !isShuffleTheme(theme.label))
        .map(theme => ({
            label: theme.label as string,
            path: path.join(extensionPath, theme.path as string),
            variant: theme.uiTheme === 'vs' || theme.uiTheme === 'hc-light' ? 'light' : 'dark'
        }));
}

function seedEntry(seed: number, style: SeedStyle, label: string, origin: SeedEntry['origin']): SeedEntry {
    return { kind: 'seed', id: `seed:${formatSeed(seed)}:${style}`, label, seed: seed >>> 0, style, origin };
}

function themeFileEntry(candidate: ThemeFileCandidate, origin: ThemeFileEntry['origin']): ThemeFileEntry {
    return { kind: 'themeFile', id: `file:${candidate.path}`, label: candidate.label, path: candidate.path, origin };
}

/**
 * Collects every playlist entry that matches the variant, in source order,
 * without duplicates. Random entries are pre-generated from the session seed,
 * so a session is fully reproducible from that one number.
 */
export function buildShuffleEntries(inputs: ShuffleEntryInputs): ShuffleEntry[] {
    const { variant, sources } = inputs;
    const entries: ShuffleEntry[] = [];
    const seen = new Set<string>();
    const add = (entry: ShuffleEntry) => {
        if (!seen.has(entry.id)) {
            seen.add(entry.id);
            entries.push(entry);
        }
    };
    const matches = (candidateVariant: ThemeVariant | undefined) => (candidateVariant ?? 'dark') === variant;

    for (const source of SHUFFLE_SOURCES) {
        if (!sources.includes(source)) {
            continue;
        }
        switch (source) {
            case 'builtinThemes':
                (inputs.builtinThemes ?? []).filter(t => matches(t.variant)).forEach(t => add(themeFileEntry(t, 'builtin')));
                break;
            case 'themeFiles':
                (inputs.themeFiles ?? []).filter(t => matches(t.variant)).forEach(t => add(themeFileEntry(t, 'user')));
                break;
            case 'builtinSeeds':
                (inputs.curatedSeeds ?? CURATED_SEEDS)
                    .filter(c => c.variant === variant)
                    .forEach(c => add(seedEntry(c.seed, c.style, c.name, 'builtin')));
                break;
            case 'seeds':
                for (const value of inputs.userSeeds ?? []) {
                    const spec = parseSeedSpec(value);
                    if (spec) {
                        add(seedEntry(spec.seed, spec.style, `Seed ${formatSeed(spec.seed)}`, 'user'));
                    }
                }
                break;
            case 'savedPalettes':
                for (const saved of inputs.savedPalettes ?? []) {
                    const seed = parseSeed(saved?.seed);
                    if (seed !== undefined && (!saved.variant || saved.variant === variant)) {
                        add(seedEntry(seed, toSeedStyle(saved.style), saved.name || `Saved ${formatSeed(seed)}`, 'saved'));
                    }
                }
                break;
            case 'random':
                addRandomEntries(inputs, inputs.randomCount ?? 0, add);
                break;
        }
    }

    if (entries.length === 0) {
        // Never leave the theme without something to show.
        addRandomEntries(inputs, 1, add);
    }
    return entries;
}

function addRandomEntries(inputs: ShuffleEntryInputs, count: number, add: (entry: ShuffleEntry) => void): void {
    const rng = mulberry32(deriveSeed(inputs.sessionSeed, inputs.variant, 'random'));
    const total = Math.max(0, Math.min(Math.floor(count), 50));
    for (let i = 0; i < total; i++) {
        const seed = randomSeed(rng);
        const style = SEED_STYLES[Math.floor(rng() * SEED_STYLES.length)];
        add(seedEntry(seed, style, `Random ${formatSeed(seed)}`, 'random'));
    }
}

export function describeEntry(entry: ShuffleEntry): string {
    if (entry.kind === 'themeFile') {
        return entry.origin === 'builtin' ? 'built-in theme' : `theme file · ${entry.path}`;
    }
    const detail = `seed ${formatSeed(entry.seed)} · ${entry.style}`;
    switch (entry.origin) {
        case 'builtin': return `curated ${detail}`;
        case 'saved': return `saved palette · ${detail}`;
        case 'random': return `random this session · ${detail}`;
        default: return detail;
    }
}

// --- Cross-window session ---------------------------------------------------

// Every VS Code window runs its own extension host, but they all share one
// Shuffle theme file. Windows coordinate through this state (persisted in
// global storage) so they play one session instead of fighting over the file.
export interface SharedShuffleState {
    sessionSeed: number;
    /** When the session (or its configured seed's sequence) was last started. */
    startedAt: number;
    /** Last time any window touched the session (switch or periodic heartbeat). */
    heartbeat: number;
    /**
     * Entry each variant shows and when it was switched to. The full entry is
     * kept because windows can have different playlists (e.g. workspace-
     * relative theme files), so the id alone may not resolve everywhere.
     */
    entries: Partial<Record<ThemeVariant, { id: string; at: number; entry?: ShuffleEntry }>>;
}

export const SESSION_HEARTBEAT_MS = 60_000;
export const SESSION_TIMEOUT_MS = 150_000;

export function parseShuffleEntry(raw: unknown): ShuffleEntry | undefined {
    if (typeof raw !== 'object' || raw === null) {
        return undefined;
    }
    const value = raw as Record<string, unknown>;
    if (typeof value.id !== 'string' || typeof value.label !== 'string') {
        return undefined;
    }
    if (value.kind === 'themeFile' && typeof value.path === 'string' && (value.origin === 'builtin' || value.origin === 'user')) {
        return { kind: 'themeFile', id: value.id, label: value.label, path: value.path, origin: value.origin };
    }
    const seed = parseSeed(value.seed);
    const origins: readonly SeedEntry['origin'][] = ['builtin', 'user', 'saved', 'random'];
    if (value.kind === 'seed' && seed !== undefined && SEED_STYLES.includes(value.style as SeedStyle) &&
        origins.includes(value.origin as SeedEntry['origin'])) {
        return {
            kind: 'seed',
            id: value.id,
            label: value.label,
            seed,
            style: value.style as SeedStyle,
            origin: value.origin as SeedEntry['origin']
        };
    }
    return undefined;
}

export function parseSharedState(raw: unknown): SharedShuffleState | undefined {
    if (typeof raw !== 'object' || raw === null) {
        return undefined;
    }
    const value = raw as Record<string, unknown>;
    const sessionSeed = parseSeed(value.sessionSeed);
    if (sessionSeed === undefined || typeof value.heartbeat !== 'number') {
        return undefined;
    }
    const entries: SharedShuffleState['entries'] = {};
    const rawEntries = typeof value.entries === 'object' && value.entries !== null
        ? value.entries as Record<string, unknown>
        : {};
    for (const variant of ['dark', 'light'] as const) {
        const item = rawEntries[variant] as { id?: unknown; at?: unknown; entry?: unknown } | undefined;
        if (item && typeof item.id === 'string' && typeof item.at === 'number') {
            const entry = parseShuffleEntry(item.entry);
            entries[variant] = entry && entry.id === item.id
                ? { id: item.id, at: item.at, entry }
                : { id: item.id, at: item.at };
        }
    }
    const startedAt = typeof value.startedAt === 'number' ? value.startedAt : 0;
    return { sessionSeed, startedAt, heartbeat: value.heartbeat, entries };
}

/** Whether another window is still running this session (so a new window should join it). */
export function isSessionAlive(state: SharedShuffleState, now: number, timeoutMs = SESSION_TIMEOUT_MS): boolean {
    return now - state.heartbeat < timeoutMs;
}

/**
 * Whether some window already switched this variant during the current
 * interval; each window's timer then skips its tick so the theme switches
 * once per interval no matter how many windows are open.
 */
export function switchedRecently(state: SharedShuffleState, variant: ThemeVariant, now: number, intervalMs: number): boolean {
    const last = state.entries[variant];
    return last !== undefined && now - last.at < intervalMs * 0.9;
}

// --- Playlist ---------------------------------------------------------------

export type RebuildAction = 'keep' | 'follow' | 'repick';

/**
 * What a window does with the session's current entry after its sources
 * changed: keep it if it is still listed, keep following it if it came from
 * another window's playlist (this window never listed it), and re-pick only
 * if this window's own sources dropped it.
 */
export function decideRebuild(current: {
    id: string | undefined;
    listedNow: boolean;
    listedBefore: boolean;
    adoptable: boolean;
}): RebuildAction {
    if (!current.id) {
        return 'repick';
    }
    if (current.listedNow) {
        return 'keep';
    }
    return !current.listedBefore && current.adoptable ? 'follow' : 'repick';
}

export function shuffleItems<T>(items: readonly T[], rng: () => number): T[] {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

/**
 * A seeded, endlessly repeating shuffle: every entry plays once per round,
 * each round is reshuffled, and a round never starts with the entry that
 * ended the previous one.
 */
export class ShufflePlaylist {
    private order: ShuffleEntry[];
    private index = 0;
    private readonly rng: () => number;
    private readonly adopted = new Set<string>();

    constructor(entries: readonly ShuffleEntry[], seed: number) {
        this.rng = mulberry32(seed >>> 0);
        this.order = shuffleItems(entries, this.rng);
    }

    get entries(): readonly ShuffleEntry[] {
        return this.order;
    }

    get current(): ShuffleEntry | undefined {
        return this.order[this.index];
    }

    next(): ShuffleEntry | undefined {
        if (this.order.length === 0) {
            return undefined;
        }
        if (this.index + 1 < this.order.length) {
            this.index++;
            return this.current;
        }
        const last = this.current;
        this.order = shuffleItems(this.order, this.rng);
        if (this.order.length > 1 && this.order[0].id === last?.id) {
            const swapWith = 1 + Math.floor(this.rng() * (this.order.length - 1));
            [this.order[0], this.order[swapWith]] = [this.order[swapWith], this.order[0]];
        }
        this.index = 0;
        return this.current;
    }

    select(id: string): ShuffleEntry | undefined {
        const position = this.order.findIndex(entry => entry.id === id);
        if (position < 0) {
            return undefined;
        }
        this.index = position;
        return this.current;
    }

    /**
     * Makes `entry` current, inserting it after the current position when this
     * playlist does not contain it (an entry another window switched to).
     */
    adopt(entry: ShuffleEntry): ShuffleEntry {
        if (this.select(entry.id)) {
            return entry;
        }
        this.index = Math.min(this.index + 1, this.order.length);
        this.order.splice(this.index, 0, entry);
        this.adopted.add(entry.id);
        return entry;
    }

    /** Whether the entry belongs to this playlist's own sources (adopted entries don't). */
    contains(id: string): boolean {
        return !this.adopted.has(id) && this.order.some(entry => entry.id === id);
    }

    /**
     * Drops an entry (e.g. a theme file that no longer loads). If it was the
     * current entry, the next call to `next()` yields the entry that followed it.
     */
    remove(id: string): void {
        const position = this.order.findIndex(entry => entry.id === id);
        if (position < 0) {
            return;
        }
        this.order.splice(position, 1);
        this.adopted.delete(id);
        if (position <= this.index) {
            this.index--;
        }
    }
}
