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

export function sdkGlyphNames(): string[] {
    return Object.keys(SDK_FONT_CHAR_MAP);
}

export function builderOnlyGlyphNames(): string[] {
    return Object.keys(BUILDER_FONT_CHAR_MAP).filter((name) => !Object.hasOwn(SDK_FONT_CHAR_MAP, name));
}
