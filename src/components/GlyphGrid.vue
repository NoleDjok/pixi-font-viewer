<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
    describeChar,
    digitBaselineOffsets,
    formatCodePoint,
    solidBottomLine,
    type IFontDescriptor,
    type IGlyphDescriptor,
    type IssueLevel,
} from '../core';
import { appendText } from '../store';
import { GLYPH_GRID, LEVEL_ORDER } from './components.config';
import GlyphLoupe from './GlyphLoupe.vue';
import { speckStyle } from './speck-style';

const props = defineProps<{ font: IFontDescriptor }>();

const thumbHeight = ref(GLYPH_GRID.defaultThumbHeight);
const selectedKey = ref<string | null>(null);

watch(
    () => props.font.id,
    () => {
        selectedKey.value = null;
    },
);

const maxHeight = computed(() => Math.max(1, ...props.font.glyphs.map((glyph) => glyph.image?.height ?? glyph.height)));
const scale = computed(() => thumbHeight.value / maxHeight.value);
const selected = computed(() => props.font.glyphs.find((glyph) => glyph.key === selectedKey.value) ?? null);
const showsBaseline = computed(() => props.font.kind === 'glyphs' || props.font.kind === 'atlas');
const digitOffsets = computed(() => digitBaselineOffsets(props.font.glyphs));

const levelByKey = computed(() => {
    const levels = new Map<string, IssueLevel>();

    for (const issue of props.font.issues) {
        for (const key of issue.glyphKeys ?? []) {
            const current = levels.get(key);

            if (!current || LEVEL_ORDER[issue.level] < LEVEL_ORDER[current]) {
                levels.set(key, issue.level);
            }
        }
    }

    return levels;
});

const selectedNotes = computed(() => {
    const glyph = selected.value;

    if (!glyph) {
        return [];
    }

    return props.font.issues
        .filter((issue) => issue.glyphKeys?.includes(glyph.key))
        .map((issue) => ({
            level: issue.level,
            message: issue.message,
            detail: issue.details?.find((line) => line.startsWith(`${glyph.key}:`)) ?? null,
            fix: issue.fix ?? null,
        }));
});

function thumbStyle(glyph: IGlyphDescriptor): Record<string, string> {
    const image = glyph.image;
    const width = (image?.width ?? glyph.width) * scale.value;
    const height = (image?.height ?? glyph.height) * scale.value;

    return { width: `${Math.max(1, width)}px`, height: `${Math.max(1, height)}px` };
}

function spriteStyle(glyph: IGlyphDescriptor): Record<string, string> {
    const image = glyph.image;

    if (!image) {
        return {};
    }

    return {
        backgroundImage: `url("${image.url}")`,
        backgroundSize: `${image.imageWidth * scale.value}px ${image.imageHeight * scale.value}px`,
        backgroundPosition: `${-image.x * scale.value}px ${-image.y * scale.value}px`,
    };
}

function inkStyle(glyph: IGlyphDescriptor): Record<string, string> | null {
    const ink = glyph.ink;

    if (!ink || glyph.width <= 0 || glyph.height <= 0) {
        return null;
    }

    return {
        left: `${(ink.left / glyph.width) * 100}%`,
        right: `${(ink.right / glyph.width) * 100}%`,
        top: `${(ink.top / glyph.height) * 100}%`,
        bottom: `${(ink.bottom / glyph.height) * 100}%`,
    };
}

function baselineStyle(glyph: IGlyphDescriptor): Record<string, string> | null {
    const baseline = props.font.metrics?.inkBaseline ?? null;

    if (!showsBaseline.value || baseline === null || glyph.height <= 0) {
        return null;
    }

    return { top: `${(baseline / glyph.height) * 100}%` };
}

function offsetLabel(offset: number): string {
    const amount = round(Math.abs(offset));

    if (amount === 0) {
        return 'on line';
    }

    return `${offset > 0 ? '↓' : '↑'}${amount}px`;
}

function offsetPhrase(offset: number): string {
    const amount = round(Math.abs(offset));

    return amount === 0
        ? 'on the line of 1 2 4 7'
        : `${amount}px ${offset > 0 ? 'below' : 'above'} the line of 1 2 4 7`;
}

function bottomEdgeText(glyph: IGlyphDescriptor): string {
    const line = `${round(solidBottomLine(glyph) ?? 0)}px from the top`;
    const offset = digitOffsets.value.get(glyph.key);

    return offset === undefined ? line : `${line}, ${offsetPhrase(offset)}`;
}

function round(value: number): number {
    return Math.round(value * 100) / 100;
}

function cardLabel(glyph: IGlyphDescriptor): string {
    return glyph.char === null ? `${glyph.name}: no character` : `${describeChar(glyph.char)}, ${glyph.name}`;
}
</script>

<template>
    <div class="glyphs">
        <div class="glyphs__toolbar">
            <label class="field__label" for="thumb-height">Thumbnail height {{ thumbHeight }}px</label>
            <input
                id="thumb-height"
                v-model.number="thumbHeight"
                class="range"
                type="range"
                :min="GLYPH_GRID.minThumbHeight"
                :max="GLYPH_GRID.maxThumbHeight"
                :step="GLYPH_GRID.step"
            />
            <p class="muted glyphs__legend">
                <span class="swatch swatch--ink"></span> ink bounds
                <template v-if="showsBaseline"
                    ><span class="swatch swatch--baseline"></span> common digit baseline</template
                >
            </p>
        </div>
        <div class="glyphs__body">
            <ul class="glyph-grid" aria-label="Glyphs">
                <li v-for="glyph in font.glyphs" :key="glyph.key">
                    <button
                        type="button"
                        class="glyph-card"
                        :class="[
                            levelByKey.get(glyph.key) ? `glyph-card--${levelByKey.get(glyph.key)}` : '',
                            { 'glyph-card--selected': glyph.key === selectedKey },
                        ]"
                        :aria-pressed="glyph.key === selectedKey"
                        :aria-label="cardLabel(glyph)"
                        @click="selectedKey = glyph.key"
                    >
                        <span class="glyph-card__thumb checker" :style="thumbStyle(glyph)">
                            <span class="glyph-card__sprite" :style="spriteStyle(glyph)"></span>
                            <span v-if="inkStyle(glyph)" class="glyph-card__ink" :style="inkStyle(glyph) ?? {}"></span>
                            <span
                                v-for="(speck, index) in glyph.specks"
                                :key="`speck-${index}`"
                                class="glyph-card__speck"
                                :style="speckStyle(speck, glyph.image)"
                            ></span>
                            <span
                                v-if="baselineStyle(glyph)"
                                class="glyph-card__baseline"
                                :style="baselineStyle(glyph) ?? {}"
                            ></span>
                        </span>
                        <span class="glyph-card__char">{{ glyph.char === null ? '?' : describeChar(glyph.char) }}</span>
                        <span class="glyph-card__meta">{{ glyph.name }}</span>
                        <span class="glyph-card__meta">{{ round(glyph.width) }}×{{ round(glyph.height) }}</span>
                        <span
                            v-if="digitOffsets.has(glyph.key)"
                            class="glyph-card__offset"
                            :title="`Bottom edge ${offsetPhrase(digitOffsets.get(glyph.key) ?? 0)}`"
                        >
                            {{ offsetLabel(digitOffsets.get(glyph.key) ?? 0) }}
                        </span>
                    </button>
                </li>
            </ul>
            <aside v-if="selected" class="glyph-detail" aria-live="polite">
                <h3 class="glyph-detail__title">
                    {{ selected.char === null ? selected.name : describeChar(selected.char) }}
                </h3>
                <GlyphLoupe v-if="selected.image" :glyph="selected" />
                <dl class="facts">
                    <dt>Character</dt>
                    <dd>{{ selected.char === null ? 'none' : formatCodePoint(selected.codePoint ?? 0) }}</dd>
                    <dt>Name</dt>
                    <dd>{{ selected.name }}</dd>
                    <dt>Size</dt>
                    <dd>{{ round(selected.width) }} × {{ round(selected.height) }}</dd>
                    <dt>xadvance</dt>
                    <dd>{{ round(selected.xAdvance) }}</dd>
                    <template v-if="solidBottomLine(selected) !== null">
                        <dt>Bottom edge</dt>
                        <dd>{{ bottomEdgeText(selected) }}</dd>
                    </template>
                    <dt>Offset</dt>
                    <dd>x {{ selected.xOffset }}, y {{ selected.yOffset }}</dd>
                    <template v-if="selected.ink">
                        <dt>Transparent margin</dt>
                        <dd>
                            left {{ round(selected.ink.left) }}, right {{ round(selected.ink.right) }}, top
                            {{ round(selected.ink.top) }}, bottom {{ round(selected.ink.bottom) }}
                        </dd>
                    </template>
                    <template v-if="selected.image && font.kind !== 'glyphs'">
                        <dt>In atlas</dt>
                        <dd>x {{ selected.image.x }}, y {{ selected.image.y }}</dd>
                    </template>
                </dl>
                <ul v-if="selectedNotes.length" class="notes">
                    <li
                        v-for="(note, index) in selectedNotes"
                        :key="index"
                        :class="`notes__item notes__item--${note.level}`"
                    >
                        <p class="notes__message">{{ note.message }}</p>
                        <p v-if="note.detail" class="notes__detail">{{ note.detail }}</p>
                        <p v-if="note.fix" class="notes__fix"><strong>What to do:</strong> {{ note.fix }}</p>
                    </li>
                </ul>
                <button
                    v-if="selected.char !== null"
                    type="button"
                    class="button button--small"
                    @click="appendText(selected.char)"
                >
                    Add to sample text
                </button>
            </aside>
        </div>
    </div>
</template>
