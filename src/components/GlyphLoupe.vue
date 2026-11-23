<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { IGlyphDescriptor } from '../core';
import { drawGlyphPixels, loadImage, type RgbColor } from '../services';
import { LOUPE, LOUPE_FIT, LOUPE_PALETTE } from './components.config';
import { speckStyle } from './speck-style';

type LoupeMode = 'color' | 'alpha';

interface IDragStart {
    x: number;
    y: number;
    left: number;
    top: number;
}

const props = defineProps<{ glyph: IGlyphDescriptor }>();

const canvas = ref<HTMLCanvasElement | null>(null);
const viewport = ref<HTMLElement | null>(null);
const viewportSize = ref({ width: 0, height: 0 });
const mode = ref<LoupeMode>('color');
const zoomChoice = ref<string>(LOUPE_FIT);
const dragStart = ref<IDragStart | null>(null);
let observer: ResizeObserver | null = null;
let drawToken = 0;

const frameSize = computed(() => ({
    width: Math.max(1, props.glyph.image?.width ?? props.glyph.width),
    height: Math.max(1, props.glyph.image?.height ?? props.glyph.height),
}));

const fitZoom = computed(() => {
    const ratio = Math.min(
        viewportSize.value.width / frameSize.value.width,
        viewportSize.value.height / frameSize.value.height,
    );

    if (!Number.isFinite(ratio) || ratio <= 0) {
        return 1;
    }

    return ratio >= 1 ? Math.floor(ratio) : ratio;
});

const zoom = computed(() => (zoomChoice.value === LOUPE_FIT ? fitZoom.value : Number(zoomChoice.value)));

const stageStyle = computed(() => ({
    width: `${frameSize.value.width * zoom.value}px`,
    height: `${frameSize.value.height * zoom.value}px`,
}));

const canPan = computed(
    () =>
        frameSize.value.width * zoom.value > viewportSize.value.width ||
        frameSize.value.height * zoom.value > viewportSize.value.height,
);

const fitLabel = computed(() => `Fit (${Math.round(fitZoom.value * 100)}%)`);

const hint = computed(() =>
    [
        canPan.value ? 'Drag the image to move around.' : '',
        zoom.value < LOUPE.pixelZoom ? `Choose ${LOUPE.pixelZoom}× or more in Zoom to see single pixels.` : '',
    ]
        .filter(Boolean)
        .join(' '),
);

onMounted(() => {
    if (!viewport.value) {
        return;
    }

    observer = new ResizeObserver(() => measureViewport());
    observer.observe(viewport.value);
    measureViewport();
});

onBeforeUnmount(() => observer?.disconnect());

watch(
    () => props.glyph,
    () => {
        zoomChoice.value = LOUPE_FIT;
    },
);

watch([() => props.glyph, mode, canvas], draw, { immediate: true });

function measureViewport(): void {
    if (viewport.value) {
        viewportSize.value = { width: viewport.value.clientWidth, height: viewport.value.clientHeight };
    }
}

async function draw(): Promise<void> {
    const target = canvas.value;
    const frame = props.glyph.image;

    if (!target || !frame) {
        return;
    }

    drawToken++;
    const token = drawToken;
    const source = await loadImage(frame.url, props.glyph.name);

    if (token === drawToken) {
        drawGlyphPixels(target, source, frame, mode.value === 'alpha' ? LOUPE_PALETTE : null);
    }
}

function onPointerDown(event: PointerEvent): void {
    const element = viewport.value;

    if (!element || !canPan.value || event.button !== 0) {
        return;
    }

    dragStart.value = { x: event.clientX, y: event.clientY, left: element.scrollLeft, top: element.scrollTop };
    element.setPointerCapture(event.pointerId);
}

function onPointerMove(event: PointerEvent): void {
    const element = viewport.value;
    const start = dragStart.value;

    if (!element || !start) {
        return;
    }

    element.scrollLeft = start.left - (event.clientX - start.x);
    element.scrollTop = start.top - (event.clientY - start.y);
}

function onPointerUp(event: PointerEvent): void {
    dragStart.value = null;

    if (viewport.value?.hasPointerCapture(event.pointerId)) {
        viewport.value.releasePointerCapture(event.pointerId);
    }
}

function swatchStyle(color: RgbColor): Record<string, string> {
    return { backgroundColor: `rgb(${color.join(', ')})` };
}
</script>

<template>
    <div class="loupe">
        <div class="loupe__toolbar">
            <fieldset class="segmented">
                <legend class="visually-hidden">Loupe view</legend>
                <label class="segmented__item">
                    <input v-model="mode" type="radio" value="color" name="loupe-mode" />
                    <span>Color</span>
                </label>
                <label class="segmented__item">
                    <input v-model="mode" type="radio" value="alpha" name="loupe-mode" data-test="loupe-alpha" />
                    <span>Alpha</span>
                </label>
            </fieldset>
            <label class="field__label" for="loupe-zoom">Zoom</label>
            <select id="loupe-zoom" v-model="zoomChoice" class="field__input loupe__zoom" data-test="loupe-zoom">
                <option :value="LOUPE_FIT">{{ fitLabel }}</option>
                <option v-for="value in LOUPE.zooms" :key="value" :value="String(value)">{{ value }}×</option>
            </select>
        </div>
        <div
            ref="viewport"
            class="loupe__viewport checker"
            :class="{ 'loupe__viewport--pannable': canPan, 'loupe__viewport--dragging': dragStart !== null }"
            tabindex="0"
            aria-label="Zoomed glyph"
            data-test="loupe-viewport"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @pointercancel="onPointerUp"
        >
            <div class="loupe__stage" :style="stageStyle">
                <canvas ref="canvas" class="loupe__canvas" data-test="loupe-canvas"></canvas>
                <span
                    v-for="(speck, index) in glyph.specks"
                    :key="index"
                    class="loupe__speck"
                    :style="speckStyle(speck, glyph.image)"
                ></span>
            </div>
        </div>
        <p v-if="hint" class="loupe__hint">{{ hint }}</p>
        <p v-if="mode === 'alpha'" class="loupe__legend">
            <span><span class="loupe__swatch" :style="swatchStyle(LOUPE_PALETTE.solid)"></span>opaque</span>
            <span><span class="loupe__swatch" :style="swatchStyle(LOUPE_PALETTE.partial)"></span>semi-transparent</span>
            <span><span class="loupe__swatch" :style="swatchStyle(LOUPE_PALETTE.faint)"></span>almost invisible</span>
        </p>
        <p v-if="glyph.specks.length > 0" class="loupe__specks">
            {{ glyph.specks.length }} stray spot(s) circled in red.
        </p>
    </div>
</template>
