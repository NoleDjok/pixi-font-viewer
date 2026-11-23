export interface IMissingChar {
    char: string;
    codePoint: number;
    count: number;
}

export interface ICoverageRun {
    text: string;
    missing: boolean;
}

const LINE_BREAKS = ['\n', '\r'];

export function findMissingChars(text: string, available: ReadonlySet<number>): IMissingChar[] {
    const missing = new Map<number, IMissingChar>();

    for (const char of Array.from(text)) {
        const codePoint = char.codePointAt(0);

        if (codePoint === undefined || LINE_BREAKS.includes(char) || available.has(codePoint)) {
            continue;
        }

        const entry = missing.get(codePoint);

        if (entry) {
            entry.count++;
        } else {
            missing.set(codePoint, { char, codePoint, count: 1 });
        }
    }

    return [...missing.values()];
}

export function splitByCoverage(text: string, available: ReadonlySet<number>): ICoverageRun[] {
    const runs: ICoverageRun[] = [];

    for (const char of Array.from(text)) {
        const codePoint = char.codePointAt(0) ?? 0;
        const missing = !LINE_BREAKS.includes(char) && !available.has(codePoint);
        const last = runs[runs.length - 1];

        if (last && last.missing === missing) {
            last.text += char;
        } else {
            runs.push({ text: char, missing });
        }
    }

    return runs;
}

export function formatCodePoint(codePoint: number): string {
    return `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`;
}

export function describeChar(char: string): string {
    if (char === ' ') {
        return 'space';
    }

    if (char === '\t') {
        return 'tab';
    }

    return char;
}
