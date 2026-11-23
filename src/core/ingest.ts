import { atlasNameAndTier, parseAtlasJson, type IAtlasJson } from './atlas-json';
import { parseBmFont, type IBmFont } from './bmfont-parser';
import {
    ATLAS_EXTENSIONS,
    ATLAS_IMAGE_PREFERENCE,
    BMFONT_EXTENSIONS,
    FONT_FOLDER_NAMES,
    IMAGE_EXTENSIONS,
    LOOSE_FILES_FOLDER_LABEL,
    WEB_FONT_EXTENSIONS,
} from './constants';
import type { IssueLevel } from './interfaces';
import { baseName, dirName, extensionOf, isHiddenPath, normalizePath, pathSegments, stripExtension } from './paths';

export interface IIngestFile {
    path: string;
}

interface ISourceBase {
    key: string;
    name: string;
    dir: string;
}

export interface IGlyphFolderSource<T> extends ISourceBase {
    kind: 'glyphs';
    images: T[];
}

export interface IAtlasVariantSource<T> {
    tier: string;
    scale: number;
    json: T;
    atlas: IAtlasJson;
    image: T;
}

export interface IAtlasSource<T> extends ISourceBase {
    kind: 'atlas';
    variants: IAtlasVariantSource<T>[];
}

export interface IBmFontPageSource<T> {
    id: number;
    file: string;
    image: T;
}

export interface IBmFontSource<T> extends ISourceBase {
    kind: 'bmfont';
    descriptor: T;
    font: IBmFont;
    pages: IBmFontPageSource<T>[];
}

export interface IWebFontSource<T> extends ISourceBase {
    kind: 'web';
    file: T;
}

export type FontSource<T> = IGlyphFolderSource<T> | IAtlasSource<T> | IBmFontSource<T> | IWebFontSource<T>;

export interface IIngestProblem {
    path: string;
    level: IssueLevel;
    message: string;
}

export interface IIngestResult<T> {
    sources: FontSource<T>[];
    problems: IIngestProblem[];
}

interface IClaimed<T> {
    images: Set<T>;
    folders: Set<string>;
}

interface IAtlasCandidate<T> {
    dir: string;
    name: string;
    tier: string;
    json: T;
    atlas: IAtlasJson;
    image: T | null;
}

export function ingestFiles<T extends IIngestFile>(
    files: readonly T[],
    readText: (file: T) => string | undefined,
): IIngestResult<T> {
    const problems: IIngestProblem[] = [];
    const visible = files.filter((file) => !isHiddenPath(file.path));
    const inFontFolders = visible.filter((file) => isInFontFolder(file.path));
    const scoped = inFontFolders.length > 0 ? inFontFolders : visible;
    const images = scoped.filter((file) => IMAGE_EXTENSIONS.includes(extensionOf(file.path)));
    const claimed: IClaimed<T> = { images: new Set(), folders: new Set() };

    const sources: FontSource<T>[] = [
        ...collectWebFonts(scoped),
        ...collectBmFonts(scoped, images, claimed, readText, problems),
        ...collectAtlases(scoped, images, claimed, readText, problems),
    ];
    sources.push(
        ...collectGlyphFolders(
            images.filter((image) => !claimed.images.has(image) && !claimed.folders.has(dirName(image.path))),
        ),
    );

    const ignored = scoped.filter((file) => !isKnownExtension(extensionOf(file.path)));
    const outside = visible.length - scoped.length;

    if (ignored.length > 0) {
        problems.push({ path: '', level: 'info', message: `Ignored ${describeExtensions(ignored)}: not font files.` });
    }

    if (outside > 0) {
        problems.push({
            path: '',
            level: 'info',
            message: `Ignored ${outside} file(s) outside "fonts" folders: only fonts folders are read when the drop has any.`,
        });
    }

    sources.sort((a, b) => a.name.localeCompare(b.name) || a.dir.localeCompare(b.dir));

    return { sources, problems };
}

function isInFontFolder(path: string): boolean {
    return pathSegments(dirName(path)).some((segment) => FONT_FOLDER_NAMES.includes(segment.toLowerCase()));
}

function isKnownExtension(extension: string): boolean {
    return [...IMAGE_EXTENSIONS, ...WEB_FONT_EXTENSIONS, ...BMFONT_EXTENSIONS, ...ATLAS_EXTENSIONS].includes(extension);
}

function describeExtensions(files: readonly IIngestFile[]): string {
    const counts = new Map<string, number>();

    for (const file of files) {
        const extension = extensionOf(file.path) || 'no extension';
        counts.set(extension, (counts.get(extension) ?? 0) + 1);
    }

    const parts = [...counts.entries()].map(([extension, count]) => `.${extension} (${count})`);

    return `${files.length} file(s): ${parts.join(', ')}`;
}

function collectWebFonts<T extends IIngestFile>(files: readonly T[]): IWebFontSource<T>[] {
    return files
        .filter((file) => WEB_FONT_EXTENSIONS.includes(extensionOf(file.path)))
        .map((file) => ({
            kind: 'web',
            key: `web:${normalizePath(file.path)}`,
            name: stripExtension(baseName(file.path)),
            dir: dirName(file.path),
            file,
        }));
}

function collectBmFonts<T extends IIngestFile>(
    files: readonly T[],
    images: readonly T[],
    claimed: IClaimed<T>,
    readText: (file: T) => string | undefined,
    problems: IIngestProblem[],
): IBmFontSource<T>[] {
    const sources: IBmFontSource<T>[] = [];

    for (const descriptor of files.filter((file) => BMFONT_EXTENSIONS.includes(extensionOf(file.path)))) {
        const font = parseDescriptor(descriptor, readText, problems);

        if (!font) {
            continue;
        }

        const dir = dirName(descriptor.path);
        claimed.folders.add(dir);
        const pages: IBmFontPageSource<T>[] = [];
        const missing: string[] = [];

        for (const page of font.pages) {
            const image = findImage(images, dir, page.file, true);

            if (image) {
                claimed.images.add(image);
                pages.push({ id: page.id, file: page.file, image });
            } else {
                missing.push(page.file);
            }
        }

        if (missing.length > 0) {
            problems.push({
                path: descriptor.path,
                level: 'error',
                message: `Page image(s) not among the dropped files: ${missing.join(', ')}. Drop the descriptor together with its pages.`,
            });
            continue;
        }

        sources.push({
            kind: 'bmfont',
            key: `bmfont:${normalizePath(descriptor.path)}`,
            name: font.face ?? stripExtension(baseName(descriptor.path)),
            dir,
            descriptor,
            font,
            pages,
        });
    }

    return sources;
}

function parseDescriptor<T extends IIngestFile>(
    descriptor: T,
    readText: (file: T) => string | undefined,
    problems: IIngestProblem[],
): IBmFont | null {
    const text = readText(descriptor);

    if (text === undefined) {
        problems.push({ path: descriptor.path, level: 'error', message: 'The file could not be read.' });

        return null;
    }

    try {
        return parseBmFont(text);
    } catch (error) {
        problems.push({ path: descriptor.path, level: 'error', message: errorMessage(error) });

        return null;
    }
}

function collectAtlases<T extends IIngestFile>(
    files: readonly T[],
    images: readonly T[],
    claimed: IClaimed<T>,
    readText: (file: T) => string | undefined,
    problems: IIngestProblem[],
): IAtlasSource<T>[] {
    const groups = new Map<string, IAtlasCandidate<T>[]>();

    for (const json of files.filter((file) => ATLAS_EXTENSIONS.includes(extensionOf(file.path)))) {
        const text = readText(json);
        const atlas = text === undefined ? null : parseAtlasJson(text);

        if (!atlas) {
            problems.push({ path: json.path, level: 'info', message: 'Skipped: the JSON is not a texture atlas.' });
            continue;
        }

        const dir = dirName(json.path);
        const { name, tier } = atlasNameAndTier(baseName(json.path), atlas.scale);
        const image = findImage(images, dir, atlas.image, false);
        claimed.folders.add(dir);

        if (image) {
            claimed.images.add(image);
        }

        const groupKey = `${dir}/${name}`;
        groups.set(groupKey, [...(groups.get(groupKey) ?? []), { dir, name, tier, json, atlas, image: image ?? null }]);
    }

    return [...groups.values()].flatMap((candidates) => {
        const variants = pickAtlasVariants(candidates, problems);
        const first = candidates[0];

        if (!first || variants.length === 0) {
            return [];
        }

        return [
            {
                kind: 'atlas',
                key: `atlas:${first.dir}/${first.name}`,
                name: first.name,
                dir: first.dir,
                variants,
            },
        ];
    });
}

function pickAtlasVariants<T extends IIngestFile>(
    candidates: readonly IAtlasCandidate<T>[],
    problems: IIngestProblem[],
): IAtlasVariantSource<T>[] {
    const tiers = [...new Set(candidates.map((candidate) => candidate.tier))];
    const variants: IAtlasVariantSource<T>[] = [];

    for (const tier of tiers) {
        const withImage = candidates
            .filter((candidate) => candidate.tier === tier)
            .flatMap((candidate) => (candidate.image ? [{ ...candidate, image: candidate.image }] : []))
            .sort((a, b) => imageRank(a.image.path) - imageRank(b.image.path));
        const best = withImage[0];

        if (!best) {
            const sample = candidates.find((candidate) => candidate.tier === tier);
            problems.push({
                path: sample?.json.path ?? '',
                level: 'error',
                message: `Atlas image "${sample?.atlas.image ?? ''}" is not among the dropped files.`,
            });
            continue;
        }

        variants.push({ tier, scale: best.atlas.scale, json: best.json, atlas: best.atlas, image: best.image });
    }

    return variants.sort((a, b) => b.scale - a.scale);
}

function imageRank(path: string): number {
    const index = ATLAS_IMAGE_PREFERENCE.indexOf(extensionOf(path));

    return index === -1 ? ATLAS_IMAGE_PREFERENCE.length : index;
}

function collectGlyphFolders<T extends IIngestFile>(images: readonly T[]): IGlyphFolderSource<T>[] {
    const byDir = new Map<string, T[]>();

    for (const image of images) {
        const dir = dirName(image.path);
        byDir.set(dir, [...(byDir.get(dir) ?? []), image]);
    }

    return [...byDir.entries()].map(([dir, dirImages]) => ({
        kind: 'glyphs',
        key: `glyphs:${dir}`,
        name: dir === '' ? LOOSE_FILES_FOLDER_LABEL : baseName(dir),
        dir,
        images: dirImages,
    }));
}

function findImage<T extends IIngestFile>(
    images: readonly T[],
    dir: string,
    file: string,
    searchOtherFolders: boolean,
): T | undefined {
    const wanted = baseName(file).toLowerCase();
    const sameName = images.filter((image) => baseName(image.path).toLowerCase() === wanted);
    const sameFolder = sameName.find((image) => dirName(image.path) === dir);

    return sameFolder ?? (searchOtherFolders ? sameName[0] : undefined);
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
