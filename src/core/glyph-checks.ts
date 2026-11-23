import { BASELINE_TOLERANCE_RATIO, MIN_BASELINE_TOLERANCE_PX } from './constants';
import { builderOnlyGlyphNames, sdkGlyphNames } from './glyph-names';
import type { IInkBox, IIssue } from './interfaces';
import type { ICharCollision } from './synthetic-font';

export interface IGlyphCheckInput {
    key: string;
    char: string | null;
    width: number;
    height: number;
    ink: IInkBox | null;
    empty: boolean;
}

const DIGIT = /^[0-9]$/;
const LETTER = /^\p{L}$/u;

export function checkGlyphs(glyphs: readonly IGlyphCheckInput[], referenceKey: string | null): IIssue[] {
    if (glyphs.length === 0) {
        return [{ level: 'error', message: 'The font has no glyphs.' }];
    }

    const reference = glyphs.find((glyph) => glyph.key === referenceKey) ?? null;

    return [
        ...checkUnmapped(glyphs),
        ...checkHeights(glyphs, reference),
        ...checkDigitWidths(glyphs),
        ...checkBaselines(glyphs, reference),
        ...checkEmpty(glyphs),
        ...checkLetterCase(glyphs),
        ...checkSpace(glyphs),
    ];
}

export function collisionIssues(collisions: readonly ICharCollision[], stage: 'builder' | 'sdk'): IIssue[] {
    return collisions.map((collision) => ({
        level: 'warning',
        message:
            stage === 'builder'
                ? `Files ${collision.keys.map(quote).join(', ')} all become "${collision.char}" in the atlas; assets-builder keeps only one of them.`
                : `Glyphs ${collision.keys.map(quote).join(', ')} are all "${collision.char}"; the game uses "${collision.usedKey}".`,
        glyphKeys: collision.keys,
    }));
}

export function inkBaseline(glyphs: readonly IGlyphCheckInput[]): number | null {
    const digits = glyphs.filter((glyph) => isDigit(glyph) && glyph.ink && !glyph.empty);
    const pool = digits.length > 0 ? digits : glyphs.filter((glyph) => glyph.ink && !glyph.empty);

    return median(pool.flatMap((glyph) => (glyph.ink ? [glyph.height - glyph.ink.bottom] : [])));
}

function checkUnmapped(glyphs: readonly IGlyphCheckInput[]): IIssue[] {
    const unmapped = glyphs.filter((glyph) => glyph.char === null);

    if (unmapped.length === 0) {
        return [];
    }

    return [
        {
            level: 'error',
            message:
                `No character for ${unmapped.map((glyph) => quote(glyph.key)).join(', ')}. ` +
                'The game crashes while loading the fonts bundle on such a name. ' +
                `Name the file after the character itself or use: ${sdkGlyphNames().join(', ')} ` +
                `(assets-builder also maps ${builderOnlyGlyphNames().join(', ')}).`,
            glyphKeys: unmapped.map((glyph) => glyph.key),
        },
    ];
}

function checkHeights(glyphs: readonly IGlyphCheckInput[], reference: IGlyphCheckInput | null): IIssue[] {
    if (!reference) {
        return [];
    }

    const different = glyphs.filter((glyph) => glyph.height !== reference.height);

    if (different.length === 0) {
        return [];
    }

    return [
        {
            level: 'warning',
            message:
                `Glyph heights differ. The game takes the font size and line height from the first glyph ` +
                `${quote(reference.key)} (${reference.height}px) and aligns every glyph by its top edge, ` +
                'so a glyph with a different canvas height sits off the line.',
            glyphKeys: different.map((glyph) => glyph.key),
            details: different.map((glyph) => `${glyph.key}: ${glyph.height}px`),
        },
    ];
}

function checkDigitWidths(glyphs: readonly IGlyphCheckInput[]): IIssue[] {
    const digits = glyphs.filter(isDigit);
    const widths = new Set(digits.map((glyph) => glyph.width));

    if (widths.size <= 1) {
        return [];
    }

    const common = mostCommon(digits.map((glyph) => glyph.width));
    const different = digits.filter((glyph) => glyph.width !== common);

    return [
        {
            level: 'warning',
            message: `Digits have different widths (most are ${common}px). Win counters shift sideways while the value changes.`,
            glyphKeys: different.map((glyph) => glyph.key),
            details: different.map((glyph) => `${glyph.key}: ${glyph.width}px`),
        },
    ];
}

function checkBaselines(glyphs: readonly IGlyphCheckInput[], reference: IGlyphCheckInput | null): IIssue[] {
    const digits = glyphs.filter((glyph) => isDigit(glyph) && glyph.ink && !glyph.empty);
    const baseline = inkBaseline(digits);

    if (digits.length < 2 || baseline === null) {
        return [];
    }

    const height = reference?.height ?? Math.max(...digits.map((glyph) => glyph.height));
    const tolerance = Math.max(MIN_BASELINE_TOLERANCE_PX, Math.round(height * BASELINE_TOLERANCE_RATIO));
    const offsets = digits.map((glyph) => ({ glyph, offset: glyph.height - (glyph.ink?.bottom ?? 0) - baseline }));
    const outliers = offsets.filter((item) => Math.abs(item.offset) > tolerance);

    if (outliers.length === 0) {
        return [];
    }

    return [
        {
            level: 'warning',
            message: `Digits stand on different baselines (more than ${tolerance}px from the common one at ${baseline}px).`,
            glyphKeys: outliers.map((item) => item.glyph.key),
            details: outliers.map(
                (item) => `${item.glyph.key}: ${item.offset > 0 ? 'lower' : 'higher'} by ${Math.abs(item.offset)}px`,
            ),
        },
    ];
}

function checkEmpty(glyphs: readonly IGlyphCheckInput[]): IIssue[] {
    const empty = glyphs.filter((glyph) => glyph.empty && glyph.char !== ' ');

    if (empty.length === 0) {
        return [];
    }

    return [
        {
            level: 'warning',
            message: `Fully transparent glyph(s): ${empty.map((glyph) => quote(glyph.key)).join(', ')}.`,
            glyphKeys: empty.map((glyph) => glyph.key),
        },
    ];
}

function checkLetterCase(glyphs: readonly IGlyphCheckInput[]): IIssue[] {
    const letters = glyphs.flatMap((glyph) => (glyph.char && LETTER.test(glyph.char) ? [glyph.char] : []));
    const upper = letters.filter((letter) => letter !== letter.toLowerCase());
    const lower = letters.filter((letter) => letter !== letter.toUpperCase());

    if (upper.length === 0 || lower.length === 0) {
        return [];
    }

    return [
        {
            level: 'info',
            message:
                `Letters are case-sensitive: the font has uppercase ${upper.join(' ')} and lowercase ${lower.join(' ')}. ` +
                'The game text must use the same case, "10K" needs a "K" glyph and "10k" needs a "k" glyph.',
        },
    ];
}

function checkSpace(glyphs: readonly IGlyphCheckInput[]): IIssue[] {
    if (glyphs.some((glyph) => glyph.char === ' ')) {
        return [];
    }

    return [
        {
            level: 'info',
            message: 'No space glyph: spaces in the text take no room, "1 000" renders as "1000".',
        },
    ];
}

function isDigit(glyph: IGlyphCheckInput): boolean {
    return glyph.char !== null && DIGIT.test(glyph.char);
}

function median(values: readonly number[]): number | null {
    if (values.length === 0) {
        return null;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    const upper = sorted[middle] ?? 0;
    const lower = sorted[middle - 1] ?? upper;

    return sorted.length % 2 === 0 ? Math.round((lower + upper) / 2) : upper;
}

function mostCommon(values: readonly number[]): number {
    const counts = new Map<number, number>();

    for (const value of values) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
    }

    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? 0;
}

function quote(value: string): string {
    return `"${value}"`;
}
