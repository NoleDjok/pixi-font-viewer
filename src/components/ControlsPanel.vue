<script setup lang="ts">
import { computed, ref } from 'vue';
import { FONT_GLYPHS_PRESET_ID, TEXT_PRESETS, type IFontDescriptor } from '../core';
import { DEFAULT_WEB_FONT_SIZE } from '../renderer';
import { shareableTextUrl } from '../services';
import {
    compareFont,
    fontGlyphText,
    resetSettings,
    selectedFont,
    SETTING_LIMITS,
    viewer,
    ZOOM_PRESETS,
} from '../store';
import CoverageSummary from './CoverageSummary.vue';
import NumberField from './NumberField.vue';

const settings = viewer.settings;
const shareStatus = ref('');

const tiers = computed(() => (selectedFont.value?.render.type === 'bitmap' ? selectedFont.value.render.tiers : []));
const nativeSize = computed(() => {
    if (selectedFont.value?.render.type === 'web') {
        return `0 = ${DEFAULT_WEB_FONT_SIZE}px for web fonts`;
    }

    const metrics = selectedFont.value?.metrics;

    return metrics ? `0 = native size (${Math.round(metrics.size * 100) / 100})` : '0 = native size';
});
const compareOptions = computed(() => viewer.fonts.filter((font) => font.id !== viewer.selectedId));
const coverageFonts = computed(() =>
    [selectedFont.value, compareFont.value].filter(
        (font): font is IFontDescriptor => font !== null && font.render.type === 'bitmap',
    ),
);

function applyPreset(event: Event): void {
    const select = event.target;

    if (!(select instanceof HTMLSelectElement)) {
        return;
    }

    const preset = TEXT_PRESETS.find((item) => item.id === select.value);
    select.value = '';

    if (!preset) {
        return;
    }

    if (preset.id === FONT_GLYPHS_PRESET_ID) {
        settings.text = selectedFont.value ? fontGlyphText(selectedFont.value) : settings.text;
    } else {
        settings.text = preset.text;
    }
}

function onCompare(event: Event): void {
    if (event.target instanceof HTMLSelectElement) {
        viewer.compareId = event.target.value || null;
    }
}

function onZoom(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
        settings.zoom = Number(event.target.value);
    }
}

async function copyShareLink(): Promise<void> {
    const url = shareableTextUrl(settings.text);
    window.history.replaceState(null, '', url);

    try {
        await navigator.clipboard.writeText(url);
        shareStatus.value = 'Link copied.';
    } catch (_error) {
        shareStatus.value = 'Link is in the address bar.';
    }
}
</script>

<template>
    <div class="controls">
        <section class="section">
            <h2 class="section__title">Text</h2>
            <label class="field__label" for="text-preset">Insert preset</label>
            <select id="text-preset" class="field__input" value="" @change="applyPreset">
                <option value="" disabled>Choose a preset…</option>
                <option v-for="preset in TEXT_PRESETS" :key="preset.id" :value="preset.id">{{ preset.label }}</option>
            </select>
            <label class="field__label" for="sample-text">Sample text</label>
            <textarea
                id="sample-text"
                v-model="settings.text"
                class="field__input field__input--text"
                rows="6"
                spellcheck="false"
                data-test="sample-text"
            ></textarea>
            <div class="row">
                <button type="button" class="button button--small" @click="copyShareLink">Copy link with text</button>
                <span class="muted" role="status">{{ shareStatus }}</span>
            </div>
            <CoverageSummary v-for="font in coverageFonts" :key="font.id" :font="font" />
        </section>

        <section class="section">
            <h2 class="section__title">Layout</h2>
            <fieldset class="segmented">
                <legend class="field__label">Fields</legend>
                <label class="segmented__item">
                    <input v-model="settings.mode" type="radio" value="single" name="mode" />
                    <span>One field</span>
                </label>
                <label class="segmented__item">
                    <input v-model="settings.mode" type="radio" value="lines" name="mode" />
                    <span>Field per line</span>
                </label>
            </fieldset>
            <fieldset class="segmented">
                <legend class="field__label">Align</legend>
                <label v-for="align in ['left', 'center', 'right'] as const" :key="align" class="segmented__item">
                    <input v-model="settings.align" type="radio" :value="align" name="align" />
                    <span>{{ align }}</span>
                </label>
            </fieldset>
            <NumberField
                id="font-size"
                v-model="settings.fontSize"
                label="fontSize"
                v-bind="SETTING_LIMITS.fontSize"
                :hint="nativeSize"
            />
            <NumberField
                id="letter-spacing"
                v-model="settings.letterSpacing"
                label="letterSpacing"
                v-bind="SETTING_LIMITS.letterSpacing"
            />
            <NumberField
                id="max-width"
                v-model="settings.maxWidth"
                label="maxWidth (word wrap)"
                v-bind="SETTING_LIMITS.maxWidth"
                hint="0 = off. Pixi wraps only at spaces."
            />
            <NumberField
                id="fit-width"
                v-model="settings.fitWidth"
                label="scaleToWidth"
                v-bind="SETTING_LIMITS.fitWidth"
                hint="0 = off. Shrinks wider text like BitmapValueComponent."
            />
        </section>

        <section class="section">
            <h2 class="section__title">Look</h2>
            <div class="row">
                <label class="field__label" for="tint">tint</label>
                <input id="tint" v-model="settings.tint" class="color-input" type="color" />
                <label class="field__label" for="background">Background</label>
                <input id="background" v-model="settings.background" class="color-input" type="color" />
            </div>
            <label class="checkbox">
                <input v-model="settings.checkerboard" type="checkbox" />
                <span>Checkerboard</span>
            </label>
            <fieldset v-if="tiers.length > 1" class="segmented">
                <legend class="field__label">Asset resolution</legend>
                <label v-for="tier in tiers" :key="tier" class="segmented__item">
                    <input v-model="settings.tier" type="radio" :value="tier" name="tier" />
                    <span>{{ tier }}</span>
                </label>
            </fieldset>
            <label class="field__label" for="zoom">Zoom {{ Math.round(settings.zoom * 100) }}%</label>
            <input
                id="zoom"
                class="range"
                type="range"
                :min="SETTING_LIMITS.zoom.min"
                :max="SETTING_LIMITS.zoom.max"
                :step="SETTING_LIMITS.zoom.step"
                :value="settings.zoom"
                @input="onZoom"
            />
            <div class="row">
                <button
                    v-for="zoom in ZOOM_PRESETS"
                    :key="zoom"
                    type="button"
                    class="button button--small"
                    :aria-pressed="settings.zoom === zoom"
                    @click="settings.zoom = zoom"
                >
                    {{ zoom * 100 }}%
                </button>
            </div>
        </section>

        <section class="section">
            <h2 class="section__title">Guides</h2>
            <label class="checkbox">
                <input v-model="settings.showBounds" type="checkbox" />
                <span class="swatch swatch--bounds"></span>
                <span>Text box and width limits</span>
            </label>
            <label class="checkbox">
                <input v-model="settings.showLines" type="checkbox" />
                <span class="swatch swatch--baseline"></span>
                <span>Line height and baseline</span>
            </label>
            <label class="checkbox">
                <input v-model="settings.showGlyphBoxes" type="checkbox" />
                <span class="swatch swatch--glyph"></span>
                <span>Glyph boxes</span>
            </label>
        </section>

        <section class="section">
            <h2 class="section__title">Compare</h2>
            <label class="field__label" for="compare">Second font</label>
            <select id="compare" class="field__input" :value="viewer.compareId ?? ''" @change="onCompare">
                <option value="">None</option>
                <option v-for="font in compareOptions" :key="font.id" :value="font.id">
                    {{ font.name }} ({{ font.location || font.kind }})
                </option>
            </select>
        </section>

        <button type="button" class="button button--small" @click="resetSettings">Reset settings</button>
    </div>
</template>
