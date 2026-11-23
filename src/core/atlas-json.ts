import { ATLAS_FORMAT_SUFFIXES, KNOWN_TIER_SCALES } from './constants';
import { stripExtension } from './paths';

export interface IAtlasFrame {
    key: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotated: boolean;
    trimmed: boolean;
}

export interface IAtlasJson {
    image: string;
    scale: number;
    frames: IAtlasFrame[];
}

export interface IAtlasName {
    name: string;
    tier: string;
}

const TIER_SUFFIX = /^(.+)_(\d{3,4}p)$/;

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseAtlasJson(text: string): IAtlasJson | null {
    let data: unknown;

    try {
        data = JSON.parse(text);
    } catch (_error) {
        return null;
    }

    if (!isRecord(data) || !isRecord(data.frames) || !isRecord(data.meta) || typeof data.meta.image !== 'string') {
        return null;
    }

    const frames = Object.entries(data.frames).flatMap(([key, value]) => {
        const frame = readFrame(key, value);

        return frame ? [frame] : [];
    });

    return { image: data.meta.image, scale: readScale(data.meta.scale), frames };
}

export function atlasNameAndTier(jsonFileName: string, scale: number): IAtlasName {
    let base = stripExtension(jsonFileName);
    const formatSuffix = ATLAS_FORMAT_SUFFIXES.find((suffix) => base.endsWith(suffix));

    if (formatSuffix) {
        base = base.slice(0, -formatSuffix.length);
    }

    const match = TIER_SUFFIX.exec(base);

    if (match?.[1] && match[2]) {
        return { name: match[1], tier: match[2] };
    }

    return { name: base, tier: tierForScale(scale) };
}

export function tierForScale(scale: number): string {
    return KNOWN_TIER_SCALES.find((tier) => tier.scale === scale)?.alias ?? `x${scale}`;
}

function readFrame(key: string, value: unknown): IAtlasFrame | null {
    if (!isRecord(value) || !isRecord(value.frame)) {
        return null;
    }

    const { x, y, w, h } = value.frame;

    if (typeof x !== 'number' || typeof y !== 'number' || typeof w !== 'number' || typeof h !== 'number') {
        return null;
    }

    return { key, x, y, width: w, height: h, rotated: value.rotated === true, trimmed: value.trimmed === true };
}

function readScale(value: unknown): number {
    const scale = typeof value === 'number' ? value : Number.parseFloat(typeof value === 'string' ? value : '1');

    return Number.isFinite(scale) && scale > 0 ? scale : 1;
}
