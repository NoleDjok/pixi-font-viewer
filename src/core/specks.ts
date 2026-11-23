import { INK_ALPHA_THRESHOLD, SPECK_MAX_AREA_RATIO, SPECK_MIN_PEAK_ALPHA } from './constants';
import type { ISpeck } from './interfaces';

const CHANNELS = 4;
const ALPHA_OFFSET = 3;

interface IPart extends ISpeck {
    peak: number;
}

export function findSpecks(rgba: ArrayLike<number>, width: number, height: number): ISpeck[] {
    const labels = new Int32Array(width * height).fill(-1);
    const stack = new Int32Array(width * height);
    const parts: IPart[] = [];
    const alphaAt = (index: number): number => rgba[index * CHANNELS + ALPHA_OFFSET] ?? 0;

    for (let start = 0; start < width * height; start++) {
        if (labels[start] !== -1 || alphaAt(start) <= INK_ALPHA_THRESHOLD) {
            continue;
        }

        const part: IPart = { x: width, y: height, width: 0, height: 0, pixels: 0, peak: 0 };
        let right = 0;
        let bottom = 0;
        let size = 0;
        stack[size++] = start;
        labels[start] = parts.length;

        while (size > 0) {
            const index = stack[--size] ?? 0;
            const x = index % width;
            const y = (index - x) / width;
            part.pixels++;
            part.peak = Math.max(part.peak, alphaAt(index));
            part.x = Math.min(part.x, x);
            part.y = Math.min(part.y, y);
            right = Math.max(right, x);
            bottom = Math.max(bottom, y);

            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const nx = x + dx;
                    const ny = y + dy;

                    if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
                        continue;
                    }

                    const next = ny * width + nx;

                    if (labels[next] === -1 && alphaAt(next) > INK_ALPHA_THRESHOLD) {
                        labels[next] = parts.length;
                        stack[size++] = next;
                    }
                }
            }
        }

        part.width = right - part.x + 1;
        part.height = bottom - part.y + 1;
        parts.push(part);
    }

    const main = Math.max(0, ...parts.map((part) => part.pixels));

    return parts
        .filter((part) => part.pixels < main * SPECK_MAX_AREA_RATIO && part.peak > SPECK_MIN_PEAK_ALPHA)
        .map(({ x, y, width: partWidth, height: partHeight, pixels }) => ({
            x,
            y,
            width: partWidth,
            height: partHeight,
            pixels,
        }));
}
