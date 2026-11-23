import {
    Application,
    BaseTexture,
    BitmapFont,
    Color,
    Container,
    Graphics,
    MIPMAP_MODES,
    Point,
    SCALE_MODES,
    Text,
    Texture,
    TilingSprite,
} from 'pixi.js';
import { FONT_KIND_LABELS, type IBitmapRenderRef, type IFontDescriptor, type IFontMetrics } from '../core';
import { InspectableBitmapText } from './inspectable-bitmap-text';
import type { IGlyphHit, IPreviewSettings, IRowStats, IScreenRect } from './interfaces';
import {
    ALIGN_ANCHOR,
    DEFAULT_WEB_FONT_SIZE,
    GUIDE_COLORS,
    LABEL_STYLE,
    MAX_RENDER_RESOLUTION,
    PREVIEW_LAYOUT,
    UV_KEY_PRECISION,
} from './renderer.config';

interface IRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface IHitEntry {
    field: Container;
    rect: IRect;
    fontName: string;
    codePoint: number;
}

interface IFieldResult {
    field: Container;
    box: IRect;
    fitScale: number;
    fontSize: number;
}

interface IRowResult {
    font: IFontDescriptor;
    content: Container;
    left: number;
    right: number;
    height: number;
    stats: IRowStats;
}

interface IRenderRequest {
    fonts: readonly IFontDescriptor[];
    settings: IPreviewSettings;
}

export function applyGameTextureDefaults(): void {
    BaseTexture.defaultOptions.scaleMode = SCALE_MODES.LINEAR;
    BaseTexture.defaultOptions.mipmap = MIPMAP_MODES.OFF;
}

export class PreviewRenderer {
    private _app: Application<HTMLCanvasElement>;
    private _background = new Graphics();
    private _checker = new TilingSprite(Texture.EMPTY, 1, 1);
    private _checkerColor = '';
    private _scene = new Container();
    private _highlight = new Graphics();
    private _hits: IHitEntry[] = [];
    private _highlighted: IHitEntry | null = null;
    private _lookups = new Map<string, Map<string, number>>();
    private _last: IRenderRequest | null = null;

    constructor(private _host: HTMLElement) {
        this._app = new Application<HTMLCanvasElement>({
            backgroundAlpha: 0,
            resolution: Math.min(window.devicePixelRatio || 1, MAX_RENDER_RESOLUTION),
            autoDensity: true,
            autoStart: false,
            width: Math.max(1, _host.clientWidth),
            height: Math.max(1, _host.clientHeight),
        });
        this._app.stage.addChild(this._background, this._checker, this._scene, this._highlight);
        _host.appendChild(this._app.view);
    }

    public render(fonts: readonly IFontDescriptor[], settings: IPreviewSettings): IRowStats[] {
        this._last = { fonts, settings };
        this.clearScene();

        const rows = fonts.flatMap((font) => this.buildRow(font, settings));
        const left = Math.min(0, ...rows.map((row) => row.left));
        const right = Math.max(0, ...rows.map((row) => row.right));
        let cursor = PREVIEW_LAYOUT.padding;

        for (const row of rows) {
            const label = new Text(rowLabel(row.font, row.stats), LABEL_STYLE);
            label.position.set(PREVIEW_LAYOUT.padding, cursor);
            row.content.scale.set(settings.zoom);
            row.content.position.set(
                PREVIEW_LAYOUT.padding - left * settings.zoom,
                cursor + PREVIEW_LAYOUT.labelHeight,
            );
            this._scene.addChild(label, row.content);
            cursor += PREVIEW_LAYOUT.labelHeight + row.height * settings.zoom + PREVIEW_LAYOUT.rowGap;
        }

        const width = Math.max(
            this._host.clientWidth,
            Math.ceil((right - left) * settings.zoom + PREVIEW_LAYOUT.padding * 2),
        );
        const height = Math.max(
            this._host.clientHeight,
            Math.ceil(cursor - PREVIEW_LAYOUT.rowGap + PREVIEW_LAYOUT.padding),
        );
        this.paintBackground(width, height, settings);
        this._app.render();

        return rows.map((row) => row.stats);
    }

    public refresh(): void {
        if (this._last) {
            this.render(this._last.fonts, this._last.settings);
        }
    }

    public hitTest(x: number, y: number): IGlyphHit | null {
        const entry = this._hits.find((item) => contains(this.toScreen(item), x, y)) ?? null;

        if (entry !== this._highlighted) {
            this._highlighted = entry;
            this.drawHighlight(entry);
        }

        if (!entry) {
            return null;
        }

        return {
            fontName: entry.fontName,
            char: String.fromCodePoint(entry.codePoint),
            codePoint: entry.codePoint,
            width: entry.rect.width,
            height: entry.rect.height,
            screen: this.toScreen(entry),
        };
    }

    public async exportPng(): Promise<string> {
        this._highlighted = null;
        this.drawHighlight(null);

        return this._app.renderer.extract.base64(this._app.stage, 'image/png');
    }

    public destroy(): void {
        this.clearScene();
        const checker = this._checker.texture;
        this._app.destroy(true, { children: true });

        if (checker !== Texture.EMPTY) {
            checker.destroy(true);
        }
    }

    private clearScene(): void {
        this._hits = [];
        this._highlighted = null;
        this._highlight.clear();
        this._lookups.clear();

        for (const child of this._scene.removeChildren()) {
            child.destroy({ children: true });
        }
    }

    private buildRow(font: IFontDescriptor, settings: IPreviewSettings): IRowResult[] {
        const tier = font.render.type === 'bitmap' ? pickTier(font.render, settings.tier) : null;

        if (font.render.type === 'bitmap' && !BitmapFont.available[fontNameFor(font.render, tier)]) {
            return [];
        }

        const content = new Container();
        const lines = settings.mode === 'lines' ? settings.text.split(/\r\n|\r|\n/) : [settings.text];
        let y = 0;
        let left = 0;
        let right = 0;
        let width = 0;
        let fitScale = 1;
        let fontSize = 0;

        for (const line of lines) {
            const result = this.buildField(font, tier, line, settings);
            result.field.y = y;
            content.addChild(result.field);
            left = Math.min(left, result.box.x * result.fitScale);
            right = Math.max(right, (result.box.x + result.box.width) * result.fitScale);
            width = Math.max(width, result.box.width * result.fitScale);
            fitScale = Math.min(fitScale, result.fitScale);
            fontSize = result.fontSize;
            y += result.box.height * result.fitScale + PREVIEW_LAYOUT.fieldGap;
        }

        const height = Math.max(0, y - PREVIEW_LAYOUT.fieldGap);
        const limits = this.drawWidthLimits(content, settings, height);

        return [
            {
                font,
                content,
                left: Math.min(left, limits.left),
                right: Math.max(right, limits.right),
                height,
                stats: { fontId: font.id, tier, fontSize, width, height, fitScale },
            },
        ];
    }

    private buildField(
        font: IFontDescriptor,
        tier: string | null,
        content: string,
        settings: IPreviewSettings,
    ): IFieldResult {
        const field = new Container();
        const anchorX = ALIGN_ANCHOR[settings.align];
        const under = new Graphics();
        const over = new Graphics();

        if (font.render.type === 'web') {
            const text = new Text(content, {
                fontFamily: font.render.family,
                fontSize: settings.fontSize > 0 ? settings.fontSize : DEFAULT_WEB_FONT_SIZE,
                fill: settings.tint,
                align: settings.align,
                letterSpacing: settings.letterSpacing,
                wordWrap: settings.maxWidth > 0,
                wordWrapWidth: settings.maxWidth,
            });
            text.anchor.set(anchorX, 0);
            field.addChild(under, text, over);
            const box = { x: -anchorX * text.width, y: 0, width: text.width, height: text.height };
            const fitScale = fitScaleFor(box.width, settings.fitWidth);
            field.scale.set(fitScale);
            this.drawBounds(under, box, settings);

            return { field, box, fitScale, fontSize: Number(text.style.fontSize) };
        }

        const fontName = fontNameFor(font.render, tier);
        const text = new InspectableBitmapText(content, {
            fontName,
            fontSize: settings.fontSize > 0 ? settings.fontSize : undefined,
            align: settings.align,
            letterSpacing: settings.letterSpacing,
            maxWidth: settings.maxWidth,
            tint: settings.tint,
        });
        text.anchor.set(anchorX, 0);
        field.addChild(under, text, over);
        const box = { x: -anchorX * text.textWidth, y: 0, width: text.textWidth, height: text.textHeight };
        const fitScale = fitScaleFor(box.width, settings.fitWidth);
        field.scale.set(fitScale);
        this.drawBounds(under, box, settings);

        if (settings.showLines) {
            this.drawLineGuides(under, text, fontName, font.metrics, box, settings.zoom * fitScale);
        }

        this.collectGlyphs(field, over, text, fontName, font.name, settings.showGlyphBoxes);

        return { field, box, fitScale, fontSize: text.fontSize };
    }

    private drawBounds(graphics: Graphics, box: IRect, settings: IPreviewSettings): void {
        if (!settings.showBounds) {
            return;
        }

        graphics.lineStyle({ width: 1, color: GUIDE_COLORS.bounds, alpha: 0.9, native: true });
        graphics.drawRect(box.x, box.y, box.width, box.height);
    }

    private drawLineGuides(
        graphics: Graphics,
        text: InspectableBitmapText,
        fontName: string,
        metrics: IFontMetrics | null,
        box: IRect,
        screenScale: number,
    ): void {
        const font = BitmapFont.available[fontName];

        if (!font || font.size <= 0) {
            return;
        }

        const lineHeight = font.lineHeight * (text.fontSize / font.size);

        if (lineHeight <= 0) {
            return;
        }

        const lines = Math.max(1, Math.round(box.height / lineHeight));
        const overhang = PREVIEW_LAYOUT.guideOverhang / screenScale;
        const fromX = box.x - overhang;
        const toX = box.x + box.width + overhang;

        graphics.lineStyle({ width: 1, color: GUIDE_COLORS.line, alpha: 0.8, native: true });

        for (let line = 0; line <= lines; line++) {
            graphics.moveTo(fromX, line * lineHeight).lineTo(toX, line * lineHeight);
        }

        const baseline = metrics?.base ?? metrics?.inkBaseline ?? null;

        if (baseline === null || !metrics || metrics.size <= 0) {
            return;
        }

        const baselineOffset = baseline * (text.fontSize / metrics.size);
        const dash = PREVIEW_LAYOUT.dashLength / screenScale;
        graphics.lineStyle({ width: 1, color: GUIDE_COLORS.baseline, alpha: 1, native: true });

        for (let line = 0; line < lines; line++) {
            const y = line * lineHeight + baselineOffset;

            for (let x = fromX; x < toX; x += dash * 2) {
                graphics.moveTo(x, y).lineTo(Math.min(x + dash, toX), y);
            }
        }
    }

    private drawWidthLimits(
        content: Container,
        settings: IPreviewSettings,
        height: number,
    ): { left: number; right: number } {
        const limits = [settings.maxWidth, settings.fitWidth].filter((limit) => limit > 0);
        const anchorX = ALIGN_ANCHOR[settings.align];

        if (limits.length === 0 || !settings.showBounds) {
            return { left: 0, right: 0 };
        }

        const graphics = new Graphics();
        graphics.lineStyle({ width: 1, color: GUIDE_COLORS.widthLimit, alpha: 0.9, native: true });

        for (const limit of limits) {
            const left = -anchorX * limit;
            graphics.moveTo(left, 0).lineTo(left, height);
            graphics.moveTo(left + limit, 0).lineTo(left + limit, height);
        }

        content.addChildAt(graphics, 0);
        const widest = Math.max(...limits);

        return { left: -anchorX * widest, right: (1 - anchorX) * widest };
    }

    private collectGlyphs(
        field: Container,
        graphics: Graphics,
        text: InspectableBitmapText,
        fontName: string,
        displayName: string,
        showBoxes: boolean,
    ): void {
        const lookup = this.charLookup(fontName);

        if (showBoxes) {
            graphics.lineStyle({ width: 1, color: GUIDE_COLORS.glyph, alpha: 0.9, native: true });
        }

        for (const quad of text.glyphQuads()) {
            const codePoint = lookup.get(uvKey(quad.baseTextureUid, quad.u, quad.v));

            if (showBoxes) {
                graphics.drawRect(quad.x, quad.y, quad.width, quad.height);
            }

            if (codePoint !== undefined) {
                this._hits.push({ field, rect: quad, fontName: displayName, codePoint });
            }
        }
    }

    private charLookup(fontName: string): Map<string, number> {
        const cached = this._lookups.get(fontName);

        if (cached) {
            return cached;
        }

        const lookup = new Map<string, number>();
        const font = BitmapFont.available[fontName];

        if (font) {
            for (const [code, char] of Object.entries(font.chars)) {
                const uvs = char.texture._uvs;
                lookup.set(uvKey(char.texture.baseTexture.uid, uvs.x0, uvs.y0), Number(code));
            }
        }

        this._lookups.set(fontName, lookup);

        return lookup;
    }

    private paintBackground(width: number, height: number, settings: IPreviewSettings): void {
        this._app.renderer.resize(width, height);
        this._background.clear().beginFill(settings.background).drawRect(0, 0, width, height).endFill();
        this._checker.visible = settings.checkerboard;

        if (settings.checkerboard) {
            this.updateCheckerTexture(settings.background);
            this._checker.width = width;
            this._checker.height = height;
        }
    }

    private updateCheckerTexture(color: string): void {
        if (this._checkerColor === color) {
            return;
        }

        const previous = this._checker.texture;
        this._checker.texture = createCheckerTexture(color);
        this._checkerColor = color;

        if (previous !== Texture.EMPTY) {
            previous.destroy(true);
        }
    }

    private drawHighlight(entry: IHitEntry | null): void {
        this._highlight.clear();

        if (entry) {
            const rect = this.toScreen(entry);
            this._highlight.lineStyle({ width: 2, color: GUIDE_COLORS.highlight, alpha: 1 });
            this._highlight.drawRect(rect.x, rect.y, rect.width, rect.height);
        }

        this._app.render();
    }

    private toScreen(entry: IHitEntry): IScreenRect {
        const topLeft = entry.field.toGlobal(new Point(entry.rect.x, entry.rect.y));
        const bottomRight = entry.field.toGlobal(
            new Point(entry.rect.x + entry.rect.width, entry.rect.y + entry.rect.height),
        );

        return { x: topLeft.x, y: topLeft.y, width: bottomRight.x - topLeft.x, height: bottomRight.y - topLeft.y };
    }
}

function pickTier(render: IBitmapRenderRef, wanted: string): string | null {
    return render.tiers.includes(wanted) ? wanted : (render.tiers[0] ?? null);
}

function fontNameFor(render: IBitmapRenderRef, tier: string | null): string {
    return tier === null ? '' : (render.namesByTier[tier] ?? '');
}

function fitScaleFor(width: number, fitWidth: number): number {
    return fitWidth > 0 && width > fitWidth ? fitWidth / width : 1;
}

function uvKey(baseTextureUid: number, u: number, v: number): string {
    return `${baseTextureUid}|${Math.round(u * UV_KEY_PRECISION)}|${Math.round(v * UV_KEY_PRECISION)}`;
}

function contains(rect: IScreenRect, x: number, y: number): boolean {
    return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

function rowLabel(font: IFontDescriptor, stats: IRowStats): string {
    const parts = [font.name, FONT_KIND_LABELS[font.kind]];

    if (stats.tier) {
        parts.push(stats.tier);
    }

    parts.push(`fontSize ${round(stats.fontSize)}`, `${round(stats.width)} × ${round(stats.height)}`);

    if (stats.fitScale < 1) {
        parts.push(`fit ×${round(stats.fitScale, 3)}`);
    }

    return parts.join('  ·  ');
}

function round(value: number, digits = 1): string {
    return String(Number(value.toFixed(digits)));
}

function createCheckerTexture(color: string): Texture {
    const cell = PREVIEW_LAYOUT.checkerCell;
    const canvas = document.createElement('canvas');
    canvas.width = cell * 2;
    canvas.height = cell * 2;
    const context = canvas.getContext('2d');

    if (context) {
        context.fillStyle = color;
        context.fillRect(0, 0, cell * 2, cell * 2);
        context.fillStyle = lighten(color, PREVIEW_LAYOUT.checkerLighten);
        context.fillRect(0, 0, cell, cell);
        context.fillRect(cell, cell, cell, cell);
    }

    return Texture.from(canvas);
}

function lighten(color: string, amount: number): string {
    const [red = 0, green = 0, blue = 0] = new Color(color).toRgbArray();
    const step = amount / 255;

    return new Color([Math.min(1, red + step), Math.min(1, green + step), Math.min(1, blue + step)]).toHex();
}
