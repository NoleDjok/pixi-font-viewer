export type IssueLevel = 'error' | 'warning' | 'info';

export interface IIssue {
    level: IssueLevel;
    message: string;
    glyphKeys?: string[];
    details?: string[];
}

export type FontKind = 'glyphs' | 'atlas' | 'bmfont' | 'web';

export interface IInkBox {
    left: number;
    top: number;
    right: number;
    bottom: number;
}

export interface IGlyphImageRef {
    url: string;
    imageWidth: number;
    imageHeight: number;
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface IGlyphDescriptor {
    key: string;
    name: string;
    char: string | null;
    codePoint: number | null;
    width: number;
    height: number;
    xOffset: number;
    yOffset: number;
    xAdvance: number;
    page: number;
    image: IGlyphImageRef | null;
    ink: IInkBox | null;
    empty: boolean;
}

export interface IPageDescriptor {
    id: number;
    label: string;
    url: string;
    width: number;
    height: number;
}

export interface IKerningPair {
    first: number;
    second: number;
    amount: number;
}

export interface IFontMetrics {
    face: string;
    size: number;
    lineHeight: number;
    base: number | null;
    inkBaseline: number | null;
    referenceKey: string | null;
}

export interface IBitmapRenderRef {
    type: 'bitmap';
    namesByTier: Record<string, string>;
    tiers: string[];
}

export interface IWebRenderRef {
    type: 'web';
    family: string;
}

export type FontRenderRef = IBitmapRenderRef | IWebRenderRef;

export interface IFontDescriptor {
    id: string;
    key: string;
    name: string;
    kind: FontKind;
    location: string;
    render: FontRenderRef;
    metrics: IFontMetrics | null;
    glyphs: IGlyphDescriptor[];
    pages: IPageDescriptor[];
    kernings: IKerningPair[];
    issues: IIssue[];
}
