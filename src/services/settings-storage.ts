const TEXT_QUERY_PARAM = 'text';

export function readStoredJson(key: string): unknown {
    try {
        const raw = window.localStorage.getItem(key);

        return raw === null ? null : JSON.parse(raw);
    } catch (_error) {
        return null;
    }
}

export function writeStoredJson(key: string, value: unknown): void {
    try {
        window.localStorage.setItem(key, JSON.stringify(value));
    } catch (_error) {
        return;
    }
}

export function removeStored(key: string): void {
    try {
        window.localStorage.removeItem(key);
    } catch (_error) {
        return;
    }
}

export function readQueryText(): string | null {
    return new URLSearchParams(window.location.search).get(TEXT_QUERY_PARAM);
}

export function shareableTextUrl(text: string): string {
    const url = new URL(window.location.href);
    url.searchParams.set(TEXT_QUERY_PARAM, text);

    return url.toString();
}

export function isDebugMode(): boolean {
    return new URLSearchParams(window.location.search).get('debug') === '1';
}
