<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { IGlyphDescriptor } from '../core';
import { drawGlyphPixels, loadImage, type RgbColor } from '../services';
import { LOUPE, LOUPE_PALETTE } from './components.config';
import { speckStyle } from './speck-style';

type LoupeMode = 'color' | 'alpha';

const props = defineProps<{ glyph: IGlyphDescriptor }>();

const canvas = ref<HTMLCanvasElement | null>(null);
const mode = ref<LoupeMode>('color');
const zoom = ref(fitZoom(props.glyph));
let drawToken = 0;

const stageStyle = computed(() => ({
    width: `${(props.glyph.image?.width ?? 0) * zoom.value}px`,
    height: `${(props.glyph.image?.height ?? 0) * zoom.value}px`,
}));

watch(
    () => props.glyph,
    (glyph) => {
        zoom.value = fitZoom(glyph);
    },
);

watch([() => props.glyph, mode, canvas], draw, { immediate: true });

function fitZoom(glyph: IGlyphDescriptor): number {
    const height = Math.max(1, glyph.image?.height ?? glyph.height);

    return LOUPE.zooms.filter((value) => value * height <= LOUPE.maxStartHeight).pop() ?? 1;
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
            <select id="loupe-zoom" v-model.number="zoom" class="field__input loupe__zoom">
                <option v-for="value in LOUPE.zooms" :key="value" :value="value">{{ value }}×</option>
            </select>
        </div>
        <div class="loupe__viewport checker">
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
