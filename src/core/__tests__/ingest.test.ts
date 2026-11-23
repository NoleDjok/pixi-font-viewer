import { describe, expect, it } from 'vitest';
import { atlasNameAndTier, parseAtlasJson } from '../atlas-json';
import { ingestFiles, type FontSource } from '../ingest';
import { FNT_TEXT, FNT_XML_FULL, PACKER_ATLAS_JSON, TEXTURE_PACKER_ATLAS_720, XML_MINIMAL } from './fixtures';

interface IFakeFile {
    path: string;
    text?: string;
}

function ingest(files: IFakeFile[]): ReturnType<typeof ingestFiles<IFakeFile>> {
    return ingestFiles(files, (file) => file.text);
}

function kinds(sources: readonly FontSource<IFakeFile>[]): string[] {
    return sources.map((source) => `${source.kind}:${source.name}`);
}

describe('ingestFiles', () => {
    it('lists every font of a mixed fonts folder', () => {
        const result = ingest([
            { path: 'fonts/bitmap/numbers/0.png' },
            { path: 'fonts/bitmap/numbers/1.png' },
            { path: 'fonts/bitmap/numbers/dot.png' },
            { path: 'fonts/gold/gold.fnt', text: FNT_XML_FULL },
            { path: 'fonts/gold/gold_0.png' },
            { path: 'fonts/gold/gold_1.png' },
            { path: 'fonts/small/small.xml', text: XML_MINIMAL },
            { path: 'fonts/small/small.png' },
            { path: 'fonts/arial/arial.fnt', text: FNT_TEXT },
            { path: 'fonts/arial/arial_0.png' },
            { path: 'fonts/web/MYRIADPRO-BOLD.OTF' },
            { path: 'fonts/web/Montserrat.woff2' },
            { path: 'fonts/web/Roboto.ttf' },
            { path: 'fonts/.DS_Store' },
        ]);

        expect(kinds(result.sources)).toEqual([
            'bmfont:Arial Black',
            'bmfont:Gold Numbers',
            'web:Montserrat',
            'web:MYRIADPRO-BOLD',
            'glyphs:numbers',
            'web:Roboto',
            'bmfont:Small & Bold',
        ]);
        expect(result.problems).toEqual([]);
    });

    it('matches multi-page BMFont pages by their file names', () => {
        const result = ingest([
            { path: 'gold/gold.fnt', text: FNT_XML_FULL },
            { path: 'gold/GOLD_1.png' },
            { path: 'gold/gold_0.png' },
        ]);
        const source = result.sources[0];

        expect(source?.kind).toBe('bmfont');
        expect(source?.kind === 'bmfont' && source.pages.map((page) => [page.id, page.image.path])).toEqual([
            [0, 'gold/gold_0.png'],
            [1, 'gold/GOLD_1.png'],
        ]);
    });

    it('reports a BMFont whose pages are missing and keeps the other fonts', () => {
        const result = ingest([
            { path: 'a/gold.fnt', text: FNT_XML_FULL },
            { path: 'a/gold_0.png' },
            { path: 'b/0.png' },
        ]);

        expect(kinds(result.sources)).toEqual(['glyphs:b']);
        expect(result.problems).toEqual([
            expect.objectContaining({
                path: 'a/gold.fnt',
                level: 'error',
                message: expect.stringContaining('gold_1.png'),
            }),
        ]);
    });

    it('reports a broken descriptor without dropping the rest', () => {
        const result = ingest([{ path: 'x/broken.fnt', text: 'not a font' }, { path: 'x/Roboto.woff2' }]);

        expect(kinds(result.sources)).toEqual(['web:Roboto']);
        expect(result.problems[0]).toMatchObject({ path: 'x/broken.fnt', level: 'error' });
    });

    it('groups built atlases by name and picks one variant per resolution', () => {
        const result = ingest([
            { path: 'assets/fonts/bitmap/numbers/numbers_1080p.json', text: PACKER_ATLAS_JSON },
            { path: 'assets/fonts/bitmap/numbers/numbers_1080p.png' },
            {
                path: 'assets/fonts/bitmap/numbers/numbers_1080p_webp.json',
                text: PACKER_ATLAS_JSON.replace('.png', '_webp.webp'),
            },
            { path: 'assets/fonts/bitmap/numbers/numbers_1080p_webp.webp' },
            { path: 'assets/fonts/bitmap/numbers/numbers_720p_webp.json', text: TEXTURE_PACKER_ATLAS_720 },
            { path: 'assets/fonts/bitmap/numbers/numbers_720p_webp.webp' },
            { path: 'assets/main_game/ui/ui_1080p.json', text: PACKER_ATLAS_JSON.replace('numbers', 'ui') },
            { path: 'assets/main_game/ui/ui_1080p.png' },
        ]);
        const source = result.sources[0];

        expect(kinds(result.sources)).toEqual(['atlas:numbers']);
        expect(
            source?.kind === 'atlas' &&
                source.variants.map((variant) => [variant.tier, variant.scale, variant.image.path]),
        ).toEqual([
            ['1080p', 1, 'assets/fonts/bitmap/numbers/numbers_1080p.png'],
            ['720p', 0.75, 'assets/fonts/bitmap/numbers/numbers_720p_webp.webp'],
        ]);
        expect(result.problems).toEqual([
            expect.objectContaining({ level: 'info', message: expect.stringContaining('outside') }),
        ]);
    });

    it('reports an atlas whose image was not dropped', () => {
        const result = ingest([{ path: 'numbers_1080p.json', text: PACKER_ATLAS_JSON }]);

        expect(result.sources).toEqual([]);
        expect(result.problems).toEqual([
            expect.objectContaining({ level: 'error', message: expect.stringContaining('numbers_1080p.png') }),
        ]);
    });

    it('turns loose images into one glyph font and lists ignored files', () => {
        const result = ingest([
            { path: '0.png' },
            { path: 'x.png' },
            { path: 'notes.txt' },
            { path: 'data.json', text: '{}' },
        ]);

        expect(kinds(result.sources)).toEqual(['glyphs:dropped files']);
        expect(result.problems.map((problem) => problem.message)).toEqual([
            'Skipped: the JSON is not a texture atlas.',
            'Ignored 1 file(s): .txt (1): not font files.',
        ]);
    });

    it('keeps two fonts with the same name from different folders apart', () => {
        const result = ingest([{ path: 'gameA/fonts/numbers/0.png' }, { path: 'gameB/fonts/numbers/0.png' }]);

        expect(result.sources.map((source) => source.key)).toEqual([
            'glyphs:gameA/fonts/numbers',
            'glyphs:gameB/fonts/numbers',
        ]);
    });
});

describe('atlas JSON', () => {
    it('keeps the frame order of Object.keys', () => {
        expect(parseAtlasJson(PACKER_ATLAS_JSON)?.frames.map((frame) => frame.key)).toEqual(['0', '1', 'k', ',', '.']);
    });

    it('reads a string scale and the trimmed flag', () => {
        const atlas = parseAtlasJson(TEXTURE_PACKER_ATLAS_720);

        expect(atlas?.scale).toBe(0.75);
        expect(atlas?.frames.find((frame) => frame.key === 'dot')?.trimmed).toBe(true);
    });

    it('takes the name and the resolution from the file name', () => {
        expect(atlasNameAndTier('numbers_720p_avif.json', 0.75)).toEqual({ name: 'numbers', tier: '720p' });
        expect(atlasNameAndTier('numbers_white_1080p.json', 1)).toEqual({ name: 'numbers_white', tier: '1080p' });
        expect(atlasNameAndTier('font.json', 0.5)).toEqual({ name: 'font', tier: '540p' });
    });

    it('rejects JSON that is not a hash atlas', () => {
        expect(parseAtlasJson('{"frames": [], "meta": {"image": "a.png"}}')).toBeNull();
        expect(parseAtlasJson('{oops')).toBeNull();
    });
});
