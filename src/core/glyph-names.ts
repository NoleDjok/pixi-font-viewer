import { BUILDER_FONT_CHAR_MAP, SDK_FONT_CHAR_MAP } from './constants';

export function lookupChar(map: Readonly<Record<string, string>>, key: string): string | undefined {
    return Object.hasOwn(map, key) ? map[key] : undefined;
}

export function builderFrameKey(fileBaseName: string): string {
    return lookupChar(BUILDER_FONT_CHAR_MAP, fileBaseName) ?? fileBaseName;
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
