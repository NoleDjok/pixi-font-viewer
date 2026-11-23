import type { IGlyphImageRef, ISpeck } from '../core';

export function speckStyle(speck: ISpeck, frame: IGlyphImageRef | null): Record<string, string> {
    if (!frame || frame.width <= 0 || frame.height <= 0) {
        return {};
    }

    return {
        left: `${(speck.x / frame.width) * 100}%`,
        top: `${(speck.y / frame.height) * 100}%`,
        width: `${(speck.width / frame.width) * 100}%`,
        height: `${(speck.height / frame.height) * 100}%`,
    };
}
