<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { selectedFont } from '../store';
import AtlasView from './AtlasView.vue';
import GlyphGrid from './GlyphGrid.vue';
import IssueList from './IssueList.vue';
import MetricsView from './MetricsView.vue';

type TabId = 'glyphs' | 'atlas' | 'issues' | 'metrics';

const active = ref<TabId>('glyphs');

const tabs = computed(() => {
    const font = selectedFont.value;

    if (!font) {
        return [];
    }

    const problems = font.issues.filter((issue) => issue.level !== 'info').length;
    const list: { id: TabId; label: string }[] = [];

    if (font.render.type === 'bitmap') {
        list.push({ id: 'glyphs', label: `Glyphs (${font.glyphs.length})` });
    }

    if (font.pages.length > 0) {
        list.push({ id: 'atlas', label: 'Atlas' });
    }

    list.push({ id: 'issues', label: problems > 0 ? `Problems (${problems})` : 'Problems' });
    list.push({ id: 'metrics', label: 'Metrics' });

    return list;
});

watch(tabs, (list) => {
    if (!list.some((tab) => tab.id === active.value)) {
        active.value = list[0]?.id ?? 'glyphs';
    }
});

function onKeydown(event: KeyboardEvent): void {
    const index = tabs.value.findIndex((tab) => tab.id === active.value);
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;

    if (step === 0 || index === -1) {
        return;
    }

    const next = tabs.value[(index + step + tabs.value.length) % tabs.value.length];

    if (next) {
        active.value = next.id;
        document.getElementById(`tab-${next.id}`)?.focus();
    }
}
</script>

<template>
    <section v-if="selectedFont" class="inspector" aria-label="Font inspector">
        <div class="tabs" role="tablist" @keydown="onKeydown">
            <button
                v-for="tab in tabs"
                :id="`tab-${tab.id}`"
                :key="tab.id"
                type="button"
                role="tab"
                class="tabs__tab"
                :class="{ 'tabs__tab--active': tab.id === active }"
                :aria-selected="tab.id === active"
                :aria-controls="`panel-${tab.id}`"
                :tabindex="tab.id === active ? 0 : -1"
                @click="active = tab.id"
            >
                {{ tab.label }}
            </button>
        </div>
        <div :id="`panel-${active}`" class="tabs__panel" role="tabpanel" :aria-labelledby="`tab-${active}`">
            <GlyphGrid v-if="active === 'glyphs'" :font="selectedFont" />
            <AtlasView v-else-if="active === 'atlas'" :font="selectedFont" />
            <IssueList v-else-if="active === 'issues'" :font="selectedFont" />
            <MetricsView v-else :font="selectedFont" />
        </div>
    </section>
</template>
