import { describe, expect, it } from 'vitest';
import { checkGlyphs, type IGlyphCheckInput } from '../glyph-checks';
import { findSpecks } from '../specks';

const SIZE = 64;

function image(paint: (set: (x: number, y: number, alpha: number) => void) => void): Uint8ClampedArray {
    const rgba = new Uint8ClampedArray(SIZE * SIZE * 4);
    paint((x, y, alpha) => {
        rgba[(y * SIZE + x) * 4 + 3] = alpha;
    });

    return rgba;
}

function block(
    set: (x: number, y: number, alpha: number) => void,
    x0: number,
    y0: number,
    size: number,
    alpha: number,
): void {
    for (let y = y0; y < y0 + size; y++) {
        for (let x = x0; x < x0 + size; x++) {
            set(x, y, alpha);
        }
    }
}

describe('findSpecks', () => {
    it('finds a small visible spot apart from the glyph', () => {
        const rgba = image((set) => {
            block(set, 10, 10, 40, 255);
            block(set, 58, 2, 2, 200);
        });

        expect(findSpecks(rgba, SIZE, SIZE)).toEqual([{ x: 58, y: 2, width: 2, height: 2, pixels: 4 }]);
    });

    it('ignores faint pixels, spots touching the glyph and large separate parts', () => {
        const rgba = image((set) => {
            block(set, 10, 10, 40, 255);
            block(set, 58, 2, 2, 40);
            block(set, 50, 30, 2, 255);
            block(set, 2, 54, 8, 255);
        });

        expect(findSpecks(rgba, SIZE, SIZE)).toEqual([]);
    });

    it('finds nothing in an empty image', () => {
        expect(findSpecks(new Uint8ClampedArray(SIZE * SIZE * 4), SIZE, SIZE)).toEqual([]);
    });
});

describe('stray pixels check', () => {
    it('lists the glyphs with spots and where the spots are', () => {
        const clean: IGlyphCheckInput = { key: '0', char: '0', width: 64, height: 64, ink: null, empty: false };
        const spotted: IGlyphCheckInput = {
            ...clean,
            key: '1',
            char: '1',
            specks: [
                { x: 58, y: 2, width: 2, height: 2, pixels: 4 },
                { x: 3, y: 60, width: 1, height: 1, pixels: 1 },
            ],
        };
        const issue = checkGlyphs([clean, spotted], '0', 'source').find((item) => item.code === 'stray-pixels');

        expect(issue?.level).toBe('warning');
        expect(issue?.glyphKeys).toEqual(['1']);
        expect(issue?.details).toEqual(['1: 2 spot(s) at x 58, y 2; x 3, y 60']);
    });
});
