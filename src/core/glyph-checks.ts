import {
    BASELINE_TOLERANCE_RATIO,
    FLAT_BOTTOM_DIGITS,
    MIN_BASELINE_TOLERANCE_PX,
    MIN_DIGITS_IN_GROUP,
    MIN_OVERSHOOT_RATIO,
    ROUND_BOTTOM_DIGITS,
} from './constants';
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

interface IMeasuredDigit {
    key: string;
    char: string;
    line: number;
}

const DIGIT = /^[0-9]$/;
const LETTER = /^\p{L}$/u;

export type GlyphNameStage = 'source' | 'atlas';

export function checkGlyphs(
    glyphs: readonly IGlyphCheckInput[],
    referenceKey: string | null,
    stage: GlyphNameStage,
): IIssue[] {
    if (glyphs.length === 0) {
        return [{ level: 'error', message: 'The font has no glyphs.' }];
    }

    const reference = glyphs.find((glyph) => glyph.key === referenceKey) ?? null;

    return [
        ...checkUnmapped(glyphs, stage),
        ...checkHeights(glyphs, reference),
        ...checkDigitWidths(glyphs),
        ...checkDigitAlignment(glyphs, reference),
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

export function solidBottomLine(glyph: IGlyphCheckInput): number | null {
    return glyph.ink && !glyph.empty ? glyph.height - glyph.ink.solidBottom : null;
}

export function inkBaseline(glyphs: readonly IGlyphCheckInput[]): number | null {
    const flatDigits = glyphs.filter((glyph) => glyph.char !== null && FLAT_BOTTOM_DIGITS.includes(glyph.char));

    for (const pool of [flatDigits, glyphs.filter(isDigit), glyphs]) {
        const lines = pool.flatMap((glyph) => {
            const line = solidBottomLine(glyph);

            return line === null ? [] : [line];
        });

        if (lines.length > 0) {
            return median(lines);
        }
    }

    return null;
}

export function digitBaselineOffsets(glyphs: readonly IGlyphCheckInput[]): Map<string, number> {
    const baseline = inkBaseline(glyphs);
    const offsets = new Map<string, number>();

    if (baseline === null) {
        return offsets;
    }

    for (const glyph of glyphs.filter(isDigit)) {
        const line = solidBottomLine(glyph);

        if (line !== null) {
            offsets.set(glyph.key, line - baseline);
        }
    }

    return offsets;
}

function checkUnmapped(glyphs: readonly IGlyphCheckInput[], stage: GlyphNameStage): IIssue[] {
    const unmapped = glyphs.filter((glyph) => glyph.char === null);

    if (unmapped.length === 0) {
        return [];
    }

    const names = unmapped.map((glyph) => quote(glyph.key)).join(', ');
    const glyphKeys = unmapped.map((glyph) => glyph.key);

    if (stage === 'atlas') {
        return [
            {
                level: 'error',
                message:
                    `No character for frame ${names}. The game loader knows only one-character names and ` +
                    `${sdkGlyphNames().join(', ')}, so loading the fonts bundle fails.`,
                glyphKeys,
            },
        ];
    }

    return [
        {
            level: 'warning',
            message:
                `No character for ${names} in the default assets-builder mapping ` +
                `(${sdkGlyphNames().join(', ')}, ${builderOnlyGlyphNames().join(', ')}). ` +
                'It works only if the game maps it in fontCharMap of tools/assets-builder.config.ts, ' +
                "for example x_small: 'x'; otherwise loading the fonts bundle fails. " +
                'Add the same entries under "File name mapping" to preview these glyphs.',
            glyphKeys,
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

function checkDigitAlignment(glyphs: readonly IGlyphCheckInput[], reference: IGlyphCheckInput | null): IIssue[] {
    const height = reference?.height ?? Math.max(0, ...glyphs.map((glyph) => glyph.height));
    const tolerance = Math.max(MIN_BASELINE_TOLERANCE_PX, Math.round(height * BASELINE_TOLERANCE_RATIO));
    const flat = measuredDigits(glyphs, FLAT_BOTTOM_DIGITS);
    const round = measuredDigits(glyphs, ROUND_BOTTOM_DIGITS);
    const flatLine = groupLine(flat);
    const roundLine = groupLine(round);
    const outliers: IMeasuredDigit[] = [];
    const outlierDetails: string[] = [];
    const crossed: IMeasuredDigit[] = [];
    const crossedDetails: string[] = [];

    for (const [group, line, otherLine, otherGroup] of [
        [flat, flatLine, roundLine, round],
        [round, roundLine, flatLine, flat],
    ] as const) {
        if (line === null) {
            continue;
        }

        for (const digit of group) {
            const offset = digit.line - line;

            if (Math.abs(offset) <= tolerance) {
                continue;
            }

            const peers = group.filter((item) => item !== digit).map((item) => item.char);
            const relation = `${Math.abs(offset)}px ${offset > 0 ? 'lower' : 'higher'} than ${peers.join(' ')}`;

            if (otherLine !== null && Math.abs(digit.line - otherLine) <= tolerance) {
                crossed.push(digit);
                crossedDetails.push(
                    `${digit.char}: ${relation}, on the line of ${otherGroup.map((item) => item.char).join(' ')}`,
                );
            } else {
                outliers.push(digit);
                outlierDetails.push(`${digit.char}: ${relation}`);
            }
        }
    }

    const issues: IIssue[] = [];

    if (outliers.length > 0) {
        issues.push({
            level: 'warning',
            message:
                `Digits off their line: the bottom edge is more than ${tolerance}px away from the other digits ` +
                'with the same bottom shape (flat 1 2 4 7, round 0 3 5 6 8 9).',
            glyphKeys: outliers.map((digit) => digit.key),
            details: outlierDetails,
        });
    }

    if (crossed.length > 0) {
        issues.push({
            level: 'info',
            message: 'A digit ends on the line of the other bottom shape. Fine if its bottom is shaped that way.',
            glyphKeys: crossed.map((digit) => digit.key),
            details: crossedDetails,
        });
    }

    return [...issues, ...checkOvershoot(flatLine, roundLine, height, tolerance)];
}

function checkOvershoot(
    flatLine: number | null,
    roundLine: number | null,
    height: number,
    tolerance: number,
): IIssue[] {
    if (flatLine === null || roundLine === null) {
        return [];
    }

    const overshoot = roundLine - flatLine;

    if (overshoot < -tolerance) {
        return [
            {
                level: 'warning',
                message: `Round digits 0 3 5 6 8 9 stand ${-overshoot}px higher than flat digits 1 2 4 7.`,
                details: [`flat digits end at ${flatLine}px, round digits at ${roundLine}px from the top`],
            },
        ];
    }

    if (overshoot >= height * MIN_OVERSHOOT_RATIO) {
        return [];
    }

    return [
        {
            level: 'info',
            message:
                `Round digits 0 3 5 6 8 9 end on the same line as flat digits 1 2 4 7 (${flatLine}px from the top). ` +
                'That is exact, but a round bottom touches the line in one point, so 1 2 4 7 can look a little lower ' +
                `next to them. Fonts usually let round digits go 1–2% of the height below the line ` +
                `(${Math.round(height * 0.01)}–${Math.round(height * 0.02)}px here).`,
        },
    ];
}

function measuredDigits(glyphs: readonly IGlyphCheckInput[], digits: readonly string[]): IMeasuredDigit[] {
    return glyphs.flatMap((glyph) => {
        const line = solidBottomLine(glyph);

        return glyph.char !== null && digits.includes(glyph.char) && line !== null
            ? [{ key: glyph.key, char: glyph.char, line }]
            : [];
    });
}

function groupLine(group: readonly IMeasuredDigit[]): number | null {
    return group.length >= MIN_DIGITS_IN_GROUP ? median(group.map((digit) => digit.line)) : null;
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
