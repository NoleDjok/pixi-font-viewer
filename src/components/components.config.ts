import type { IAlphaPalette } from '../services';

export const GLYPH_GRID = {
    defaultThumbHeight: 72,
    minThumbHeight: 24,
    maxThumbHeight: 240,
    step: 8,
};

export const MAX_KERNING_ROWS = 300;

export const LOUPE = {
    zooms: [1, 2, 4, 8, 16],
    pixelZoom: 2,
};

export const LOUPE_FIT = 'fit';

export const LOUPE_PALETTE: IAlphaPalette = {
    faint: [79, 195, 247],
    partial: [255, 79, 216],
    solid: [220, 220, 220],
};

export const LEVEL_LABELS = {
    error: 'Must fix',
    warning: 'Check',
    info: 'Note',
};

export const LEVEL_ORDER = {
    error: 0,
    warning: 1,
    info: 2,
};
