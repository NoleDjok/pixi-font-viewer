import { BUILDER_FONT_CHAR_MAP, SDK_FONT_CHAR_MAP } from './constants';

export function lookupChar(map: Readonly<Record<string, string>>, key: string): string | undefined {
    return Object.hasOwn(map, key) ? map[key] : undefined;
}

export interface ICharMapParseResult {
    map: Record<string, string>;
    errors: string[];
}

const CHAR_MAP_ENTRY = /['"]?([^\s'":=,;{}]+)['"]?\s*[:=]\s*(?:'([^']*)'|"([^"]*)"|([^\s,;'"{}]+))/g;

export function builderFrameKey(fileBaseName: string, extraMap: Readonly<Record<string, string>> = {}): string {
    return lookupChar(extraMap, fileBaseName) ?? lookupChar(BUILDER_FONT_CHAR_MAP, fileBaseName) ?? fileBaseName;
}

export function parseCharMap(text: string): ICharMapParseResult {
    const map: Record<string, string> = Object.create(null);
    const errors: string[] = [];
    let entries = 0;

    for (const match of text.matchAll(CHAR_MAP_ENTRY)) {
        const name = match[1] ?? '';
        const value = match[2] ?? match[3] ?? match[4] ?? '';
        entries++;

        if (Array.from(value).length === 1) {
            map[name] = value;
        } else {
            errors.push(`"${name}" must map to exactly one character, got "${value}".`);
        }
    }

    if (entries === 0 && text.trim() !== '') {
        errors.push('No entries found. Use name=char, for example x_small=x, m_small=m.');
    }

    return { map, errors };
}

export function sdkCharForFrameKey(key: string): string | null {
    if (key.length === 1) {
        return key;
    }

    return lookupChar(SDK_FONT_CHAR_MAP, key) ?? null;
}

export type GlyphNameSuggestion = { kind: 'name'; value: string } | { kind: 'char'; value: string };

const VARIANT_NAME = /^(.)[_\-.]\S+$/u;
const SHORT_NAME_LENGTH = 3;

export function suggestGlyphName(name: string, knownNames: readonly string[]): GlyphNameSuggestion | null {
    const lower = name.toLowerCase();
    let best: string | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const known of knownNames) {
        const distance = editDistance(lower, known);

        if (distance < bestDistance) {
            best = known;
            bestDistance = distance;
        }
    }

    if (best !== null && bestDistance <= (best.length <= SHORT_NAME_LENGTH ? 1 : 2)) {
        return { kind: 'name', value: best };
    }

    const variant = VARIANT_NAME.exec(name)?.[1];

    return variant ? { kind: 'char', value: variant } : null;
}

export function builderGlyphNames(): string[] {
    return Object.keys(BUILDER_FONT_CHAR_MAP);
}

export function sdkGlyphNames(): string[] {
    return Object.keys(SDK_FONT_CHAR_MAP);
}

function editDistance(a: string, b: string): number {
    let previous = Array.from({ length: b.length + 1 }, (_, index) => index);

    for (let i = 1; i <= a.length; i++) {
        const current = [i];

        for (let j = 1; j <= b.length; j++) {
            const substitution = (previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1);
            current.push(Math.min((previous[j] ?? 0) + 1, (current[j - 1] ?? 0) + 1, substitution));
        }

        previous = current;
    }

    return previous[b.length] ?? 0;
}
