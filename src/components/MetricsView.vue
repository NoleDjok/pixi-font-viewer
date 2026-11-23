<script setup lang="ts">
import { computed } from 'vue';
import { describeChar, FONT_KIND_LABELS, type IFontDescriptor } from '../core';
import { MAX_KERNING_ROWS } from './components.config';

const props = defineProps<{ font: IFontDescriptor }>();

const isSynthetic = computed(() => props.font.kind === 'glyphs' || props.font.kind === 'atlas');
const kernings = computed(() => props.font.kernings.slice(0, MAX_KERNING_ROWS));

function round(value: number): number {
    return Math.round(value * 100) / 100;
}

function charOf(codePoint: number): string {
    return describeChar(String.fromCodePoint(codePoint));
}
</script>

<template>
    <div class="metrics">
        <dl class="facts">
            <dt>Kind</dt>
            <dd>{{ FONT_KIND_LABELS[font.kind] }}</dd>
            <dt>Source</dt>
            <dd>{{ font.location || '—' }}</dd>
            <template v-if="font.render.type === 'web'">
                <dt>Rendered with</dt>
                <dd>Pixi <code>Text</code> (canvas), family loaded with <code>FontFace</code></dd>
            </template>
            <template v-if="font.metrics">
                <dt>Font name</dt>
                <dd>{{ font.metrics.face }}</dd>
                <dt>size</dt>
                <dd>{{ round(font.metrics.size) }}</dd>
                <dt>lineHeight</dt>
                <dd>{{ round(font.metrics.lineHeight) }}</dd>
                <dt>base</dt>
                <dd>{{ font.metrics.base ?? '—' }}</dd>
                <template v-if="font.metrics.referenceKey !== null">
                    <dt>Size taken from</dt>
                    <dd>first glyph “{{ font.metrics.referenceKey }}”</dd>
                </template>
                <template v-if="font.metrics.inkBaseline !== null">
                    <dt>Ink baseline</dt>
                    <dd>{{ round(font.metrics.inkBaseline) }} from the top</dd>
                </template>
            </template>
            <template v-if="font.render.type === 'bitmap'">
                <dt>Glyphs</dt>
                <dd>{{ font.glyphs.length }}</dd>
                <dt>Resolutions</dt>
                <dd>{{ font.render.tiers.join(', ') }}</dd>
            </template>
            <template v-if="font.pages.length">
                <dt>Pages</dt>
                <dd>
                    <span v-for="page in font.pages" :key="page.id" class="metrics__page">
                        {{ page.label }} ({{ page.width }} × {{ page.height }})
                    </span>
                </dd>
            </template>
        </dl>
        <p v-if="isSynthetic" class="metrics__note">
            The game builds this font from one frame per glyph: <code>xoffset</code> and <code>yoffset</code> are 0,
            <code>xadvance</code> is the frame width, <code>size</code> and <code>lineHeight</code> are the height of
            the first frame. So the PNG canvas of every glyph is its box in the text: transparent columns become
            spacing, transparent rows move the glyph up or down.
        </p>
        <template v-if="font.kernings.length">
            <h3 class="section__title">Kerning pairs ({{ font.kernings.length }})</h3>
            <table class="kerning">
                <thead>
                    <tr>
                        <th scope="col">First</th>
                        <th scope="col">Second</th>
                        <th scope="col">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="(pair, index) in kernings" :key="index">
                        <td>{{ charOf(pair.first) }}</td>
                        <td>{{ charOf(pair.second) }}</td>
                        <td>{{ pair.amount }}</td>
                    </tr>
                </tbody>
            </table>
        </template>
    </div>
</template>
