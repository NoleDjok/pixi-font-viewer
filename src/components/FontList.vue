<script setup lang="ts">
import { FONT_KIND_LABELS, type IFontDescriptor } from '../core';
import { removeFont, selectFont, viewer } from '../store';

function issueCount(font: IFontDescriptor, level: 'error' | 'warning'): number {
    return font.issues.filter((issue) => issue.level === level).length;
}

function glyphSummary(font: IFontDescriptor): string {
    return font.kind === 'web' ? 'vector' : `${font.glyphs.length} glyphs`;
}
</script>

<template>
    <section class="section">
        <h2 class="section__title">
            Fonts <span class="section__count">{{ viewer.fonts.length }}</span>
        </h2>
        <p v-if="viewer.loading" class="muted" role="status">Loading…</p>
        <div v-if="viewer.fonts.length === 0 && !viewer.loading" class="font-list__empty">
            <p>Drop a font folder anywhere on the page or use “Open folder…”.</p>
            <ul class="font-list__formats">
                <li>Folder of glyph PNGs (<code>public/raw/fonts/bitmap/numbers</code>)</li>
                <li>Built atlas <code>numbers_1080p.json</code> + image</li>
                <li>BMFont <code>.fnt</code> / <code>.xml</code> + page PNGs</li>
                <li>Web fonts <code>.ttf .otf .woff .woff2</code></li>
            </ul>
        </div>
        <ul class="font-list">
            <li
                v-for="font in viewer.fonts"
                :key="font.id"
                class="font-item"
                :class="{ 'font-item--active': font.id === viewer.selectedId }"
            >
                <button
                    type="button"
                    class="font-item__select"
                    :aria-pressed="font.id === viewer.selectedId"
                    :title="font.location"
                    @click="selectFont(font.id)"
                >
                    <span class="font-item__name">{{ font.name }}</span>
                    <span class="font-item__meta">{{ FONT_KIND_LABELS[font.kind] }} · {{ glyphSummary(font) }}</span>
                    <span class="font-item__location">{{ font.location || '—' }}</span>
                    <span class="font-item__badges">
                        <span v-if="issueCount(font, 'error')" class="badge badge--error">
                            {{ issueCount(font, 'error') }} error(s)
                        </span>
                        <span v-if="issueCount(font, 'warning')" class="badge badge--warning">
                            {{ issueCount(font, 'warning') }} warning(s)
                        </span>
                    </span>
                </button>
                <button
                    type="button"
                    class="icon-button"
                    :aria-label="`Remove ${font.name}`"
                    @click="removeFont(font.id)"
                >
                    ×
                </button>
            </li>
        </ul>
    </section>
</template>
