<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { describeChar, formatCodePoint } from '../core';
import { PREVIEW_LAYOUT, PreviewRenderer, type IGlyphHit, type IRowStats } from '../renderer';
import { previewFonts, SETTING_LIMITS, viewer } from '../store';

const host = ref<HTMLElement | null>(null);
const hit = ref<IGlyphHit | null>(null);
const pointer = ref({ x: 0, y: 0 });
const stats = ref<IRowStats[]>([]);
let renderer: PreviewRenderer | null = null;
let observer: ResizeObserver | null = null;

onMounted(() => {
    if (!host.value) {
        return;
    }

    renderer = new PreviewRenderer(host.value);
    observer = new ResizeObserver(() => renderer?.refresh());
    observer.observe(host.value);
    draw();
});

onBeforeUnmount(() => {
    observer?.disconnect();
    renderer?.destroy();
    renderer = null;
});

watch([previewFonts, () => ({ ...viewer.settings })], draw);

function draw(): void {
    hit.value = null;
    stats.value = renderer?.render(previewFonts.value, { ...viewer.settings }) ?? [];
}

function fitZoom(): void {
    const width = Math.max(0, ...stats.value.map((row) => row.width));
    const available = (host.value?.clientWidth ?? 0) - PREVIEW_LAYOUT.padding * 2;

    if (width <= 0 || available <= 0) {
        return;
    }

    const { min, max } = SETTING_LIMITS.zoom;
    viewer.settings.zoom = Math.min(max, Math.max(min, Math.floor((available / width) * 100) / 100));
}

function onPointerMove(event: PointerEvent): void {
    const canvas = host.value?.querySelector('canvas');

    if (!renderer || !canvas) {
        return;
    }

    const bounds = canvas.getBoundingClientRect();
    hit.value = renderer.hitTest(event.clientX - bounds.left, event.clientY - bounds.top);
    pointer.value = { x: event.clientX, y: event.clientY };
}

function onPointerLeave(): void {
    hit.value = renderer?.hitTest(-1, -1) ?? null;
}

defineExpose({
    exportPng: async (): Promise<string | null> => (renderer ? renderer.exportPng() : null),
});
</script>

<template>
    <section class="preview" aria-label="Preview">
        <div
            ref="host"
            class="preview__canvas"
            data-test="preview"
            @pointermove="onPointerMove"
            @pointerleave="onPointerLeave"
        ></div>
        <button v-if="previewFonts.length > 0" type="button" class="button button--small preview__fit" @click="fitZoom">
            Fit width
        </button>
        <div v-if="previewFonts.length === 0" class="preview__empty">
            <p class="preview__empty-title">No font yet</p>
            <p>Drop a folder of glyph PNGs, a built font atlas, a BMFont or a web font here.</p>
        </div>
        <div
            v-if="hit"
            class="tooltip"
            role="status"
            :style="{ left: `${pointer.x + 14}px`, top: `${pointer.y + 14}px` }"
        >
            <strong class="tooltip__char">{{ describeChar(hit.char) }}</strong>
            <span>{{ formatCodePoint(hit.codePoint) }}</span>
            <span>{{ Math.round(hit.width * 10) / 10 }} × {{ Math.round(hit.height * 10) / 10 }} in text units</span>
            <span class="muted">{{ hit.fontName }}</span>
        </div>
    </section>
</template>
