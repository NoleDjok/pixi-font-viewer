import { computed, markRaw, nextTick, reactive, watch } from 'vue';
import {
    chunkLines,
    findMissingChars,
    ingestFiles,
    type FontSource,
    type IFontDescriptor,
    type IMissingChar,
    type IssueLevel,
} from '../core';
import type { IPreviewSettings } from '../renderer';
import {
    FontRegistry,
    FontResources,
    loadFontSource,
    readQueryText,
    readStoredJson,
    readTextFiles,
    writeStoredJson,
    type IInputFile,
    type IRegistrySnapshot,
} from '../services';
import { pickValidSettings } from './settings-validation';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from './viewer.config';

export interface ILoadProblem {
    id: number;
    path: string;
    level: IssueLevel;
    message: string;
}

export interface IViewerState {
    fonts: IFontDescriptor[];
    selectedId: string | null;
    compareId: string | null;
    settings: IPreviewSettings;
    loading: boolean;
    problems: ILoadProblem[];
}

const registry = new FontRegistry();
let problemCounter = 0;

export const viewer = reactive<IViewerState>({
    fonts: [],
    selectedId: null,
    compareId: null,
    settings: loadSettings(),
    loading: false,
    problems: [],
});

export const selectedFont = computed(() => viewer.fonts.find((font) => font.id === viewer.selectedId) ?? null);

export const compareFont = computed(() =>
    viewer.compareId === viewer.selectedId ? null : (viewer.fonts.find((font) => font.id === viewer.compareId) ?? null),
);

export const previewFonts = computed(() =>
    [selectedFont.value, compareFont.value].filter((font): font is IFontDescriptor => font !== null),
);

watch(
    () => viewer.settings,
    (settings) => writeStoredJson(SETTINGS_STORAGE_KEY, settings),
    { deep: true },
);

export async function loadInputFiles(files: readonly IInputFile[]): Promise<void> {
    if (files.length === 0) {
        return;
    }

    viewer.loading = true;

    try {
        const texts = await readTextFiles(files);
        const { sources, problems } = ingestFiles(files, (file) => texts.get(file));
        problems.forEach((problem) => addProblem(problem.path, problem.level, problem.message));

        if (sources.length === 0 && !problems.some((problem) => problem.level === 'error')) {
            addProblem('', 'error', 'No fonts found among the dropped files.');
        }

        const loadedIds: string[] = [];

        for (const source of sources) {
            const id = await loadSource(source);

            if (id) {
                loadedIds.push(id);
            }
        }

        const keepsSelection = viewer.selectedId !== null && loadedIds.includes(viewer.selectedId);

        if (!keepsSelection && loadedIds[0]) {
            selectFont(loadedIds[0]);
        }
    } finally {
        viewer.loading = false;
    }
}

export function selectFont(id: string): void {
    viewer.selectedId = id;

    if (viewer.compareId === id) {
        viewer.compareId = null;
    }
}

export async function removeFont(id: string): Promise<void> {
    const index = viewer.fonts.findIndex((font) => font.id === id);

    if (index === -1) {
        return;
    }

    viewer.fonts.splice(index, 1);

    if (viewer.selectedId === id) {
        viewer.selectedId = viewer.fonts[Math.min(index, viewer.fonts.length - 1)]?.id ?? null;
    }

    if (viewer.compareId === id) {
        viewer.compareId = null;
    }

    await nextTick();
    registry.dispose(id);
}

export function dismissProblem(id: number): void {
    viewer.problems = viewer.problems.filter((problem) => problem.id !== id);
}

export function clearProblems(): void {
    viewer.problems = [];
}

export function registrySnapshot(): IRegistrySnapshot {
    return registry.snapshot();
}

export function resetSettings(): void {
    Object.assign(viewer.settings, DEFAULT_SETTINGS);
}

export function appendText(text: string): void {
    viewer.settings.text += text;
}

export function fontGlyphText(font: IFontDescriptor): string {
    return chunkLines(font.glyphs.flatMap((glyph) => (glyph.char ? [glyph.char] : [])).join(''));
}

export function availableCodePoints(font: IFontDescriptor): Set<number> {
    return new Set(font.glyphs.flatMap((glyph) => (glyph.codePoint === null ? [] : [glyph.codePoint])));
}

export function missingChars(font: IFontDescriptor, text: string): IMissingChar[] {
    return findMissingChars(text, availableCodePoints(font));
}

async function loadSource(source: FontSource<IInputFile>): Promise<string | null> {
    const id = registry.nextId();
    const resources = new FontResources();
    let descriptor: IFontDescriptor;

    try {
        descriptor = markRaw(await loadFontSource(source, id, resources));
    } catch (error) {
        resources.dispose();
        addProblem(source.dir || source.name, 'error', `${source.name}: ${errorMessage(error)}`);

        return null;
    }

    registry.add(id, resources);
    const previousIndex = viewer.fonts.findIndex((font) => font.key === descriptor.key);
    const previous = viewer.fonts[previousIndex];

    if (!previous) {
        viewer.fonts.push(descriptor);

        return id;
    }

    viewer.fonts.splice(previousIndex, 1, descriptor);

    if (viewer.compareId === previous.id) {
        viewer.compareId = id;
    }

    if (viewer.selectedId === previous.id) {
        viewer.selectedId = id;
    }

    await nextTick();
    registry.dispose(previous.id);

    return id;
}

function addProblem(path: string, level: IssueLevel, message: string): void {
    problemCounter++;
    viewer.problems.push({ id: problemCounter, path, level, message });
}

function loadSettings(): IPreviewSettings {
    const settings = { ...DEFAULT_SETTINGS, ...pickValidSettings(readStoredJson(SETTINGS_STORAGE_KEY)) };
    const queryText = readQueryText();

    if (queryText !== null) {
        settings.text = queryText;
    }

    return settings;
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
