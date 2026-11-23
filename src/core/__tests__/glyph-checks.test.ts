import { describe, expect, it } from 'vitest';
import { findMissingChars, formatCodePoint, splitByCoverage } from '../coverage';
import { checkGlyphs, digitBaselineOffsets, inkBaseline, type IGlyphCheckInput } from '../glyph-checks';
import type { IssueCode } from '../interfaces';

function glyph(key: string, char: string | null, width: number, height: number, bottom = 10): IGlyphCheckInput {
    return { key, char, width, height, ink: { left: 2, top: 10, right: 2, bottom, solidBottom: bottom }, empty: false };
}

function measured(height: number, bottoms: Record<string, number>): IGlyphCheckInput[] {
    return Object.entries(bottoms).map(([digit, bottom]) => {
        const margin = height - 1 - bottom;

        return {
            key: digit,
            char: digit,
            width: 100,
            height,
            ink: { left: 0, top: 0, right: 0, bottom: margin, solidBottom: margin },
            empty: false,
        };
    });
}

const ALIGNMENT_CODES: readonly IssueCode[] = ['digit-alignment', 'digit-shape', 'round-higher', 'overshoot'];

function alignmentIssues(glyphs: IGlyphCheckInput[]): { level: string; glyphKeys?: string[]; details?: string[] }[] {
    return checkGlyphs(glyphs, '0', 'source')
        .filter((issue) => ALIGNMENT_CODES.includes(issue.code))
        .map(({ level, glyphKeys, details }) => ({ level, glyphKeys, details }));
}

const DIGITS = '0123456789'.split('').map((digit) => glyph(digit, digit, 120, 175));

describe('checkGlyphs', () => {
    it('finds nothing wrong in a clean digits font apart from the missing space', () => {
        const issues = checkGlyphs([...DIGITS, glyph('dot', '.', 66, 175)], '0', 'source');

        expect(issues.map((issue) => issue.code)).toEqual(['overshoot', 'no-space']);
    });

    it('flags unmapped names, height and width differences, baselines and empty glyphs', () => {
        const issues = checkGlyphs(
            [
                ...DIGITS.slice(0, 8),
                glyph('8', '8', 110, 175),
                glyph('9', '9', 120, 175, 30),
                glyph('m', 'm', 144, 160),
                glyph('x_big', null, 100, 175),
                { key: 'comma', char: ',', width: 50, height: 175, ink: null, empty: true },
            ],
            '0',
            'source',
        );
        const byCode = (code: IssueCode): string[] =>
            issues.find((issue) => issue.code === code)?.glyphKeys ?? ['<not reported>'];

        expect(byCode('unknown-name')).toEqual(['x_big']);
        expect(byCode('heights')).toEqual(['m']);
        expect(byCode('digit-widths')).toEqual(['8']);
        expect(byCode('digit-alignment')).toEqual(['9']);
        expect(byCode('empty')).toEqual(['comma']);
    });

    it('notes mixed letter case', () => {
        const issues = checkGlyphs([...DIGITS, glyph('K', 'K', 120, 175), glyph('m', 'm', 120, 175)], '0', 'source');

        expect(issues.some((issue) => issue.code === 'letter-case')).toBe(true);
    });

    it('suggests what an unknown file name probably means', () => {
        const glyphs = [
            ...DIGITS,
            glyph('coma', null, 50, 175),
            glyph('m_small', null, 120, 175),
            glyph('percent', null, 120, 175),
        ];
        const issue = checkGlyphs(glyphs, '0', 'source').find((item) => item.code === 'unknown-name');

        expect(issue?.details).toEqual([
            'coma: did you mean "comma"?',
            'm_small: probably the character "m"',
            'percent: unknown name',
        ]);
        expect(issue?.fix).toContain('File name mapping');
    });

    it('treats an unknown name as a warning in a source folder and as an error in a built atlas', () => {
        const glyphs = [...DIGITS, glyph('x_small', null, 120, 175)];
        const unmapped = (stage: 'source' | 'atlas'): string | undefined =>
            checkGlyphs(glyphs, '0', stage).find((issue) => issue.glyphKeys?.includes('x_small'))?.level;

        expect(unmapped('source')).toBe('warning');
        expect(unmapped('atlas')).toBe('error');
    });

    it('reports no alignment problem when round digits overshoot the flat ones (game-starter-pack numbers)', () => {
        const starter = measured(150, {
            0: 142,
            1: 140,
            2: 140,
            3: 142,
            4: 140,
            5: 142,
            6: 142,
            7: 140,
            8: 142,
            9: 142,
        });

        expect(alignmentIssues(starter)).toEqual([]);
    });

    it('explains why flat digits look lower when nothing overshoots (3_power_sevens numbers)', () => {
        const sevens = measured(150, {
            0: 141,
            1: 141,
            2: 141,
            3: 141,
            4: 141,
            5: 141,
            6: 141,
            7: 141,
            8: 141,
            9: 141,
        });
        const issues = alignmentIssues(sevens);

        expect(issues.map((issue) => issue.level)).toEqual(['info']);
        expect(checkGlyphs(sevens, '0', 'source').find((issue) => issue.code === 'overshoot')?.fix).toContain('2–3px');
    });

    it('names each digit that stands off its line (green-and-mean numbers)', () => {
        const green = measured(420, { 0: 389, 1: 394, 2: 389, 3: 391, 4: 389, 5: 388, 6: 386, 7: 386, 8: 379, 9: 386 });

        expect(alignmentIssues(green)[0]).toEqual({
            level: 'warning',
            glyphKeys: ['1', '8'],
            details: ['1: 5px lower than 2 4 7', '8: 8px higher than 0 3 5 6 9'],
        });
    });

    it('notes a round digit that ends on the flat line (dynasty_coin_10000 numbers)', () => {
        const dynasty = measured(842, {
            0: 806,
            1: 793,
            2: 792,
            3: 804,
            4: 792,
            5: 805,
            6: 803,
            7: 792,
            8: 806,
            9: 792,
        });

        expect(alignmentIssues(dynasty)).toEqual([
            {
                level: 'info',
                glyphKeys: ['9'],
                details: ['9: 13px higher than 0 3 5 6 8, on the line of 1 2 4 7'],
            },
        ]);
    });

    it('gives every digit its offset from the flat-digit baseline', () => {
        const starter = measured(150, {
            0: 142,
            1: 140,
            2: 140,
            3: 142,
            4: 140,
            5: 142,
            6: 142,
            7: 140,
            8: 142,
            9: 142,
        });

        expect(Object.fromEntries(digitBaselineOffsets(starter))).toMatchObject({ 0: 2, 1: 0, 2: 0, 5: 2 });
    });

    it('computes the ink baseline from the digits', () => {
        expect(inkBaseline(DIGITS)).toBe(165);
    });
});

describe('coverage', () => {
    const available = new Set(Array.from('0123456789.,').map((char) => char.codePointAt(0) ?? 0));

    it('lists missing characters with counts and ignores line breaks', () => {
        expect(findMissingChars('1,234.56 €\n€', available)).toEqual([
            { char: ' ', codePoint: 32, count: 1 },
            { char: '€', codePoint: 8364, count: 2 },
        ]);
    });

    it('splits the text into covered and missing runs', () => {
        expect(splitByCoverage('12ab3', available)).toEqual([
            { text: '12', missing: false },
            { text: 'ab', missing: true },
            { text: '3', missing: false },
        ]);
    });

    it('formats code points', () => {
        expect(formatCodePoint(8364)).toBe('U+20AC');
        expect(formatCodePoint(0x1f600)).toBe('U+1F600');
    });
});
