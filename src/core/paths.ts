import { HIDDEN_FOLDER_NAMES } from './constants';

export function normalizePath(path: string): string {
    return path.replace(/\\/g, '/').replace(/^\/+/, '');
}

export function pathSegments(path: string): string[] {
    return normalizePath(path).split('/').filter(Boolean);
}

export function baseName(path: string): string {
    const normalized = normalizePath(path);
    const index = normalized.lastIndexOf('/');

    return index === -1 ? normalized : normalized.slice(index + 1);
}

export function dirName(path: string): string {
    const normalized = normalizePath(path);
    const index = normalized.lastIndexOf('/');

    return index === -1 ? '' : normalized.slice(0, index);
}

export function extensionOf(path: string): string {
    const name = baseName(path);
    const index = name.lastIndexOf('.');

    return index <= 0 ? '' : name.slice(index + 1).toLowerCase();
}

export function stripExtension(name: string): string {
    const index = name.lastIndexOf('.');

    return index <= 0 ? name : name.slice(0, index);
}

export function isHiddenPath(path: string): boolean {
    return pathSegments(path).some((segment) => segment.startsWith('.') || HIDDEN_FOLDER_NAMES.includes(segment));
}
