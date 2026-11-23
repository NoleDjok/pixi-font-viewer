import { describe, expect, it } from 'vitest';
import { builderFrameKey, builderGlyphNames, parseCharMap, sdkCharForFrameKey, suggestGlyphName } from '../glyph-names';
import { buildSyntheticFont, orderLikeObjectKeys } from '../synthetic-font';

describe('glyph names', () => {
    it('maps file names the way assets-builder does', () => {
        expect(builderFrameKey('dot')).toBe('.');
        expect(builderFrameKey('minus')).toBe('-');
        expect(builderFrameKey('slash')).toBe('/');
        expect(builderFrameKey('K')).toBe('K');
        expect(builderFrameKey('Coma')).toBe('Coma');
        expect(builderFrameKey('constructor')).toBe('constructor');
    });

    it('applies extra fontCharMap entries of a game on top of the defaults', () => {
        const extra = { x_small: 'x', m_small: 'm' };

        expect(builderFrameKey('x_small', extra)).toBe('x');
        expect(builderFrameKey('dot', extra)).toBe('.');
        expect(builderFrameKey('x_small')).toBe('x_small');
    });

    it('parses fontCharMap entries pasted from a config or typed as name=char', () => {
        const pasted = parseCharMap("fontCharMap: {\n    comma: ',',\n    x_small: 'x',\n    m_small: \"m\",\n},");

        expect(pasted.errors).toEqual([]);
        expect({ ...pasted.map }).toEqual({ comma: ',', x_small: 'x', m_small: 'm' });
        expect({ ...parseCharMap('x_small=x; space=" "').map }).toEqual({ x_small: 'x', space: ' ' });
        expect(parseCharMap('').errors).toEqual([]);
    });

    it('reports char map entries that do not map to one character', () => {
        expect(parseCharMap('x_small=xx').errors).toEqual(['"x_small" must map to exactly one character, got "xx".']);
        expect(parseCharMap('just text').errors).toHaveLength(1);
    });

    it('suggests a known name for a typo and the character for a variant name', () => {
        const known = builderGlyphNames();

        expect(suggestGlyphName('coma', known)).toEqual({ kind: 'name', value: 'comma' });
        expect(suggestGlyphName('Coma', known)).toEqual({ kind: 'name', value: 'comma' });
        expect(suggestGlyphName('dott', known)).toEqual({ kind: 'name', value: 'dot' });
        expect(suggestGlyphName('plsu', known)).toEqual({ kind: 'name', value: 'plus' });
        expect(suggestGlyphName('x_small', known)).toEqual({ kind: 'char', value: 'x' });
        expect(suggestGlyphName('x_big', known)).toEqual({ kind: 'char', value: 'x' });
        expect(suggestGlyphName('percent', known)).toBeNull();
    });

    it('maps frame keys the way the fe-sdk loader does', () => {
        expect(sdkCharForFrameKey('7')).toBe('7');
        expect(sdkCharForFrameKey('usd')).toBe('$');
        expect(sdkCharForFrameKey('minus')).toBeNull();
        expect(sdkCharForFrameKey('x_big')).toBeNull();
        expect(sdkCharForFrameKey('toString')).toBeNull();
    });
});

describe('orderLikeObjectKeys', () => {
    it('puts integer-like keys first, like Object.keys of the atlas frames', () => {
        const ordered = orderLikeObjectKeys([{ key: 'x' }, { key: '9' }, { key: ',' }, { key: '0' }, { key: 'k' }]);

        expect(ordered.map((item) => item.key)).toEqual(['0', '9', 'x', ',', 'k']);
    });

    it('keeps the first position and the last value of a repeated key', () => {
        const ordered = orderLikeObjectKeys([
            { key: '-', file: 'dash' },
            { key: 'k', file: 'k' },
            { key: '-', file: 'minus' },
        ]);

        expect(ordered).toEqual([
            { key: '-', file: 'minus' },
            { key: 'k', file: 'k' },
        ]);
    });
});

describe('buildSyntheticFont', () => {
    it('takes size and line height from the first frame and advance from the width', () => {
        const font = buildSyntheticFont([
            { key: '0', width: 120, height: 175 },
            { key: '.', width: 66, height: 160 },
            { key: 'usd', width: 100, height: 175 },
        ]);

        expect(font.size).toBe(175);
        expect(font.lineHeight).toBe(175);
        expect(font.referenceKey).toBe('0');
        expect(font.glyphs.map((glyph) => [glyph.char, glyph.id])).toEqual([
            ['0', 48],
            ['.', 46],
            ['$', 36],
        ]);
    });

    it('reports names without a character and glyphs that end up as the same character', () => {
        const font = buildSyntheticFont([
            { key: '-', width: 10, height: 10 },
            { key: 'x_big', width: 10, height: 10 },
            { key: 'dash', width: 12, height: 10 },
        ]);

        expect(font.unmappedKeys).toEqual(['x_big']);
        expect(font.collisions).toEqual([{ char: '-', keys: ['-', 'dash'], usedKey: 'dash' }]);
    });
});
