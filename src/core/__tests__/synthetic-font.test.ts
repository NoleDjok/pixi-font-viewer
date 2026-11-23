import { describe, expect, it } from 'vitest';
import { builderFrameKey, sdkCharForFrameKey } from '../glyph-names';
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
