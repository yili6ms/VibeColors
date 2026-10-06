import * as fs from 'fs';
import * as path from 'path';
import { ThemeVariant } from './theme-naming';

export interface ColorThemeDocument {
    name?: string;
    type?: string;
    include?: string;
    colors?: Record<string, string>;
    tokenColors?: unknown;
    semanticHighlighting?: boolean;
    semanticTokenColors?: Record<string, unknown>;
    [key: string]: unknown;
}

const MAX_INCLUDE_DEPTH = 8;

// --- JSONC ------------------------------------------------------------------

function skipString(text: string, start: number): number {
    let i = start + 1;
    while (i < text.length && text[i] !== '"') {
        i += text[i] === '\\' ? 2 : 1;
    }
    return i + 1;
}

export function stripJsonComments(text: string): string {
    let out = '';
    let i = 0;
    while (i < text.length) {
        const ch = text[i];
        if (ch === '"') {
            const end = skipString(text, i);
            out += text.slice(i, end);
            i = end;
        } else if (ch === '/' && text[i + 1] === '/') {
            while (i < text.length && text[i] !== '\n' && text[i] !== '\r') {
                i++;
            }
        } else if (ch === '/' && text[i + 1] === '*') {
            const end = text.indexOf('*/', i + 2);
            i = end < 0 ? text.length : end + 2;
            out += ' ';
        } else {
            out += ch;
            i++;
        }
    }
    return out;
}

export function removeTrailingCommas(text: string): string {
    let out = '';
    let i = 0;
    while (i < text.length) {
        const ch = text[i];
        if (ch === '"') {
            const end = skipString(text, i);
            out += text.slice(i, end);
            i = end;
            continue;
        }
        if (ch === ',') {
            let j = i + 1;
            while (j < text.length && /\s/.test(text[j])) {
                j++;
            }
            if (text[j] === '}' || text[j] === ']') {
                i++;
                continue;
            }
        }
        out += ch;
        i++;
    }
    return out;
}

/** Parses JSON with comments and trailing commas, as VS Code accepts in theme files. */
export function parseJsonc(text: string): unknown {
    return JSON.parse(removeTrailingCommas(stripJsonComments(text.replace(/^\uFEFF/, ''))));
}

// --- Theme documents --------------------------------------------------------

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Normalizes a parsed theme so that it can be copied to another location:
 * token colors that reference external `.tmTheme` files cannot be resolved
 * relative to the copy, so only inline rules are kept.
 */
function normalizeDocument(raw: unknown, filePath: string): ColorThemeDocument {
    if (!isPlainObject(raw)) {
        throw new Error(`${filePath} does not contain a JSON object`);
    }
    const doc: ColorThemeDocument = { ...raw };
    if (!Array.isArray(doc.tokenColors)) {
        // Legacy JSON-ified tmTheme files keep their rules under `settings`.
        doc.tokenColors = Array.isArray(raw.settings) ? raw.settings : undefined;
    }
    delete doc.settings;
    if (!isPlainObject(doc.colors)) {
        delete doc.colors;
    }
    if (!isPlainObject(doc.semanticTokenColors)) {
        delete doc.semanticTokenColors;
    }
    return doc;
}

/** Merges an included base theme with the including theme the way VS Code does. */
export function mergeThemeDocuments(base: ColorThemeDocument, child: ColorThemeDocument): ColorThemeDocument {
    const merged: ColorThemeDocument = { ...base, ...child };
    delete merged.include;

    if (base.colors || child.colors) {
        merged.colors = { ...(base.colors ?? {}), ...(child.colors ?? {}) };
    }
    const baseTokens = Array.isArray(base.tokenColors) ? base.tokenColors : [];
    const childTokens = Array.isArray(child.tokenColors) ? child.tokenColors : [];
    if (baseTokens.length || childTokens.length) {
        merged.tokenColors = [...baseTokens, ...childTokens];
    }
    if (base.semanticTokenColors || child.semanticTokenColors) {
        merged.semanticTokenColors = { ...(base.semanticTokenColors ?? {}), ...(child.semanticTokenColors ?? {}) };
    }
    if (base.semanticHighlighting !== undefined || child.semanticHighlighting !== undefined) {
        merged.semanticHighlighting = Boolean(base.semanticHighlighting || child.semanticHighlighting);
    }
    return merged;
}

/**
 * Loads a VS Code color theme JSON(C) file and inlines any `include`d JSON
 * themes, so the result is self-contained and can be written elsewhere.
 */
export async function loadColorThemeFile(filePath: string, depth = 0): Promise<ColorThemeDocument> {
    if (depth > MAX_INCLUDE_DEPTH) {
        throw new Error(`Theme include chain is too deep at ${filePath}`);
    }
    const text = await fs.promises.readFile(filePath, 'utf8');
    let doc: ColorThemeDocument;
    try {
        doc = normalizeDocument(parseJsonc(text), filePath);
    } catch (error) {
        throw new Error(`Cannot parse ${filePath}: ${error instanceof Error ? error.message : error}`);
    }

    if (typeof doc.include === 'string' && doc.include.toLowerCase().endsWith('.json')) {
        const base = await loadColorThemeFile(path.resolve(path.dirname(filePath), doc.include), depth + 1);
        return mergeThemeDocuments(base, doc);
    }
    delete doc.include;
    return doc;
}

/**
 * Resolves a user-configured theme path. Supports `~`, `${userHome}` and
 * `${workspaceFolder}`; relative paths are resolved against the workspace
 * folder. Returns undefined when a workspace folder is needed but missing.
 */
export function resolveThemePath(value: string, homeDir: string, workspaceFolder: string | undefined): string | undefined {
    let expanded = value.trim()
        .replace(/^~(?=$|[\\/])/, homeDir)
        .replace(/\$\{userHome\}/g, homeDir);
    if (expanded.includes('${workspaceFolder}')) {
        if (!workspaceFolder) {
            return undefined;
        }
        expanded = expanded.replace(/\$\{workspaceFolder\}/g, workspaceFolder);
    }
    if (path.isAbsolute(expanded)) {
        return path.normalize(expanded);
    }
    return workspaceFolder ? path.resolve(workspaceFolder, expanded) : undefined;
}

/** Expands a configured path to theme files: a directory yields its `*.json` files. */
export async function listThemeFiles(resolvedPath: string): Promise<string[]> {
    const stat = await fs.promises.stat(resolvedPath);
    if (!stat.isDirectory()) {
        return [resolvedPath];
    }
    const names = await fs.promises.readdir(resolvedPath);
    return names
        .filter(name => name.toLowerCase().endsWith('.json'))
        .sort()
        .map(name => path.join(resolvedPath, name));
}

function relativeLuminance(hex: string): number | undefined {
    const match = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(hex.trim());
    if (!match) {
        return undefined;
    }
    let body = match[1];
    if (body.length <= 4) {
        body = body.split('').map(c => c + c).join('');
    }
    const channels = [0, 2, 4].map(offset => {
        const value = parseInt(body.slice(offset, offset + 2), 16) / 255;
        return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/**
 * Determines whether a theme document is dark or light, first from its
 * `type` field and otherwise from the editor background brightness.
 */
export function inferThemeVariant(doc: ColorThemeDocument): ThemeVariant | undefined {
    const type = typeof doc.type === 'string' ? doc.type.toLowerCase() : '';
    if (['light', 'vs', 'hclight', 'hc-light'].includes(type)) {
        return 'light';
    }
    if (['dark', 'vs-dark', 'hc', 'hcdark', 'hc-black'].includes(type)) {
        return 'dark';
    }
    const background = doc.colors?.['editor.background'];
    const luminance = typeof background === 'string' ? relativeLuminance(background) : undefined;
    if (luminance === undefined) {
        return undefined;
    }
    return luminance > 0.4 ? 'light' : 'dark';
}
