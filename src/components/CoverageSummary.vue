<script setup lang="ts">
import { computed } from 'vue';
import { describeChar, formatCodePoint, splitByCoverage, type IFontDescriptor } from '../core';
import { availableCodePoints, missingChars, viewer } from '../store';

const props = defineProps<{ font: IFontDescriptor }>();

const available = computed(() => availableCodePoints(props.font));
const missing = computed(() => missingChars(props.font, viewer.settings.text));
const runs = computed(() => splitByCoverage(viewer.settings.text, available.value));
</script>

<template>
    <div class="coverage" :aria-label="`Glyph coverage of ${font.name}`">
        <p v-if="missing.length === 0" class="coverage__ok">Every character of the text is in “{{ font.name }}”.</p>
        <template v-else>
            <p class="coverage__title">
                {{ missing.length }} character(s) missing in “{{ font.name }}”: the game draws nothing for them.
            </p>
            <ul class="coverage__chips">
                <li v-for="item in missing" :key="item.codePoint" class="chip chip--missing">
                    <span class="chip__char">{{ describeChar(item.char) }}</span>
                    <span class="chip__code">{{ formatCodePoint(item.codePoint) }}</span>
                    <span v-if="item.count > 1" class="chip__count">×{{ item.count }}</span>
                </li>
            </ul>
            <pre class="coverage__text"><span
                v-for="(run, index) in runs"
                :key="index"
                :class="{ 'coverage__missing': run.missing }"
            >{{ run.text }}</span></pre>
        </template>
    </div>
</template>
