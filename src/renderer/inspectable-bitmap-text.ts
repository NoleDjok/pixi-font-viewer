import { BitmapText } from 'pixi.js';

export interface IGlyphQuad {
    x: number;
    y: number;
    width: number;
    height: number;
    baseTextureUid: number;
    u: number;
    v: number;
}

const FLOATS_PER_QUAD = 8;

export class InspectableBitmapText extends BitmapText {
    public glyphQuads(): IGlyphQuad[] {
        this.validate();

        return this._activePagesMeshData.flatMap((page) => {
            const { vertices, uvs, total, mesh } = page;

            if (!vertices || !uvs) {
                return [];
            }

            const quads: IGlyphQuad[] = [];
            const baseTextureUid = mesh.texture.baseTexture.uid;

            for (let index = 0; index < total; index++) {
                const offset = index * FLOATS_PER_QUAD;
                const left = vertices[offset] ?? 0;
                const top = vertices[offset + 1] ?? 0;
                const right = vertices[offset + 4] ?? 0;
                const bottom = vertices[offset + 5] ?? 0;

                quads.push({
                    x: left,
                    y: top,
                    width: right - left,
                    height: bottom - top,
                    baseTextureUid,
                    u: uvs[offset] ?? 0,
                    v: uvs[offset + 1] ?? 0,
                });
            }

            return quads;
        });
    }
}
