<script setup lang="ts">
import { computed } from 'vue';
import type { IFontDescriptor } from '../core';
import { LEVEL_ORDER } from './components.config';

const props = defineProps<{ font: IFontDescriptor }>();

const issues = computed(() => [...props.font.issues].sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]));
</script>

<template>
    <div class="issues">
        <p v-if="issues.length === 0" class="coverage__ok">No problems found.</p>
        <ul v-else class="issue-list">
            <li v-for="(issue, index) in issues" :key="index" class="issue" :class="`issue--${issue.level}`">
                <span class="issue__level">{{ issue.level }}</span>
                <div class="issue__body">
                    <p class="issue__message">{{ issue.message }}</p>
                    <ul v-if="issue.details?.length" class="issue__details">
                        <li v-for="detail in issue.details" :key="detail">{{ detail }}</li>
                    </ul>
                    <p v-else-if="issue.glyphKeys?.length" class="issue__glyphs">
                        Glyphs: {{ issue.glyphKeys.join(', ') }}
                    </p>
                </div>
            </li>
        </ul>
    </div>
</template>
