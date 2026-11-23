import { BaseTexture, BitmapFont, BitmapFontData, Spritesheet, Texture, type ISpritesheetData } from 'pixi.js';
import {
    baseName,
    buildSyntheticFont,
    builderFrameKey,
    checkGlyphs,
    collisionIssues,
    inkBaseline,
    isRecord,
    orderLikeObjectKeys,
    RESOLUTION_TIERS,
    sdkCharForFrameKey,
    stripExtension,
    type FontSource,
    type IAtlasSource,
    type IAtlasVariantSource,
    type IBmFontSource,
    type ICharCollision,
    type IFontDescriptor,
    type IFrameSize,
    type IGlyphCheckInput,
    type IGlyphDescriptor,
    type IGlyphFolderSource,
    type IIssue,
    type ISyntheticFont,
    type IWebFontSource,
} from '../core';
import type { IInputFile } from './file-reader';
import type { FontResources } from './font-registry';
import { downscale, loadImage, measureInk, scaledSize, type IInkResult } from './image-tools';

const BMFONT_TIER = 'source';

interface ILoadedGlyphImage {
    key: string;
    fileName: string;
    url: string;
    image: HTMLImageElement;
}

export async function loadFontSource(
    source: FontSource<IInputFile>,
    id: string,
    resources: FontResources,
    charMap: Readonly<Record<string, string>>,
): Promise<IFontDescriptor> {
    switch (source.kind) {
        case 'glyphs':
            return loadGlyphFolder(source, id, resources, charMap);
        case 'atlas':
            return loadAtlas(source, id, resources);
        case 'bmfont':
            return loadBmFont(source, id, resources);
        case 'web':
            return loadWebFont(source, id, resources);
    }
}

async function loadGlyphFolder(
    source: IGlyphFolderSource<IInputFile>,
    id: string,
    resources: FontResources,
    charMap: Readonly<Record<string, string>>,
): Promise<IFontDescriptor> {
    const files = [...source.images].sort((a, b) => compareText(baseName(a.path), baseName(b.path)));
    const loaded = await Promise.all(
        files.map(async (input): Promise<ILoadedGlyphImage> => {
            const url = resources.createUrl(input.file);
            const fileName = stripExtension(baseName(input.path));

            return { key: builderFrameKey(fileName, charMap), fileName, url, image: await loadImage(url, input.path) };
        }),
    );
    const ordered = orderLikeObjectKeys(loaded);
    const imageByKey = new Map(ordered.map((item) => [item.key, item.image]));
    const namesByTier: Record<string, string> = {};
    let sourceFont: ISyntheticFont | null = null;

    for (const tier of RESOLUTION_TIERS) {
        const font = buildSyntheticFont(ordered.map((item) => tierFrame(item, tier.scale)));
        const textures = font.glyphs.flatMap((glyph) => {
            const image = imageByKey.get(glyph.key);

            return image ? [glyphTexture(image, tier.scale)] : [];
        });
        const name = `${id}@${tier.alias}`;
        resources.addBitmapFont(name, createSyntheticBitmapFont(name, font, textures));
        namesByTier[tier.alias] = name;
        sourceFont = sourceFont ?? font;
    }

    if (!sourceFont) {
        throw new Error('No resolution tiers are configured.');
    }

    const inks = new Map(
        ordered.map((item) => [
            item.key,
            measureInk(item.image, 0, 0, item.image.naturalWidth, item.image.naturalHeight),
        ]),
    );
    const glyphs = ordered.map((item) =>
        syntheticGlyph(item.key, item.fileName, item.image.naturalWidth, item.image.naturalHeight, inks.get(item.key), {
            url: item.url,
            imageWidth: item.image.naturalWidth,
            imageHeight: item.image.naturalHeight,
            x: 0,
            y: 0,
            width: item.image.naturalWidth,
            height: item.image.naturalHeight,
        }),
    );

    return syntheticDescriptor(source.name, id, source.key, 'glyphs', source.dir, sourceFont, namesByTier, glyphs, [
        ...collisionIssues(builderCollisions(loaded), 'builder'),
    ]);
}

async function loadAtlas(
    source: IAtlasSource<IInputFile>,
    id: string,
    resources: FontResources,
): Promise<IFontDescriptor> {
    const namesByTier: Record<string, string> = {};
    let primary: {
        variant: IAtlasVariantSource<IInputFile>;
        image: HTMLImageElement;
        url: string;
        font: ISyntheticFont;
    } | null = null;

    for (const variant of source.variants) {
        const data: unknown = JSON.parse(await variant.json.file.text());

        if (!isSpritesheetData(data)) {
            throw new Error(`"${variant.json.path}" is not a texture atlas.`);
        }

        const url = resources.createUrl(variant.image.file);
        const image = await loadImage(url, variant.image.path);
        const name = `${id}@${variant.tier}`;
        const sheet = new Spritesheet({ texture: new BaseTexture(image), data, cachePrefix: `${name}:` });
        await sheet.parse();

        const frames = Object.keys(sheet.data.frames).flatMap((key): IFrameSize[] => {
            const texture = sheet.textures[key];

            return texture ? [{ key, width: texture.width, height: texture.height }] : [];
        });
        const font = buildSyntheticFont(frames);
        const textures = font.glyphs.flatMap((glyph) => {
            const texture = sheet.textures[glyph.key];

            return texture ? [texture] : [];
        });
        resources.addBitmapFont(name, createSyntheticBitmapFont(name, font, textures));
        namesByTier[variant.tier] = name;
        primary = primary ?? { variant, image, url, font };
    }

    if (!primary) {
        throw new Error('The atlas has no usable resolution.');
    }

    const { variant, image, url, font } = primary;
    const glyphs = variant.atlas.frames.map((frame) => {
        const ink = frame.rotated ? undefined : measureInk(image, frame.x, frame.y, frame.width, frame.height);

        return syntheticGlyph(
            frame.key,
            frame.key,
            frame.width / variant.scale,
            frame.height / variant.scale,
            scaleInk(ink, variant.scale),
            {
                url,
                imageWidth: image.naturalWidth,
                imageHeight: image.naturalHeight,
                x: frame.x,
                y: frame.y,
                width: frame.width,
                height: frame.height,
            },
        );
    });
    const packed = variant.atlas.frames.filter((frame) => frame.trimmed || frame.rotated).map((frame) => frame.key);
    const packingIssues: IIssue[] =
        packed.length === 0
            ? []
            : [
                  {
                      level: 'error',
                      message:
                          'Trimmed or rotated frames: the game ignores trim offsets and rotation for font glyphs, ' +
                          'so these glyphs are drawn shifted or turned. Pack fonts without trimming and rotation.',
                      glyphKeys: packed,
                  },
              ];
    const pages = [
        { id: 0, label: baseName(variant.image.path), url, width: image.naturalWidth, height: image.naturalHeight },
    ];

    return {
        ...syntheticDescriptor(
            source.name,
            id,
            source.key,
            'atlas',
            source.dir,
            font,
            namesByTier,
            glyphs,
            packingIssues,
        ),
        pages,
    };
}

async function loadBmFont(
    source: IBmFontSource<IInputFile>,
    id: string,
    resources: FontResources,
): Promise<IFontDescriptor> {
    const { font } = source;
    const pages = await Promise.all(
        source.pages.map(async (page) => {
            const url = resources.createUrl(page.image.file);

            return { ...page, url, image: await loadImage(url, page.image.path) };
        }),
    );
    const pageById = new Map(pages.map((page) => [page.id, page]));
    const usable = font.chars.filter((char) => pageById.has(char.page));
    const name = `${id}@${BMFONT_TIER}`;
    const data = new BitmapFontData();

    data.info.push({ face: name, size: font.size });
    data.common.push({ lineHeight: font.lineHeight });
    pages.forEach((page) => data.page.push({ id: page.id, file: page.file }));
    usable.forEach((char) => data.char.push({ ...char }));
    font.kernings.forEach((kerning) => data.kerning.push({ ...kerning }));

    if (font.distanceField) {
        data.distanceField.push({ ...font.distanceField });
    }

    const textures = pages.map((page) => new Texture(new BaseTexture(page.image)));
    resources.addBitmapFont(name, new BitmapFont(data, textures, true));

    const issues: IIssue[] = font.warnings.map((message) => ({ level: 'warning', message }));
    const lost = font.chars.length - usable.length;

    if (lost > 0) {
        issues.push({ level: 'error', message: `${lost} glyph(s) point to a page that the descriptor does not list.` });
    }

    const glyphs = usable.map((char): IGlyphDescriptor => {
        const page = pageById.get(char.page);

        return {
            key: String(char.id),
            name: String(char.id),
            char: String.fromCodePoint(char.id),
            codePoint: char.id,
            width: char.width,
            height: char.height,
            xOffset: char.xoffset,
            yOffset: char.yoffset,
            xAdvance: char.xadvance,
            page: char.page,
            image: page
                ? {
                      url: page.url,
                      imageWidth: page.image.naturalWidth,
                      imageHeight: page.image.naturalHeight,
                      x: char.x,
                      y: char.y,
                      width: char.width,
                      height: char.height,
                  }
                : null,
            ink: null,
            empty: char.width === 0 || char.height === 0,
        };
    });

    return {
        id,
        key: source.key,
        name: source.name,
        kind: 'bmfont',
        location: source.descriptor.path,
        render: { type: 'bitmap', namesByTier: { [BMFONT_TIER]: name }, tiers: [BMFONT_TIER] },
        metrics: {
            face: font.face ?? source.name,
            size: font.size,
            lineHeight: font.lineHeight,
            base: font.base,
            inkBaseline: null,
            referenceKey: null,
        },
        glyphs,
        pages: pages.map((page) => ({
            id: page.id,
            label: page.file,
            url: page.url,
            width: page.image.naturalWidth,
            height: page.image.naturalHeight,
        })),
        kernings: font.kernings.map((kerning) => ({ ...kerning })),
        issues,
    };
}

async function loadWebFont(
    source: IWebFontSource<IInputFile>,
    id: string,
    resources: FontResources,
): Promise<IFontDescriptor> {
    const family = `font-viewer-${id}`;
    const face = new FontFace(family, await source.file.file.arrayBuffer());

    try {
        await face.load();
    } catch (_error) {
        throw new Error(`"${source.file.path}" is not a font the browser can load.`);
    }

    resources.addFace(face);

    return {
        id,
        key: source.key,
        name: source.name,
        kind: 'web',
        location: source.file.path,
        render: { type: 'web', family },
        metrics: null,
        glyphs: [],
        pages: [],
        kernings: [],
        issues: [],
    };
}

function syntheticDescriptor(
    name: string,
    id: string,
    key: string,
    kind: 'glyphs' | 'atlas',
    location: string,
    font: ISyntheticFont,
    namesByTier: Record<string, string>,
    glyphs: IGlyphDescriptor[],
    extraIssues: IIssue[],
): IFontDescriptor {
    const checks: IGlyphCheckInput[] = glyphs.map((glyph) => ({
        key: glyph.key,
        char: glyph.char,
        width: glyph.width,
        height: glyph.height,
        ink: glyph.ink,
        empty: glyph.empty,
    }));

    return {
        id,
        key,
        name,
        kind,
        location,
        render: { type: 'bitmap', namesByTier, tiers: Object.keys(namesByTier) },
        metrics: {
            face: name,
            size: font.size,
            lineHeight: font.lineHeight,
            base: null,
            inkBaseline: inkBaseline(checks),
            referenceKey: font.referenceKey,
        },
        glyphs,
        pages: [],
        kernings: [],
        issues: [
            ...extraIssues,
            ...collisionIssues(font.collisions, 'sdk'),
            ...checkGlyphs(checks, font.referenceKey, kind === 'glyphs' ? 'source' : 'atlas'),
        ],
    };
}

function syntheticGlyph(
    key: string,
    name: string,
    width: number,
    height: number,
    ink: IInkResult | undefined,
    image: IGlyphDescriptor['image'],
): IGlyphDescriptor {
    const char = sdkCharForFrameKey(key);

    return {
        key,
        name,
        char,
        codePoint: char === null ? null : char.charCodeAt(0),
        width,
        height,
        xOffset: 0,
        yOffset: 0,
        xAdvance: width,
        page: 0,
        image,
        ink: ink?.ink ?? null,
        empty: ink?.empty ?? false,
    };
}

function createSyntheticBitmapFont(name: string, font: ISyntheticFont, textures: Texture[]): BitmapFont {
    if (font.glyphs.length === 0 || textures.length !== font.glyphs.length) {
        throw new Error('The font has no glyph the game could use.');
    }

    const data = new BitmapFontData();

    font.glyphs.forEach((glyph, index) => {
        data.page.push({ id: index, file: '' });
        data.char.push({
            id: glyph.id,
            page: index,
            x: 0,
            y: 0,
            width: glyph.width,
            height: glyph.height,
            xoffset: 0,
            yoffset: 0,
            xadvance: glyph.width,
        });
    });
    data.common.push({ lineHeight: font.lineHeight });
    data.info.push({ face: name, size: font.size });

    return new BitmapFont(data, textures, true);
}

function tierFrame(item: ILoadedGlyphImage, scale: number): IFrameSize {
    return {
        key: item.key,
        width: scaledSize(item.image.naturalWidth, scale) / scale,
        height: scaledSize(item.image.naturalHeight, scale) / scale,
    };
}

function glyphTexture(image: HTMLImageElement, scale: number): Texture {
    if (scale === 1) {
        return new Texture(new BaseTexture(image));
    }

    return new Texture(new BaseTexture(downscale(image, scale), { resolution: scale }));
}

function scaleInk(result: IInkResult | undefined, scale: number): IInkResult | undefined {
    if (!result?.ink || scale === 1) {
        return result;
    }

    const { left, top, right, bottom, solidBottom } = result.ink;

    return {
        empty: result.empty,
        ink: {
            left: left / scale,
            top: top / scale,
            right: right / scale,
            bottom: bottom / scale,
            solidBottom: solidBottom / scale,
        },
    };
}

function builderCollisions(items: readonly ILoadedGlyphImage[]): ICharCollision[] {
    const byKey = new Map<string, string[]>();

    for (const item of items) {
        byKey.set(item.key, [...(byKey.get(item.key) ?? []), `${item.fileName}`]);
    }

    return [...byKey.entries()]
        .filter(([, names]) => names.length > 1)
        .map(([char, names]) => ({ char, keys: names, usedKey: names[names.length - 1] ?? '' }));
}

function isSpritesheetData(value: unknown): value is ISpritesheetData {
    return isRecord(value) && isRecord(value.frames) && isRecord(value.meta);
}

function compareText(a: string, b: string): number {
    if (a === b) {
        return 0;
    }

    return a < b ? -1 : 1;
}
