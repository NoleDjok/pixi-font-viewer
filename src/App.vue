<script setup lang="ts">
import { ref } from 'vue';
import {
    CharMapField,
    ControlsPanel,
    FilePickers,
    FontList,
    InspectorTabs,
    PreviewCanvas,
    ProblemList,
} from './components';
import { filesFromDataTransfer } from './services';
import { loadInputFiles, selectedFont } from './store';

const preview = ref<InstanceType<typeof PreviewCanvas> | null>(null);
const dragDepth = ref(0);

function onDragEnter(event: DragEvent): void {
    if (event.dataTransfer?.types.includes('Files')) {
        dragDepth.value++;
    }
}

function onDragLeave(): void {
    dragDepth.value = Math.max(0, dragDepth.value - 1);
}

async function onDrop(event: DragEvent): Promise<void> {
    dragDepth.value = 0;

    if (event.dataTransfer) {
        await loadInputFiles(await filesFromDataTransfer(event.dataTransfer));
    }
}

async function exportPng(): Promise<void> {
    const url = await preview.value?.exportPng();

    if (!url) {
        return;
    }

    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedFont.value?.name ?? 'font'}-preview.png`;
    link.click();
}
</script>

<template>
    <div class="app" @dragenter.prevent="onDragEnter" @dragover.prevent @dragleave="onDragLeave" @drop.prevent="onDrop">
        <header class="topbar">
            <h1 class="topbar__title">Font Viewer</h1>
            <p class="topbar__subtitle">Bitmap and web fonts rendered the way the slot games render them</p>
            <div class="topbar__actions">
                <FilePickers />
                <button type="button" class="button" :disabled="!selectedFont" @click="exportPng">Export PNG</button>
            </div>
        </header>
        <aside class="app__fonts" aria-label="Fonts">
            <FontList />
            <ProblemList />
            <CharMapField />
        </aside>
        <main class="app__workspace">
            <PreviewCanvas ref="preview" />
            <InspectorTabs />
        </main>
        <aside class="app__controls" aria-label="Preview settings">
            <ControlsPanel />
        </aside>
        <div v-if="dragDepth > 0" class="drop-overlay" aria-hidden="true">
            <p class="drop-overlay__text">Drop font files or folders</p>
        </div>
    </div>
</template>
