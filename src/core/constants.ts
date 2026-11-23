import type { FontKind } from './interfaces';

export const BUILDER_FONT_CHAR_MAP: Readonly<Record<string, string>> = {
    dot: '.',
    comma: ',',
    usd: '$',
    eur: '€',
    space: ' ',
    dash: '-',
    minus: '-',
    plus: '+',
    slash: '/',
};

export const SDK_FONT_CHAR_MAP: Readonly<Record<string, string>> = {
    dot: '.',
    comma: ',',
    usd: '$',
    eur: '€',
    space: ' ',
    dash: '-',
    plus: '+',
};

export interface IResolutionTier {
    alias: string;
    scale: number;
}

export const RESOLUTION_TIERS: readonly IResolutionTier[] = [
    { alias: '1080p', scale: 1 },
    { alias: '720p', scale: 0.75 },
];

export const KNOWN_TIER_SCALES: readonly IResolutionTier[] = [...RESOLUTION_TIERS, { alias: '540p', scale: 0.5 }];

export const IMAGE_EXTENSIONS: readonly string[] = ['png', 'webp', 'avif', 'jpg', 'jpeg'];
export const WEB_FONT_EXTENSIONS: readonly string[] = ['ttf', 'otf', 'woff', 'woff2'];
export const BMFONT_EXTENSIONS: readonly string[] = ['fnt', 'xml'];
export const ATLAS_EXTENSIONS: readonly string[] = ['json'];
export const TEXT_EXTENSIONS: readonly string[] = [...BMFONT_EXTENSIONS, ...ATLAS_EXTENSIONS];

export const FONT_FOLDER_NAMES: readonly string[] = ['fonts', 'webfonts'];
export const HIDDEN_FOLDER_NAMES: readonly string[] = ['__MACOSX'];
export const LOOSE_FILES_FOLDER_LABEL = 'dropped files';

export const ATLAS_FORMAT_SUFFIXES: readonly string[] = ['_avif', '_webp'];
export const ATLAS_IMAGE_PREFERENCE: readonly string[] = ['png', 'jpg', 'jpeg', 'webp', 'avif'];

export const FONT_KIND_LABELS: Readonly<Record<FontKind, string>> = {
    glyphs: 'glyph PNGs',
    atlas: 'built atlas',
    bmfont: 'BMFont',
    web: 'web font',
};

export const INK_ALPHA_THRESHOLD = 8;
export const SOLID_ALPHA_THRESHOLD = 128;
export const SPECK_MAX_AREA_RATIO = 0.005;
export const SPECK_MIN_PEAK_ALPHA = 64;
export const MAX_LISTED_SPECKS = 3;
export const BASELINE_TOLERANCE_RATIO = 0.01;
export const MIN_BASELINE_TOLERANCE_PX = 1;
export const MIN_OVERSHOOT_RATIO = 0.005;
export const MIN_DIGITS_IN_GROUP = 3;
export const FLAT_BOTTOM_DIGITS: readonly string[] = ['1', '2', '4', '7'];
export const ROUND_BOTTOM_DIGITS: readonly string[] = ['0', '3', '5', '6', '8', '9'];
