export interface IBmFontChar {
    id: number;
    x: number;
    y: number;
    width: number;
    height: number;
    xoffset: number;
    yoffset: number;
    xadvance: number;
    page: number;
}

export interface IBmFontKerning {
    first: number;
    second: number;
    amount: number;
}

export interface IBmFontPage {
    id: number;
    file: string;
}

export interface IBmFontDistanceField {
    fieldType: string;
    distanceRange: number;
}

export interface IBmFont {
    format: 'xml' | 'text';
    face: string | null;
    size: number;
    lineHeight: number;
    base: number | null;
    scaleW: number | null;
    scaleH: number | null;
    pages: IBmFontPage[];
    chars: IBmFontChar[];
    kernings: IBmFontKerning[];
    distanceField: IBmFontDistanceField | null;
    warnings: string[];
}

type Attributes = ReadonlyMap<string, string>;

interface ITag {
    name: string;
    attributes: Attributes;
}

const XML_TAG = /<\s*(info|common|page|char|kerning|distanceField)\b([^>]*?)\/?>/g;
const TEXT_LINE = /^[ \t]*(info|common|page|char|kerning|distanceField)\b(.*)$/gm;
const ATTRIBUTE = /([A-Za-z_][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
const XML_ENTITIES: Readonly<Record<string, string>> = { quot: '"', apos: "'", lt: '<', gt: '>', amp: '&' };

export function parseBmFont(source: string): IBmFont {
    const clean = source.replace(/^\uFEFF/, '');
    const format = clean.trimStart().startsWith('<') ? 'xml' : 'text';
    const tags = format === 'xml' ? readXmlTags(clean) : readTextTags(clean);
    const info = tags.find((tag) => tag.name === 'info')?.attributes;
    const common = tags.find((tag) => tag.name === 'common')?.attributes;

    if (!info && !common) {
        throw new Error('Not a BMFont descriptor: there is no "info" or "common" element.');
    }

    const warnings: string[] = [];
    const chars = readChars(tags, warnings);

    if (chars.length === 0) {
        throw new Error('The descriptor has no "char" elements.');
    }

    const pages = readPages(tags);

    if (pages.length === 0) {
        throw new Error('The descriptor lists no "page" files.');
    }

    const lineHeight = readLineHeight(common, chars, warnings);

    return {
        format,
        face: readFace(info, warnings),
        size: readSize(info, lineHeight, warnings),
        lineHeight,
        base: readInt(common, 'base'),
        scaleW: readInt(common, 'scaleW'),
        scaleH: readInt(common, 'scaleH'),
        pages,
        chars,
        kernings: readKernings(tags),
        distanceField: readDistanceField(tags),
        warnings,
    };
}

function readXmlTags(source: string): ITag[] {
    return [...source.matchAll(XML_TAG)].map((match) => ({
        name: match[1] ?? '',
        attributes: readAttributes(match[2] ?? '', true),
    }));
}

function readTextTags(source: string): ITag[] {
    return [...source.matchAll(TEXT_LINE)].map((match) => ({
        name: match[1] ?? '',
        attributes: readAttributes(match[2] ?? '', false),
    }));
}

function readAttributes(source: string, decodeEntities: boolean): Attributes {
    const attributes = new Map<string, string>();

    for (const match of source.matchAll(ATTRIBUTE)) {
        const value = match[2] ?? match[3] ?? match[4] ?? '';
        attributes.set(match[1] ?? '', decodeEntities ? decodeXmlEntities(value) : value);
    }

    return attributes;
}

function decodeXmlEntities(value: string): string {
    return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity: string, body: string) => {
        if (body.startsWith('#x') || body.startsWith('#X')) {
            return String.fromCodePoint(Number.parseInt(body.slice(2), 16));
        }

        if (body.startsWith('#')) {
            return String.fromCodePoint(Number.parseInt(body.slice(1), 10));
        }

        return XML_ENTITIES[body.toLowerCase()] ?? entity;
    });
}

function readInt(attributes: Attributes | undefined, name: string): number | null {
    const raw = attributes?.get(name);

    if (raw === undefined) {
        return null;
    }

    const value = Number.parseInt(raw, 10);

    return Number.isFinite(value) ? value : null;
}

function readChars(tags: readonly ITag[], warnings: string[]): IBmFontChar[] {
    const chars: IBmFontChar[] = [];
    let withoutId = 0;
    let withoutAdvance = 0;

    for (const tag of tags) {
        if (tag.name !== 'char') {
            continue;
        }

        const id = readInt(tag.attributes, 'id');

        if (id === null) {
            withoutId++;
            continue;
        }

        const width = readInt(tag.attributes, 'width') ?? 0;
        const xadvance = readInt(tag.attributes, 'xadvance');

        if (xadvance === null) {
            withoutAdvance++;
        }

        chars.push({
            id,
            x: readInt(tag.attributes, 'x') ?? 0,
            y: readInt(tag.attributes, 'y') ?? 0,
            width,
            height: readInt(tag.attributes, 'height') ?? 0,
            xoffset: readInt(tag.attributes, 'xoffset') ?? 0,
            yoffset: readInt(tag.attributes, 'yoffset') ?? 0,
            xadvance: xadvance ?? width,
            page: readInt(tag.attributes, 'page') ?? 0,
        });
    }

    if (withoutId > 0) {
        warnings.push(`${withoutId} "char" element(s) have no id and were skipped.`);
    }

    if (withoutAdvance > 0) {
        warnings.push(`${withoutAdvance} "char" element(s) have no xadvance; their width is used instead.`);
    }

    return chars;
}

function readPages(tags: readonly ITag[]): IBmFontPage[] {
    return tags
        .filter((tag) => tag.name === 'page')
        .map((tag, index) => ({
            id: readInt(tag.attributes, 'id') ?? index,
            file: tag.attributes.get('file') ?? '',
        }))
        .filter((page) => page.file !== '');
}

function readLineHeight(common: Attributes | undefined, chars: readonly IBmFontChar[], warnings: string[]): number {
    const lineHeight = readInt(common, 'lineHeight');

    if (lineHeight !== null && lineHeight > 0) {
        return lineHeight;
    }

    const fallback = Math.max(...chars.map((char) => char.yoffset + char.height));
    warnings.push(`"lineHeight" is missing; the tallest glyph (${fallback}) is used instead.`);

    return fallback;
}

function readSize(info: Attributes | undefined, lineHeight: number, warnings: string[]): number {
    const size = readInt(info, 'size');

    if (size === null || size === 0) {
        warnings.push(`"size" is missing; the line height (${lineHeight}) is used instead.`);

        return lineHeight;
    }

    if (size < 0) {
        warnings.push(`"size" is negative (${size}); Pixi would mirror the text, so ${-size} is used.`);

        return -size;
    }

    return size;
}

function readFace(info: Attributes | undefined, warnings: string[]): string | null {
    const face = info?.get('face')?.trim();

    if (!face) {
        warnings.push('"face" is missing; the file name is used as the font name.');

        return null;
    }

    return face;
}

function readKernings(tags: readonly ITag[]): IBmFontKerning[] {
    return tags
        .filter((tag) => tag.name === 'kerning')
        .flatMap((tag) => {
            const first = readInt(tag.attributes, 'first');
            const second = readInt(tag.attributes, 'second');
            const amount = readInt(tag.attributes, 'amount');

            return first === null || second === null || amount === null ? [] : [{ first, second, amount }];
        });
}

function readDistanceField(tags: readonly ITag[]): IBmFontDistanceField | null {
    const tag = tags.find((item) => item.name === 'distanceField');
    const fieldType = tag?.attributes.get('fieldType');

    if (!tag || !fieldType) {
        return null;
    }

    return { fieldType, distanceRange: readInt(tag.attributes, 'distanceRange') ?? 0 };
}
