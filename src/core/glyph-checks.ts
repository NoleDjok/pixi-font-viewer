import {
    BASELINE_TOLERANCE_RATIO,
    FLAT_BOTTOM_DIGITS,
    MIN_BASELINE_TOLERANCE_PX,
    MIN_DIGITS_IN_GROUP,
    MIN_OVERSHOOT_RATIO,
    ROUND_BOTTOM_DIGITS,
} from './constants';
import { builderGlyphNames, sdkGlyphNames, suggestGlyphName } from './glyph-names';
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
const FLAT_LIST = FLAT_BOTTOM_DIGITS.join(' ');
const ROUND_LIST = ROUND_BOTTOM_DIGITS.join(' ');

export type GlyphNameStage = 'source' | 'atlas';

export function checkGlyphs(
    glyphs: readonly IGlyphCheckInput[],
    referenceKey: string | null,
    stage: GlyphNameStage,
): IIssue[] {
    if (glyphs.length === 0) {
        return [{ code: 'no-glyphs', level: 'error', message: 'The font has no glyphs.' }];
    }

    const reference = glyphs.find((glyph) => glyph.key === referenceKey) ?? null;

    return [
        ...checkUnknownNames(glyphs, stage),
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
        code: 'duplicate',
        level: 'warning',
        message:
            stage === 'builder'
                ? `Several files turn into the same character "${collision.char}": ${list(collision.keys)}. ` +
                  'Only one of them gets into the game.'
                : `Several frames are the same character "${collision.char}": ${list(collision.keys)}. ` +
                  `The game shows "${collision.usedKey}".`,
        fix: 'Keep one file per character.',
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

function checkUnknownNames(glyphs: readonly IGlyphCheckInput[], stage: GlyphNameStage): IIssue[] {
    const unknown = glyphs.filter((glyph) => glyph.char === null);

    if (unknown.length === 0) {
        return [];
    }

    const knownNames = stage === 'source' ? builderGlyphNames() : sdkGlyphNames();
    const details = unknown.map((glyph) => describeUnknownName(glyph.key, knownNames));
    const glyphKeys = unknown.map((glyph) => glyph.key);

    if (stage === 'atlas') {
        return [
            {
                code: 'unknown-name',
                level: 'error',
                message: `The game doesn't know which character these atlas frames are: ${list(glyphKeys)}. It can't load its fonts with them.`,
                fix: 'Rebuild the atlas from correctly named glyph files.',
                glyphKeys,
                details,
            },
        ];
    }

    return [
        {
            code: 'unknown-name',
            level: 'warning',
            message: `The game doesn't know which character ${unknown.length === 1 ? 'this file is' : 'these files are'}: ${list(glyphKeys)}.`,
            fix:
                `Name the file after its character (5.png, k.png) or use one of: ${knownNames.join(', ')}. ` +
                'If developers taught the game this name (3 Power Sevens knows x_small and m_small), type it under ' +
                '"File name mapping" on the left to preview it. Otherwise the game cannot load its fonts.',
            glyphKeys,
            details,
        },
    ];
}

function describeUnknownName(name: string, knownNames: readonly string[]): string {
    const suggestion = suggestGlyphName(name, knownNames);

    if (suggestion?.kind === 'name') {
        return `${name}: did you mean "${suggestion.value}"?`;
    }

    if (suggestion?.kind === 'char') {
        return `${name}: probably the character "${suggestion.value}"`;
    }

    return `${name}: unknown name`;
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
            code: 'heights',
            level: 'warning',
            message:
                'Not all glyph images are the same height. The game lines glyphs up by the top edge of the image, ' +
                'so a glyph in a shorter or taller image sits higher or lower than the rest.',
            fix: `Export every glyph with the same image height as "${reference.key}" (${reference.height}px).`,
            glyphKeys: different.map((glyph) => glyph.key),
            details: different.map((glyph) => `${glyph.key}: ${glyph.height}px instead of ${reference.height}px`),
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
            code: 'digit-widths',
            level: 'warning',
            message: 'Digits are not the same width, so a win amount that counts up shifts left and right.',
            fix: `Give every digit the same image width (${common}px) and centre the digit inside it.`,
            glyphKeys: different.map((glyph) => glyph.key),
            details: different.map((glyph) => `${glyph.key}: ${glyph.width}px instead of ${common}px`),
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
            code: 'digit-alignment',
            level: 'warning',
            message: 'Some digits stand higher or lower than the others.',
            fix:
                'Move the digit up or down inside its image until its bottom edge matches the others ' +
                `(more than ${tolerance}px off is visible). Digits with a flat bottom (${FLAT_LIST}) are compared ` +
                `with each other, round ones (${ROUND_LIST}) with each other.`,
            glyphKeys: outliers.map((digit) => digit.key),
            details: outlierDetails,
        });
    }

    if (crossed.length > 0) {
        issues.push({
            code: 'digit-shape',
            level: 'info',
            message: 'A digit ends on the line of the digits with the other bottom shape.',
            fix: `Fine if its bottom is shaped like theirs. Otherwise move it to the line of its own group.`,
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
                code: 'round-higher',
                level: 'warning',
                message: `Round digits ${ROUND_LIST} stand ${-overshoot}px higher than flat digits ${FLAT_LIST}.`,
                fix: 'Move the round digits down to the line of the flat ones or slightly below it.',
            },
        ];
    }

    if (overshoot >= height * MIN_OVERSHOOT_RATIO) {
        return [];
    }

    return [
        {
            code: 'overshoot',
            level: 'info',
            message:
                `Flat digits ${FLAT_LIST} may look a little lower than round ones ${ROUND_LIST}. They end on exactly ` +
                'the same line, but a round bottom touches it in one point only, so it looks higher.',
            fix:
                `If it bothers you, move the round digits ${Math.round(height * 0.01)}–${Math.round(height * 0.02)}px ` +
                'lower (1–2% of the height), as many fonts do. Otherwise leave it.',
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
            code: 'empty',
            level: 'warning',
            message: `These glyph images are completely transparent: ${list(empty.map((glyph) => glyph.key))}.`,
            fix: 'Check the export: only a space may be empty.',
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
            code: 'letter-case',
            level: 'info',
            message:
                'Uppercase and lowercase letters are different characters for the game. ' +
                `This font has uppercase ${upper.join(' ')} and lowercase ${lower.join(' ')}.`,
            fix: 'Make sure the game text uses the same case: "10K" needs K.png, "10k" needs k.png.',
        },
    ];
}

function checkSpace(glyphs: readonly IGlyphCheckInput[]): IIssue[] {
    if (glyphs.some((glyph) => glyph.char === ' ')) {
        return [];
    }

    return [
        {
            code: 'no-space',
            level: 'info',
            message: 'There is no space glyph, so a space in the text is skipped: "1 000" shows as "1000".',
            fix: 'Add space.png (a transparent image as wide as the gap) if the game shows numbers with spaces. Otherwise ignore this.',
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

function list(names: readonly string[]): string {
    return names.map((name) => `"${name}"`).join(', ');
}
