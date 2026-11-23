<script setup lang="ts">
import { computed, ref } from 'vue';
import { describeChar, formatCodePoint, type IFontDescriptor, type IGlyphDescriptor } from '../core';

const props = defineProps<{ font: IFontDescriptor }>();

const hovered = ref<IGlyphDescriptor | null>(null);

const pages = computed(() =>
    props.font.pages.map((page) => ({
        page,
        glyphs: props.font.glyphs.filter((glyph) => glyph.image?.url === page.url),
    })),
);
</script>

<template>
    <div class="atlas">
        <p class="atlas__info" role="status">
            <template v-if="hovered">
                <strong>{{ hovered.char === null ? hovered.key : describeChar(hovered.char) }}</strong>
                {{ hovered.codePoint === null ? '' : formatCodePoint(hovered.codePoint) }} · x {{ hovered.image?.x }} y
                {{ hovered.image?.y }} w {{ hovered.image?.width }} h {{ hovered.image?.height }} · xoffset
                {{ hovered.xOffset }} yoffset {{ hovered.yOffset }} xadvance {{ hovered.xAdvance }}
            </template>
            <template v-else>Hover a glyph rectangle to see its data.</template>
        </p>
        <figure v-for="item in pages" :key="item.page.id" class="atlas__page">
            <figcaption class="atlas__caption">
                Page {{ item.page.id }} · {{ item.page.label }} · {{ item.page.width }} × {{ item.page.height }}
            </figcaption>
            <div class="atlas__frame checker">
                <img class="atlas__image" :src="item.page.url" :alt="`Atlas page ${item.page.label}`" />
                <svg
                    class="atlas__overlay"
                    :viewBox="`0 0 ${item.page.width} ${item.page.height}`"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                >
                    <rect
                        v-for="glyph in item.glyphs"
                        :key="glyph.key"
                        class="atlas__rect"
                        :class="{ 'atlas__rect--hovered': glyph === hovered }"
                        :x="glyph.image?.x"
                        :y="glyph.image?.y"
                        :width="glyph.image?.width"
                        :height="glyph.image?.height"
                        @pointerenter="hovered = glyph"
                        @pointerleave="hovered = null"
                    />
                </svg>
            </div>
        </figure>
    </div>
</template>
