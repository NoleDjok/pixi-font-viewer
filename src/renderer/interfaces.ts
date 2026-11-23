export type TextAlign = 'left' | 'center' | 'right';

export type FieldMode = 'lines' | 'single';

export interface IPreviewSettings {
    text: string;
    mode: FieldMode;
    fontSize: number;
    align: TextAlign;
    letterSpacing: number;
    maxWidth: number;
    fitWidth: number;
    tint: string;
    tier: string;
    zoom: number;
    background: string;
    checkerboard: boolean;
    showBounds: boolean;
    showLines: boolean;
    showGlyphBoxes: boolean;
}

export interface IRowStats {
    fontId: string;
    tier: string | null;
    fontSize: number;
    width: number;
    height: number;
    fitScale: number;
}

export interface IScreenRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface IGlyphHit {
    fontName: string;
    char: string;
    codePoint: number;
    width: number;
    height: number;
    screen: IScreenRect;
}
