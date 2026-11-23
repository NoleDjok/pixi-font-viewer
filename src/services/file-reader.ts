import { extensionOf, normalizePath, TEXT_EXTENSIONS } from '../core';

export interface IInputFile {
    path: string;
    file: File;
}

export function filesFromList(list: FileList | readonly File[]): IInputFile[] {
    return Array.from(list).map((file) => ({ path: normalizePath(file.webkitRelativePath || file.name), file }));
}

export async function filesFromDataTransfer(transfer: DataTransfer): Promise<IInputFile[]> {
    const entries: FileSystemEntry[] = [];
    const looseFiles: File[] = [];

    for (const item of Array.from(transfer.items)) {
        if (item.kind !== 'file') {
            continue;
        }

        const entry = item.webkitGetAsEntry();

        if (entry) {
            entries.push(entry);
            continue;
        }

        const file = item.getAsFile();

        if (file) {
            looseFiles.push(file);
        }
    }

    const nested = await Promise.all(entries.map((entry) => readEntry(entry)));

    return [...nested.flat(), ...filesFromList(looseFiles)];
}

export async function readTextFiles(files: readonly IInputFile[]): Promise<Map<IInputFile, string>> {
    const texts = new Map<IInputFile, string>();
    const textFiles = files.filter((item) => TEXT_EXTENSIONS.includes(extensionOf(item.path)));

    await Promise.all(
        textFiles.map(async (item) => {
            texts.set(item, await item.file.text());
        }),
    );

    return texts;
}

async function readEntry(entry: FileSystemEntry): Promise<IInputFile[]> {
    if (isFileEntry(entry)) {
        const file = await new Promise<File>((resolve, reject) => entry.file(resolve, reject));

        return [{ path: normalizePath(entry.fullPath || file.name), file }];
    }

    if (isDirectoryEntry(entry)) {
        const children = await readAllEntries(entry.createReader());
        const nested = await Promise.all(children.map((child) => readEntry(child)));

        return nested.flat();
    }

    return [];
}

async function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
    const all: FileSystemEntry[] = [];

    for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));

        if (batch.length === 0) {
            return all;
        }

        all.push(...batch);
    }
}

function isFileEntry(entry: FileSystemEntry): entry is FileSystemFileEntry {
    return entry.isFile;
}

function isDirectoryEntry(entry: FileSystemEntry): entry is FileSystemDirectoryEntry {
    return entry.isDirectory;
}
