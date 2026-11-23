import { BitmapFont } from 'pixi.js';

export interface IRegistrySnapshot {
    fonts: string[];
    bitmapFonts: string[];
    fontFaces: number;
    objectUrls: number;
}

export class FontResources {
    private _bitmapNames: string[] = [];
    private _faces: FontFace[] = [];
    private _urls: string[] = [];

    public get urlCount(): number {
        return this._urls.length;
    }

    public createUrl(blob: Blob): string {
        const url = URL.createObjectURL(blob);
        this._urls.push(url);

        return url;
    }

    public addBitmapFont(name: string, font: BitmapFont): void {
        BitmapFont.available[name] = font;
        this._bitmapNames.push(name);
    }

    public addFace(face: FontFace): void {
        document.fonts.add(face);
        this._faces.push(face);
    }

    public dispose(): void {
        for (const name of this._bitmapNames) {
            if (BitmapFont.available[name]) {
                BitmapFont.uninstall(name);
            }
        }

        this._faces.forEach((face) => document.fonts.delete(face));
        this._urls.forEach((url) => URL.revokeObjectURL(url));
        this._bitmapNames = [];
        this._faces = [];
        this._urls = [];
    }
}

export class FontRegistry {
    private _resources = new Map<string, FontResources>();
    private _counter = 0;

    public nextId(): string {
        this._counter++;

        return `f${this._counter}`;
    }

    public add(id: string, resources: FontResources): void {
        this._resources.set(id, resources);
    }

    public dispose(id: string): void {
        this._resources.get(id)?.dispose();
        this._resources.delete(id);
    }

    public snapshot(): IRegistrySnapshot {
        return {
            fonts: [...this._resources.keys()],
            bitmapFonts: Object.keys(BitmapFont.available),
            fontFaces: document.fonts.size,
            objectUrls: [...this._resources.values()].reduce((sum, resources) => sum + resources.urlCount, 0),
        };
    }
}
