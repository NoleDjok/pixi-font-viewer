import { describe, expect, it } from 'vitest';
import { parseBmFont } from '../bmfont-parser';
import { FNT_TEXT, FNT_XML_FULL, XML_MINIMAL } from './fixtures';

describe('parseBmFont', () => {
    it('reads the full XML variant used by .fnt files', () => {
        const font = parseBmFont(FNT_XML_FULL);

        expect(font.format).toBe('xml');
        expect(font.face).toBe('Gold Numbers');
        expect(font.size).toBe(64);
        expect(font.lineHeight).toBe(72);
        expect(font.base).toBe(58);
        expect(font.scaleW).toBe(256);
        expect(font.pages).toEqual([
            { id: 0, file: 'gold_0.png' },
            { id: 1, file: 'gold_1.png' },
        ]);
        expect(font.chars).toHaveLength(3);
        expect(font.chars[2]).toEqual({
            id: 36,
            x: 0,
            y: 0,
            width: 38,
            height: 70,
            xoffset: 0,
            yoffset: 0,
            xadvance: 40,
            page: 1,
        });
        expect(font.kernings).toEqual([{ first: 49, second: 48, amount: -3 }]);
        expect(font.warnings).toEqual([]);
    });

    it('reads the minimal .xml variant without base and optional attributes', () => {
        const font = parseBmFont(XML_MINIMAL);

        expect(font.face).toBe('Small & Bold');
        expect(font.base).toBeNull();
        expect(font.lineHeight).toBe(36);
        expect(font.chars.map((char) => char.id)).toEqual([65, 66]);
        expect(font.chars[1]?.xadvance).toBe(19);
        expect(font.chars[1]?.xoffset).toBe(0);
        expect(font.kernings).toEqual([]);
        expect(font.warnings).toEqual(['1 "char" element(s) have no xadvance; their width is used instead.']);
    });

    it('does not take <chars> or <pages> wrappers for char and page elements', () => {
        const font = parseBmFont(FNT_XML_FULL);

        expect(font.chars.every((char) => char.id > 0)).toBe(true);
        expect(font.pages).toHaveLength(2);
    });

    it('reads the text format and fixes a negative size', () => {
        const font = parseBmFont(FNT_TEXT);

        expect(font.format).toBe('text');
        expect(font.face).toBe('Arial Black');
        expect(font.size).toBe(32);
        expect(font.lineHeight).toBe(37);
        expect(font.base).toBe(29);
        expect(font.pages).toEqual([{ id: 0, file: 'arial_0.png' }]);
        expect(font.chars[1]).toMatchObject({ id: 65, xoffset: -1, yoffset: 5, xadvance: 21 });
        expect(font.kernings).toEqual([{ first: 65, second: 65, amount: -1 }]);
        expect(font.warnings).toHaveLength(1);
        expect(font.warnings[0]).toContain('negative');
    });

    it('accepts a byte order mark and falls back when lineHeight and size are missing', () => {
        const source =
            '\uFEFF<font><info face="X"/><common/><page id="0" file="x.png"/><char id="65" height="40" yoffset="3"/></font>';
        const font = parseBmFont(source);

        expect(font.lineHeight).toBe(43);
        expect(font.size).toBe(43);
        expect(font.warnings).toHaveLength(3);
    });

    it('rejects files that are not BMFont descriptors', () => {
        expect(() => parseBmFont('<svg><rect/></svg>')).toThrow('Not a BMFont descriptor');
        expect(() =>
            parseBmFont('<font><info face="A"/><common lineHeight="1"/><page id="0" file="a.png"/></font>'),
        ).toThrow('no "char"');
        expect(() => parseBmFont('<font><info face="A"/><char id="65"/></font>')).toThrow('no "page"');
    });
});
