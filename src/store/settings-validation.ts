import { isRecord } from '../core';
import type { IPreviewSettings } from '../renderer';
import { SETTING_LIMITS } from './viewer.config';

const COLOR = /^#[0-9a-f]{6}$/i;

type NumericSetting = keyof typeof SETTING_LIMITS;

export function pickValidSettings(value: unknown): Partial<IPreviewSettings> {
    if (!isRecord(value)) {
        return {};
    }

    const result: Partial<IPreviewSettings> = {};

    if (typeof value.text === 'string') {
        result.text = value.text;
    }

    if (value.mode === 'lines' || value.mode === 'single') {
        result.mode = value.mode;
    }

    if (value.align === 'left' || value.align === 'center' || value.align === 'right') {
        result.align = value.align;
    }

    for (const key of ['fontSize', 'letterSpacing', 'maxWidth', 'fitWidth', 'zoom'] as const) {
        const number = validNumber(key, value[key]);

        if (number !== null) {
            result[key] = number;
        }
    }

    if (typeof value.tint === 'string' && COLOR.test(value.tint)) {
        result.tint = value.tint;
    }

    if (typeof value.background === 'string' && COLOR.test(value.background)) {
        result.background = value.background;
    }

    if (typeof value.tier === 'string') {
        result.tier = value.tier;
    }

    for (const key of ['checkerboard', 'showBounds', 'showLines', 'showGlyphBoxes'] as const) {
        const flag = value[key];

        if (typeof flag === 'boolean') {
            result[key] = flag;
        }
    }

    return result;
}

export function validNumber(key: NumericSetting, value: unknown): number | null {
    const { min, max } = SETTING_LIMITS[key];

    return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : null;
}
