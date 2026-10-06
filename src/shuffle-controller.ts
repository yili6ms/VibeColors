import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { makePalette, mulberry32 } from './color-utils';
import {
    ContributedTheme,
    SESSION_HEARTBEAT_MS,
    SavedPaletteLike,
    SharedShuffleState,
    ShuffleEntry,
    ShufflePlaylist,
    ThemeFileCandidate,
    builtinThemeCandidates,
    buildShuffleEntries,
    decideRebuild,
    deriveSeed,
    describeEntry,
    formatSeed,
    isSessionAlive,
    normalizeSources,
    parseSeed,
    parseSharedState,
    randomSeed,
    switchedRecently
} from './shuffle';
import { generateThemeConfig } from './theme-config';
import { inferThemeVariant, listThemeFiles, loadColorThemeFile, resolveThemePath } from './theme-file';
import {
    ThemeVariant,
    getShuffleThemeFileName,
    getShuffleThemeName,
    getThemeVariantFromName,
    isShuffleTheme
} from './theme-naming';

const MIN_INTERVAL_MS = 5_000;
const LOCK_STALE_MS = 10_000;
const VARIANTS: readonly ThemeVariant[] = ['dark', 'light'];

const PLAYLIST_SETTINGS = [
    'vibeColors.shuffle.sources',
    'vibeColors.shuffle.seeds',
    'vibeColors.shuffle.themeFiles',
    'vibeColors.shuffle.randomCount',
    'vibeColors.savedPalettes'
];

type EntryPickItem = vscode.QuickPickItem & { entry: ShuffleEntry };

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function configuredThemeName(): string {
    return vscode.workspace.getConfiguration().get<string>('workbench.colorTheme', '');
}

function activeShuffleVariant(): ThemeVariant | undefined {
    const theme = configuredThemeName();
    return isShuffleTheme(theme) ? getThemeVariantFromName(theme) : undefined;
}

function shuffleSettings(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration('vibeColors');
}

/**
 * Drives the "VibeColors Shuffle" themes: a per-session shuffled playlist of
 * pre-set theme files and pre-generated seeds that is written into the
 * Shuffle theme file on a timer or on demand.
 *
 * Runtime switching relies on the theme contributions declaring `_watch`,
 * which makes VS Code reload the active theme when its file changes. VS Code
 * also caches theme files it has loaded, so whenever a Shuffle theme becomes
 * active the file is rewritten once VS Code has started watching it.
 *
 * All windows share one theme file, so they also share one session (seed and
 * current entries) through a small state file in global storage. Switches
 * record the shared state before rewriting the theme file, timer switches run
 * under a cross-window lock, and every window follows the recorded entry when
 * the shared file reloads.
 */
export class ShuffleController implements vscode.Disposable {
    private sessionSeed: number;
    private shared: SharedShuffleState | undefined;
    private readonly playlists = new Map<ThemeVariant, ShufflePlaylist>();
    private readonly writtenEntry = new Map<ThemeVariant, string>();
    private queue: Promise<unknown> = Promise.resolve();
    private rotationTimer: NodeJS.Timeout | undefined;
    private readonly heartbeatTimer: NodeJS.Timeout;
    private pickerOpen = false;
    private lastThemeName: string;
    private syncedThemeName: string | undefined;
    private readonly statusBar: vscode.StatusBarItem;
    private readonly log: vscode.LogOutputChannel;
    private readonly disposables: vscode.Disposable[] = [];

    constructor(private readonly context: vscode.ExtensionContext) {
        this.sessionSeed = this.configuredSessionSeed() ?? randomSeed();
        this.lastThemeName = configuredThemeName();

        this.statusBar = vscode.window.createStatusBarItem('vibeColors.shuffle', vscode.StatusBarAlignment.Right, 100);
        this.statusBar.name = 'VibeColors Shuffle';
        this.statusBar.command = 'vibeColors.shufflePick';
        this.log = vscode.window.createOutputChannel('VibeColors Shuffle', { log: true });
        this.heartbeatTimer = setInterval(() => void this.runInBackground(() => this.heartbeat()), SESSION_HEARTBEAT_MS);

        this.disposables.push(
            this.statusBar,
            this.log,
            vscode.commands.registerCommand('vibeColors.shuffleNext', () => this.runCommand(() => this.next())),
            vscode.commands.registerCommand('vibeColors.shufflePick', () => this.runCommand(() => this.pick())),
            vscode.commands.registerCommand('vibeColors.shuffleReseed', () => this.runCommand(() => this.reseed())),
            vscode.workspace.onDidChangeConfiguration(event => this.onConfigurationChanged(event)),
            vscode.window.onDidChangeActiveColorTheme(() => this.onActiveColorThemeChanged())
        );
    }

    /**
     * Joins the session other windows are already running, or starts a new
     * one with a fresh random seed (so every VS Code start shuffles anew).
     */
    async start(): Promise<void> {
        await this.runInBackground(async () => {
            const joined = await this.joinOrCreateSession();
            const variant = activeShuffleVariant();
            if (variant) {
                // A joining window keeps what the shared theme file already shows.
                await this.showSharedCurrent(variant, !joined);
            }
        });
        this.refreshScheduleAndStatus();
    }

    async switchVariant(): Promise<void> {
        const variant = activeShuffleVariant() ?? getThemeVariantFromName(configuredThemeName());
        await this.runCommand(() => this.activate(variant === 'dark' ? 'light' : 'dark'));
    }

    /** The entry shown by the active Shuffle theme, if a Shuffle theme is active. */
    getCurrentEntry(): { entry: ShuffleEntry; variant: ThemeVariant } | undefined {
        const variant = activeShuffleVariant();
        const entry = variant ? this.playlists.get(variant)?.current : undefined;
        return variant && entry ? { entry, variant } : undefined;
    }

    dispose(): void {
        this.clearRotationTimer();
        clearInterval(this.heartbeatTimer);
        this.disposables.forEach(disposable => disposable.dispose());
    }

    // --- Commands -----------------------------------------------------------

    private async next(): Promise<void> {
        const variant = activeShuffleVariant();
        if (!variant) {
            await this.activate(getThemeVariantFromName(configuredThemeName()));
            return;
        }
        const entry = await this.enqueue(async () => {
            await this.syncShared();
            return this.advance(variant);
        });
        this.refreshScheduleAndStatus();
        if (entry) {
            vscode.window.setStatusBarMessage(`VibeColors Shuffle: ${entry.label}`, 4000);
        }
    }

    private async pick(): Promise<void> {
        const activeVariant = activeShuffleVariant();
        const variant = activeVariant ?? getThemeVariantFromName(configuredThemeName());
        const playlist = await this.enqueue(async () => {
            await this.syncShared();
            return this.getPlaylist(variant);
        });
        const current = playlist.current;

        const items: EntryPickItem[] = playlist.entries.map(entry => ({
            label: entry.label,
            description: describeEntry(entry),
            iconPath: new vscode.ThemeIcon(entry.id === current?.id ? 'check' : 'blank'),
            entry
        }));

        const quickPick = vscode.window.createQuickPick<EntryPickItem>();
        quickPick.title = `${getShuffleThemeName(variant)} · ${items.length} themes · session seed ${formatSeed(this.sessionSeed)}`;
        quickPick.placeholder = activeVariant
            ? 'Pick the theme to switch to (use the arrow keys to preview)'
            : `Pick a theme to start ${getShuffleThemeName(variant)} with`;
        quickPick.matchOnDescription = true;
        quickPick.items = items;
        quickPick.activeItems = items.filter(item => item.entry.id === current?.id);

        if (activeVariant) {
            quickPick.onDidChangeActive(([item]) => {
                if (item) {
                    void this.runInBackground(() => this.writeEntry(variant, item.entry));
                }
            });
        }

        // Rotating while the user is browsing would fight with the preview.
        this.pickerOpen = true;
        this.clearRotationTimer();
        let picked: EntryPickItem | undefined;
        try {
            picked = await new Promise<EntryPickItem | undefined>(resolve => {
                quickPick.onDidAccept(() => {
                    resolve(quickPick.activeItems[0]);
                    quickPick.hide();
                });
                quickPick.onDidHide(() => resolve(undefined));
                quickPick.show();
            });
        } finally {
            quickPick.dispose();
            this.pickerOpen = false;
        }

        try {
            if (!picked) {
                if (activeVariant) {
                    // Restore whatever the session is on now, not what it was on when the picker opened.
                    await this.enqueue(async () => {
                        await this.syncShared();
                        await this.showCurrent(variant);
                    });
                }
                return;
            }
            const chosen = picked.entry;
            await this.enqueue(async () => {
                (await this.getPlaylist(variant)).select(chosen.id);
                await this.showCurrent(variant);
            });
            if (!activeVariant) {
                await this.selectTheme(variant);
            }
        } finally {
            this.refreshScheduleAndStatus();
        }
    }

    private async reseed(): Promise<void> {
        await this.enqueue(() => this.startNewSession(randomSeed()));
        this.refreshScheduleAndStatus();
        vscode.window.showInformationMessage(
            `VibeColors Shuffle: new session seed ${formatSeed(this.sessionSeed)}. ` +
            `Set "vibeColors.shuffle.sessionSeed" to "${formatSeed(this.sessionSeed)}" to replay this order on every start.`
        );
    }

    /** Switches VS Code to the Shuffle theme of a variant, starting at its current entry. */
    private async activate(variant: ThemeVariant): Promise<void> {
        // Pre-writing means a theme VS Code has not loaded yet opens on the right entry.
        await this.enqueue(() => this.showSharedCurrent(variant, true));
        await this.selectTheme(variant);
    }

    private async selectTheme(variant: ThemeVariant): Promise<void> {
        await vscode.workspace.getConfiguration().update(
            'workbench.colorTheme',
            getShuffleThemeName(variant),
            vscode.ConfigurationTarget.Global
        );
    }

    // --- Events -------------------------------------------------------------

    private onConfigurationChanged(event: vscode.ConfigurationChangeEvent): void {
        if (event.affectsConfiguration('workbench.colorTheme')) {
            const themeName = configuredThemeName();
            const switched = themeName !== this.lastThemeName;
            this.lastThemeName = themeName;
            if (!isShuffleTheme(themeName)) {
                this.syncedThemeName = undefined;
            } else if (switched) {
                // VS Code may already have applied (and started watching) the
                // theme before this event arrived; rewrite so it picks up the
                // current entry rather than a cached copy.
                const variant = getThemeVariantFromName(themeName);
                void this.runInBackground(() => this.showSharedCurrent(variant, true));
            }
            this.refreshScheduleAndStatus();
        }

        if (event.affectsConfiguration('vibeColors.shuffle.sessionSeed')) {
            // A fixed seed restarts its sequence; switching back to 0 (random)
            // takes effect on the next start.
            const configured = this.configuredSessionSeed();
            if (configured !== undefined) {
                const changedAt = Date.now();
                void this.runInBackground(() => this.applyConfiguredSeed(configured, changedAt)).then(() => this.refreshScheduleAndStatus());
            }
        } else if (PLAYLIST_SETTINGS.some(key => event.affectsConfiguration(key))) {
            void this.runInBackground(() => this.rebuildPlaylists()).then(() => this.refreshScheduleAndStatus());
        }

        if (event.affectsConfiguration('vibeColors.shuffle.intervalMinutes')) {
            this.refreshScheduleAndStatus();
        }
    }

    /**
     * Fires after VS Code has applied a theme and attached its file watcher,
     * so a write made here is guaranteed to be picked up. It also fires when
     * any window rewrites the shared theme file, which is how the other
     * windows learn about a switch.
     */
    private onActiveColorThemeChanged(): void {
        const themeName = configuredThemeName();
        if (!isShuffleTheme(themeName)) {
            this.syncedThemeName = undefined;
            return;
        }
        const variant = getThemeVariantFromName(themeName);
        if (this.syncedThemeName !== themeName) {
            this.syncedThemeName = themeName;
            void this.runInBackground(() => this.showSharedCurrent(variant, true));
            return;
        }
        if (!this.pickerOpen) {
            // Usually a reload after some window (possibly this one) rewrote the shared file.
            void this.runInBackground(() => this.syncShared());
        }
    }

    private async onTimer(): Promise<void> {
        // De-phase windows whose timers started together (e.g. on a theme change).
        await sleep(Math.random() * Math.min(3_000, this.intervalMs() * 0.1));
        const variant = activeShuffleVariant();
        if (!variant || this.pickerOpen) {
            this.refreshScheduleAndStatus();
            return;
        }
        await this.runInBackground(async () => {
            // Only one window may decide and perform a timed switch at a time.
            const release = await this.tryLock();
            if (!release) {
                return; // another window is switching right now
            }
            try {
                const state = await this.syncShared();
                if (state && switchedRecently(state, variant, Date.now(), this.intervalMs())) {
                    return; // another window already switched during this interval
                }
                await this.advance(variant);
            } finally {
                await release();
            }
        });
        this.updateStatusBar(variant);
    }

    private async heartbeat(): Promise<void> {
        const state = await this.syncShared();
        if (!state) {
            await this.updateShared(() => undefined);
            return;
        }
        // Liveness lives in its own file so that heartbeats never race with
        // (and overwrite) another window's switch recorded in the state file.
        await fs.promises.writeFile(this.heartbeatPath(), String(Date.now()));
    }

    // --- Shared session -----------------------------------------------------

    private statePath(): string {
        return path.join(this.context.globalStorageUri.fsPath, 'shuffle-state.json');
    }

    private heartbeatPath(): string {
        return path.join(this.context.globalStorageUri.fsPath, 'shuffle-heartbeat');
    }

    private async readShared(): Promise<SharedShuffleState | undefined> {
        try {
            const [text, beat] = await Promise.all([
                fs.promises.readFile(this.statePath(), 'utf8'),
                fs.promises.stat(this.heartbeatPath()).then(stat => stat.mtimeMs, () => 0)
            ]);
            const state = parseSharedState(JSON.parse(text));
            if (state) {
                state.heartbeat = Math.max(state.heartbeat, beat);
            }
            return state;
        } catch {
            return undefined;
        }
    }

    /** Read-modify-write of the shared state under this window's session seed. */
    private async updateShared(mutate: (state: SharedShuffleState) => void): Promise<void> {
        const existing = await this.readShared();
        const state: SharedShuffleState = existing && existing.sessionSeed === this.sessionSeed
            ? existing
            : { sessionSeed: this.sessionSeed, startedAt: Date.now(), heartbeat: 0, entries: {} };
        mutate(state);
        state.heartbeat = Date.now();

        const target = this.statePath();
        const temp = `${target}.${process.pid}.tmp`;
        await fs.promises.mkdir(path.dirname(target), { recursive: true });
        await fs.promises.writeFile(temp, JSON.stringify(state));
        try {
            await fs.promises.rename(temp, target);
        } catch {
            // Windows refuses to replace a file another process is reading.
            await fs.promises.writeFile(target, JSON.stringify(state));
            await fs.promises.rm(temp, { force: true });
        }
        this.shared = state;
    }

    /**
     * Follows the session the other windows are on (its seed and current
     * entries). Returns the shared state when this window is part of it.
     */
    private async syncShared(): Promise<SharedShuffleState | undefined> {
        const state = await this.readShared();
        if (!state || (state.sessionSeed !== this.sessionSeed && !isSessionAlive(state, Date.now()))) {
            return undefined;
        }
        this.shared = state;
        if (state.sessionSeed !== this.sessionSeed) {
            this.log.info(`Following session seed ${formatSeed(state.sessionSeed)} from another window`);
            this.sessionSeed = state.sessionSeed;
            this.playlists.clear();
        }
        for (const variant of VARIANTS) {
            const shared = state.entries[variant];
            if (shared) {
                this.followSharedEntry(this.playlists.get(variant), shared);
                if (!this.pickerOpen) {
                    this.writtenEntry.set(variant, shared.id);
                }
            }
        }
        const active = activeShuffleVariant();
        if (active) {
            await this.getPlaylist(active);
            this.updateStatusBar(active);
        }
        return state;
    }

    private followSharedEntry(
        playlist: ShufflePlaylist | undefined,
        shared: SharedShuffleState['entries'][ThemeVariant]
    ): void {
        if (!playlist || !shared || playlist.current?.id === shared.id) {
            return;
        }
        if (!playlist.select(shared.id) && shared.entry) {
            playlist.adopt(shared.entry);
        }
    }

    /** Joins a live session or, under a cross-window lock, creates a new one. */
    private async joinOrCreateSession(): Promise<boolean> {
        const configured = this.configuredSessionSeed();
        // Any live session is joined, even one reshuffled away from a configured
        // seed; the configured seed only applies when a session is created.
        const joinable = (state: SharedShuffleState | undefined): state is SharedShuffleState =>
            !!state && isSessionAlive(state, Date.now());

        for (let attempt = 0; attempt < 30; attempt++) {
            if (joinable(await this.readShared())) {
                break;
            }
            const release = await this.tryLock();
            if (!release) {
                await sleep(100);
                continue;
            }
            try {
                // Windows restored together race here; only one creates the session.
                if (!joinable(await this.readShared())) {
                    await this.startNewSession(configured ?? randomSeed(), false);
                    return false;
                }
            } finally {
                await release();
            }
            break;
        }

        const state = await this.readShared();
        if (joinable(state)) {
            this.sessionSeed = state.sessionSeed;
            await this.syncShared();
            this.log.info(`Joined running session ${formatSeed(this.sessionSeed)}`);
            return true;
        }
        await this.startNewSession(configured ?? randomSeed(), false);
        return false;
    }

    private async tryLock(): Promise<(() => Promise<void>) | undefined> {
        const lockPath = `${this.statePath()}.lock`;
        await fs.promises.mkdir(path.dirname(lockPath), { recursive: true });
        try {
            await (await fs.promises.open(lockPath, 'wx')).close();
            return () => fs.promises.rm(lockPath, { force: true });
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
                throw error;
            }
            const stat = await fs.promises.stat(lockPath).catch(() => undefined);
            if (stat && Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
                await fs.promises.rm(lockPath, { force: true });
            }
            return undefined;
        }
    }

    private async startNewSession(seed: number, show = true): Promise<void> {
        this.sessionSeed = seed;
        this.playlists.clear();
        await this.updateShared(state => {
            state.entries = {};
            state.startedAt = Date.now();
        });
        this.log.info(`New session seed ${formatSeed(seed)}`);
        const variant = activeShuffleVariant();
        if (show && variant) {
            await this.showCurrent(variant);
        }
    }

    /**
     * Restarts the sequence of a newly configured seed. Every window receives
     * the settings change, so only the first one restarts and the rest follow.
     */
    private applyConfiguredSeed(seed: number, changedAt: number): Promise<void> {
        return this.withLock(async () => {
            const state = await this.readShared();
            if (state && state.sessionSeed === seed && state.startedAt >= changedAt - 1000) {
                const variant = activeShuffleVariant();
                await (variant ? this.showSharedCurrentUnlocked(variant, false) : this.syncShared());
                return;
            }
            await this.startNewSession(seed);
        });
    }

    /** Shows the session's current entry; serialized across windows so they agree on it. */
    private showSharedCurrent(variant: ThemeVariant, force: boolean): Promise<void> {
        return this.withLock(() => this.showSharedCurrentUnlocked(variant, force));
    }

    private async showSharedCurrentUnlocked(variant: ThemeVariant, force: boolean): Promise<void> {
        const state = await this.syncShared();
        if (!force && state?.entries[variant]) {
            await this.getPlaylist(variant);
            return;
        }
        await this.showCurrent(variant);
    }

    private async withLock<T>(task: () => Promise<T>): Promise<T> {
        let release: (() => Promise<void>) | undefined;
        for (let attempt = 0; attempt < 50 && !release; attempt++) {
            release = await this.tryLock();
            if (!release) {
                await sleep(100);
            }
        }
        if (!release) {
            this.log.warn('Proceeding without the cross-window lock');
        }
        try {
            return await task();
        } finally {
            await release?.();
        }
    }

    // --- Playlist -----------------------------------------------------------

    private configuredSessionSeed(): number | undefined {
        const seed = parseSeed(shuffleSettings().get<unknown>('shuffle.sessionSeed', 0));
        return seed ? seed : undefined;
    }

    private intervalMs(): number {
        const minutes = shuffleSettings().get<number>('shuffle.intervalMinutes', 10);
        return typeof minutes === 'number' && minutes > 0 ? Math.max(minutes * 60_000, MIN_INTERVAL_MS) : 0;
    }

    private async getPlaylist(variant: ThemeVariant): Promise<ShufflePlaylist> {
        let playlist = this.playlists.get(variant);
        if (!playlist) {
            const entries = await this.collectEntries(variant);
            playlist = new ShufflePlaylist(entries, deriveSeed(this.sessionSeed, variant, 'order'));
            this.playlists.set(variant, playlist);
            this.log.info(`${getShuffleThemeName(variant)} playlist: ${playlist.entries.map(e => e.label).join(', ')}`);
            if (this.shared?.sessionSeed === this.sessionSeed) {
                this.followSharedEntry(playlist, this.shared.entries[variant]);
            }
        }
        return playlist;
    }

    private async collectEntries(variant: ThemeVariant): Promise<ShuffleEntry[]> {
        const settings = shuffleSettings();
        const sources = normalizeSources(settings.get<unknown>('shuffle.sources'));
        const contributed: ContributedTheme[] = this.context.extension.packageJSON?.contributes?.themes ?? [];

        return buildShuffleEntries({
            variant,
            sessionSeed: this.sessionSeed,
            sources,
            builtinThemes: builtinThemeCandidates(contributed, this.context.extensionPath),
            themeFiles: sources.includes('themeFiles') ? await this.userThemeFiles() : [],
            userSeeds: settings.get<unknown[]>('shuffle.seeds', []),
            savedPalettes: settings.get<SavedPaletteLike[]>('savedPalettes', []),
            randomCount: settings.get<number>('shuffle.randomCount', 4)
        });
    }

    private async userThemeFiles(): Promise<ThemeFileCandidate[]> {
        const configured = shuffleSettings().get<unknown[]>('shuffle.themeFiles', []);
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        const candidates: ThemeFileCandidate[] = [];

        for (const value of Array.isArray(configured) ? configured : []) {
            if (typeof value !== 'string' || !value.trim()) {
                continue;
            }
            const resolved = resolveThemePath(value, os.homedir(), workspaceFolder);
            if (!resolved) {
                this.log.warn(`Cannot resolve theme path "${value}" without an open workspace folder`);
                continue;
            }
            let files: string[];
            try {
                files = await listThemeFiles(resolved);
            } catch (error) {
                this.log.warn(`Skipping theme path ${resolved}: ${errorMessage(error)}`);
                continue;
            }
            for (const file of files) {
                try {
                    const doc = await loadColorThemeFile(file);
                    const label = typeof doc.name === 'string' && doc.name.trim()
                        ? doc.name.trim()
                        : path.basename(file, path.extname(file));
                    candidates.push({ label, path: file, variant: inferThemeVariant(doc) });
                } catch (error) {
                    this.log.warn(`Skipping theme file ${file}: ${errorMessage(error)}`);
                }
            }
        }
        return candidates;
    }

    /**
     * Rebuilds after the sources changed, staying on the session's current
     * entry if it is still listed. Every window receives the change; the lock
     * makes them decide one after another, so later windows keep the entry an
     * earlier window re-picked.
     */
    private async rebuildPlaylists(): Promise<void> {
        const previousPlaylists = new Map(this.playlists);
        this.playlists.clear();

        const variant = activeShuffleVariant();
        if (!variant) {
            return;
        }
        await this.withLock(async () => {
            const state = await this.syncShared();
            const playlist = await this.getPlaylist(variant);
            const previous = previousPlaylists.get(variant);
            const shared = state?.entries[variant];
            const currentId = shared?.id ?? previous?.current?.id;
            const action = decideRebuild({
                id: currentId,
                listedNow: !!currentId && playlist.contains(currentId),
                listedBefore: !!currentId && !!previous?.contains(currentId),
                adoptable: !!shared?.entry
            });
            if (action === 'keep' && currentId) {
                playlist.select(currentId);
                return;
            }
            if (action === 'follow' && shared?.entry) {
                playlist.adopt(shared.entry);
                return;
            }
            if (playlist.current && !playlist.contains(playlist.current.id)) {
                playlist.remove(playlist.current.id);
            }
            await this.showCurrent(variant);
        });
    }

    private showCurrent(variant: ThemeVariant): Promise<ShuffleEntry | undefined> {
        return this.show(variant, playlist => playlist.current ?? playlist.next());
    }

    private advance(variant: ThemeVariant): Promise<ShuffleEntry | undefined> {
        return this.show(variant, playlist => playlist.next());
    }

    /** Writes the chosen entry, dropping entries whose theme file no longer loads. */
    private async show(
        variant: ThemeVariant,
        choose: (playlist: ShufflePlaylist) => ShuffleEntry | undefined
    ): Promise<ShuffleEntry | undefined> {
        const playlist = await this.getPlaylist(variant);
        let entry = choose(playlist);
        while (entry) {
            let document: object;
            try {
                document = await this.renderEntry(variant, entry);
            } catch (error) {
                this.log.warn(`Removing "${entry.label}" from the playlist: ${errorMessage(error)}`);
                playlist.remove(entry.id);
                entry = playlist.next();
                continue;
            }
            await this.writeDocument(variant, entry, document, true);
            this.updateStatusBar(variant);
            return entry;
        }
        return undefined;
    }

    /** Preview write: skipped when the file already shows the entry, and not recorded as a switch. */
    private async writeEntry(variant: ThemeVariant, entry: ShuffleEntry): Promise<void> {
        if (this.writtenEntry.get(variant) === entry.id) {
            return;
        }
        await this.writeDocument(variant, entry, await this.renderEntry(variant, entry), false);
    }

    private async renderEntry(variant: ThemeVariant, entry: ShuffleEntry): Promise<object> {
        const themeName = getShuffleThemeName(variant);
        if (entry.kind === 'seed') {
            const palette = makePalette(mulberry32(entry.seed), variant, entry.style);
            return generateThemeConfig(palette, themeName, variant === 'dark');
        }
        const document = await loadColorThemeFile(entry.path);
        return { ...document, name: themeName, type: variant };
    }

    private async writeDocument(variant: ThemeVariant, entry: ShuffleEntry, document: object, record: boolean): Promise<void> {
        if (record) {
            // Record first: other windows read the state when the file reloads.
            await this.updateShared(state => {
                // Re-showing the same entry must not restart the rotation clock.
                const at = state.entries[variant]?.id === entry.id ? state.entries[variant]!.at : Date.now();
                state.entries[variant] = { id: entry.id, at, entry };
            });
        }
        const themePath = path.join(this.context.extensionPath, 'themes', getShuffleThemeFileName(variant));
        await fs.promises.mkdir(path.dirname(themePath), { recursive: true });
        await fs.promises.writeFile(themePath, JSON.stringify(document, null, '\t'));
        this.writtenEntry.set(variant, entry.id);
        if (record) {
            this.log.info(`${getShuffleThemeName(variant)} → ${entry.label} (${describeEntry(entry)})`);
        }
    }

    // --- Scheduling & status ------------------------------------------------

    private clearRotationTimer(): void {
        if (this.rotationTimer) {
            clearInterval(this.rotationTimer);
            this.rotationTimer = undefined;
        }
    }

    /** Restarts the rotation timer, so a manual switch gets a full interval. */
    private refreshScheduleAndStatus(): void {
        this.clearRotationTimer();
        const variant = activeShuffleVariant();
        if (!variant) {
            this.statusBar.hide();
            return;
        }
        const intervalMs = this.intervalMs();
        if (intervalMs > 0 && !this.pickerOpen) {
            this.rotationTimer = setInterval(() => void this.onTimer(), intervalMs);
        }
        this.updateStatusBar(variant);
    }

    private updateStatusBar(variant: ThemeVariant): void {
        if (activeShuffleVariant() !== variant) {
            return;
        }
        const entry = this.playlists.get(variant)?.current;
        const minutes = shuffleSettings().get<number>('shuffle.intervalMinutes', 10);
        const cadence = minutes > 0 ? `switches every ${minutes} min` : 'switches only on demand';
        this.statusBar.text = `$(symbol-color) ${entry?.label ?? 'Shuffle'}`;
        this.statusBar.tooltip = [
            `${getShuffleThemeName(variant)}${entry ? `: ${entry.label} (${describeEntry(entry)})` : ''}`,
            `Session seed ${formatSeed(this.sessionSeed)} · ${cadence}`,
            'Click to pick a theme'
        ].join('\n');
        this.statusBar.show();
    }

    // --- Plumbing -----------------------------------------------------------

    /** Serializes playlist and file operations (timer, commands, events). */
    private enqueue<T>(task: () => Promise<T>): Promise<T> {
        const run = this.queue.then(task, task);
        this.queue = run.catch(() => undefined);
        return run;
    }

    private async runInBackground<T>(task: () => Promise<T>): Promise<T | undefined> {
        try {
            return await this.enqueue(task);
        } catch (error) {
            this.log.error(`VibeColors Shuffle failed: ${errorMessage(error)}`);
            return undefined;
        }
    }

    private async runCommand(task: () => Promise<void>): Promise<void> {
        try {
            await task();
        } catch (error) {
            this.log.error(errorMessage(error));
            vscode.window.showErrorMessage(`VibeColors Shuffle failed: ${errorMessage(error)}`);
        }
    }
}
