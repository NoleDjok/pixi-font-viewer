import { TEXT_PRESETS } from '../core';
import type { IPreviewSettings } from '../renderer';

export const SETTINGS_STORAGE_KEY = 'font-viewer:settings:v1';

export const DEFAULT_SETTINGS: IPreviewSettings = {
    text: TEXT_PRESETS[0]?.text ?? '0123456789',
    mode: 'single',
    fontSize: 0,
    align: 'center',
    letterSpacing: 0,
    maxWidth: 0,
    fitWidth: 0,
    tint: '#ffffff',
    tier: '1080p',
    zoom: 0.5,
    background: '#2d2d2d',
    checkerboard: false,
    showBounds: true,
    showLines: true,
    showGlyphBoxes: false,
};

export const SETTING_LIMITS = {
    fontSize: { min: 0, max: 2000, step: 1 },
    letterSpacing: { min: -500, max: 500, step: 1 },
    maxWidth: { min: 0, max: 20000, step: 10 },
    fitWidth: { min: 0, max: 20000, step: 10 },
    zoom: { min: 0.05, max: 4, step: 0.05 },
};

export const ZOOM_PRESETS: readonly number[] = [0.25, 0.5, 1, 2];
