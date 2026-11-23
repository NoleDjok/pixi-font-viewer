import { findSpecks, INK_ALPHA_THRESHOLD, SOLID_ALPHA_THRESHOLD, type IInkBox, type ISpeck } from '../core';

export interface IInkResult {
    ink: IInkBox | null;
    empty: boolean;
    specks: ISpeck[];
}

export type RgbColor = readonly [number, number, number];

export interface IAlphaPalette {
    faint: RgbColor;
    partial: RgbColor;
    solid: RgbColor;
}

export interface IFrame {
    x: number;
    y: number;
    width: number;
    height: number;
}

const OPAQUE = 255;

export async function loadImage(url: string, label: string): Promise<HTMLImageElement> {
    const image = new Image();
    image.src = url;

    try {
        await image.decode();
    } catch (_error) {
        throw new Error(`"${label}" is not an image the browser can decode.`);
    }

    return image;
}

export function scaledSize(size: number, scale: number): number {
    return Math.max(1, Math.round(size * scale));
}

export function downscale(source: HTMLImageElement, scale: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = scaledSize(source.naturalWidth, scale);
    canvas.height = scaledSize(source.naturalHeight, scale);
    const context = canvas.getContext('2d');

    if (context) {
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.drawImage(source, 0, 0, canvas.width, canvas.height);
    }

    return canvas;
}

export function measureInk(source: CanvasImageSource, x: number, y: number, width: number, height: number): IInkResult {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, width);
    canvas.height = Math.max(1, height);
    const context = canvas.getContext('2d', { willReadFrequently: true });

    if (!context) {
        return { ink: null, empty: false, specks: [] };
    }

    context.drawImage(source, x, y, width, height, 0, 0, width, height);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let minX = canvas.width;
    let minY = canvas.height;
    let maxX = -1;
    let maxY = -1;
    let solidMaxY = -1;

    for (let row = 0; row < canvas.height; row++) {
        for (let column = 0; column < canvas.width; column++) {
            const alpha = data[(row * canvas.width + column) * 4 + 3] ?? 0;

            if (alpha > INK_ALPHA_THRESHOLD) {
                minX = Math.min(minX, column);
                maxX = Math.max(maxX, column);
                minY = Math.min(minY, row);
                maxY = Math.max(maxY, row);
            }

            if (alpha > SOLID_ALPHA_THRESHOLD) {
                solidMaxY = Math.max(solidMaxY, row);
            }
        }
    }

    if (maxX < 0) {
        return { ink: null, empty: true, specks: [] };
    }

    return {
        ink: {
            left: minX,
            top: minY,
            right: canvas.width - 1 - maxX,
            bottom: canvas.height - 1 - maxY,
            solidBottom: canvas.height - 1 - (solidMaxY < 0 ? maxY : solidMaxY),
        },
        empty: false,
        specks: findSpecks(data, canvas.width, canvas.height),
    };
}

export function drawGlyphPixels(
    canvas: HTMLCanvasElement,
    source: CanvasImageSource,
    frame: IFrame,
    palette: IAlphaPalette | null,
): void {
    canvas.width = Math.max(1, frame.width);
    canvas.height = Math.max(1, frame.height);
    const context = canvas.getContext('2d', { willReadFrequently: palette !== null });

    if (!context) {
        return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(source, frame.x, frame.y, frame.width, frame.height, 0, 0, frame.width, frame.height);

    if (!palette) {
        return;
    }

    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const { data } = image;

    for (let offset = 0; offset < data.length; offset += 4) {
        const alpha = data[offset + 3] ?? 0;

        if (alpha === 0) {
            continue;
        }

        const [red, green, blue] =
            alpha <= INK_ALPHA_THRESHOLD ? palette.faint : alpha >= OPAQUE ? palette.solid : palette.partial;
        data[offset] = red;
        data[offset + 1] = green;
        data[offset + 2] = blue;
        data[offset + 3] = OPAQUE;
    }

    context.putImageData(image, 0, 0);
}
