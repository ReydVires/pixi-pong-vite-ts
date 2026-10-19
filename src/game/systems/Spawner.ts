import type { MouseTypeId, SpawnEntry } from '../levels/types';

export interface SpawnerOptions {
    /** Delay range between spawns, in ms: `[min, max]`. */
    intervalMs: readonly [number, number];
    /** Hard cap on simultaneous mice. */
    maxConcurrent: number;
    /** Poll delay while the field is full, in ms. @default 80 */
    busyPollMs?: number;
}

/**
 * Decides *when* to spawn for random (non-scripted) stages.
 *
 * It never picks *where* — the screen owns the holes, because only the screen
 * knows which are occupied. Returning `true` means "a mouse may appear now if
 * a free hole exists"; a full field just re-polls shortly after.
 */
export class Spawner {
    private cooldown = 0;

    constructor(private readonly options: SpawnerOptions) {}

    update(dt: number, activeCount: number): boolean {
        this.cooldown -= dt;
        if (this.cooldown > 0) return false;

        if (activeCount >= this.options.maxConcurrent) {
            this.cooldown = this.options.busyPollMs ?? 80;
            return false;
        }

        const [min, max] = this.options.intervalMs;
        this.cooldown = min + Math.random() * Math.max(0, max - min);
        return true;
    }

    reset(): void {
        this.cooldown = 0;
    }
}

/** Weighted pick from a stage's spawn table. */
export function pickSpawn(entries: readonly SpawnEntry[]): MouseTypeId {
    const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = Math.random() * total;

    for (const entry of entries) {
        roll -= entry.weight;
        if (roll <= 0) return entry.type;
    }

    return entries[entries.length - 1].type;
}
