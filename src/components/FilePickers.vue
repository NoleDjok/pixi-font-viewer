<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { BMFONT_EXTENSIONS, ATLAS_EXTENSIONS, IMAGE_EXTENSIONS, WEB_FONT_EXTENSIONS } from '../core';
import { filesFromList } from '../services';
import { loadInputFiles, viewer } from '../store';

const ACCEPT = [...IMAGE_EXTENSIONS, ...WEB_FONT_EXTENSIONS, ...BMFONT_EXTENSIONS, ...ATLAS_EXTENSIONS]
    .map((extension) => `.${extension}`)
    .join(',');

const filesInput = ref<HTMLInputElement | null>(null);
const folderInput = ref<HTMLInputElement | null>(null);

onMounted(() => {
    if (folderInput.value) {
        folderInput.value.webkitdirectory = true;
    }
});

async function onChange(event: Event): Promise<void> {
    const input = event.target;

    if (!(input instanceof HTMLInputElement) || !input.files) {
        return;
    }

    const files = filesFromList(input.files);
    input.value = '';
    await loadInputFiles(files);
}
</script>

<template>
    <div class="file-pickers">
        <input
            ref="filesInput"
            class="visually-hidden"
            type="file"
            multiple
            :accept="ACCEPT"
            tabindex="-1"
            data-test="files-input"
            @change="onChange"
        />
        <input
            ref="folderInput"
            class="visually-hidden"
            type="file"
            tabindex="-1"
            data-test="folder-input"
            @change="onChange"
        />
        <button type="button" class="button button--primary" :disabled="viewer.loading" @click="filesInput?.click()">
            Open files…
        </button>
        <button type="button" class="button" :disabled="viewer.loading" @click="folderInput?.click()">
            Open folder…
        </button>
    </div>
</template>
