import { sdkCharForFrameKey } from './glyph-names';

export interface IFrameSize {
    key: string;
    width: number;
    height: number;
}

export interface ISyntheticGlyph {
    key: string;
    char: string;
    id: number;
    width: number;
    height: number;
}

export interface ICharCollision {
    char: string;
    keys: string[];
    usedKey: string;
}

export interface ISyntheticFont {
    size: number;
    lineHeight: number;
    referenceKey: string | null;
    glyphs: ISyntheticGlyph[];
    unmappedKeys: string[];
    collisions: ICharCollision[];
}

export function orderLikeObjectKeys<T extends { key: string }>(items: readonly T[]): T[] {
    const byKey: Record<string, T> = Object.create(null);

    for (const item of items) {
        byKey[item.key] = item;
    }

    return Object.keys(byKey).flatMap((key) => {
        const item = byKey[key];

        return item ? [item] : [];
    });
}

export function buildSyntheticFont(frames: readonly IFrameSize[]): ISyntheticFont {
    const glyphs: ISyntheticGlyph[] = [];
    const unmappedKeys: string[] = [];
    const keysByChar = new Map<string, string[]>();

    for (const frame of frames) {
        const char = sdkCharForFrameKey(frame.key);

        if (char === null) {
            unmappedKeys.push(frame.key);
            continue;
        }

        glyphs.push({ key: frame.key, char, id: char.charCodeAt(0), width: frame.width, height: frame.height });
        keysByChar.set(char, [...(keysByChar.get(char) ?? []), frame.key]);
    }

    const collisions = [...keysByChar.entries()]
        .filter(([, keys]) => keys.length > 1)
        .map(([char, keys]) => ({ char, keys, usedKey: keys[keys.length - 1] ?? '' }));
    const reference = frames[0];

    return {
        size: reference?.height ?? 0,
        lineHeight: reference?.height ?? 0,
        referenceKey: reference?.key ?? null,
        glyphs,
        unmappedKeys,
        collisions,
    };
}
