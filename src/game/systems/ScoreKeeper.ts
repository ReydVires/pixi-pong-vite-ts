/** Running score. Clamped at zero — hazards can cost points, never a deficit. */
export class ScoreKeeper {
    private value = 0;

    get score(): number {
        return this.value;
    }

    add(points: number): void {
        this.value = Math.max(0, this.value + points);
    }

    reset(): void {
        this.value = 0;
    }
}

/**
 * Stars earned for `score`: `n + 1` stars for clearing `thresholds[n]`.
 * `0` means the stage was played but the first threshold wasn't reached.
 */
export function starsFor(score: number, thresholds: readonly [number, number, number]): number {
    if (score >= thresholds[2]) return 3;
    if (score >= thresholds[1]) return 2;
    if (score >= thresholds[0]) return 1;
    return 0;
}
