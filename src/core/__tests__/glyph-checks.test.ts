import { describe, expect, it } from 'vitest';
import { findMissingChars, formatCodePoint, splitByCoverage } from '../coverage';
import { checkGlyphs, inkBaseline, type IGlyphCheckInput } from '../glyph-checks';

function glyph(key: string, char: string | null, width: number, height: number, bottom = 10): IGlyphCheckInput {
    return { key, char, width, height, ink: { left: 2, top: 10, right: 2, bottom }, empty: false };
}

const DIGITS = '0123456789'.split('').map((digit) => glyph(digit, digit, 120, 175));

describe('checkGlyphs', () => {
    it('finds nothing wrong in a clean digits font apart from the missing space', () => {
        const issues = checkGlyphs([...DIGITS, glyph('dot', '.', 66, 175)], '0');

        expect(issues.map((issue) => issue.level)).toEqual(['info']);
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
        );
        const byText = (text: string): string[] =>
            issues.find((issue) => issue.message.includes(text))?.glyphKeys ?? ['<not reported>'];

        expect(byText('No character')).toEqual(['x_big']);
        expect(byText('heights differ')).toEqual(['m']);
        expect(byText('different widths')).toEqual(['8']);
        expect(byText('baselines')).toEqual(['9']);
        expect(byText('transparent')).toEqual(['comma']);
    });

    it('notes mixed letter case', () => {
        const issues = checkGlyphs([...DIGITS, glyph('K', 'K', 120, 175), glyph('m', 'm', 120, 175)], '0');

        expect(issues.some((issue) => issue.message.includes('case-sensitive'))).toBe(true);
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
