/**
 * Data model for stages and mice.
 *
 * Everything a stage can express lives here as plain data, so adding a stage —
 * or tuning one — never touches gameplay code. See `stages.ts` for the tables
 * and `mouseTypes.ts` for the archetypes.
 */

export type MouseTypeId = 'normal' | 'tough' | 'bomb' | 'golden' | 'runner';

/** How one mouse archetype behaves and scores. */
export interface MouseType {
    id: MouseTypeId;
    /** Points awarded when it goes down (negative for hazards). */
    points: number;
    /** Taps required before it goes down. */
    hp: number;
    /** Kept in the hole after a non-leaving hit (the multi-whack feel). */
    staysWhenHit: boolean;
    /** How long it stays fully risen before escaping, in ms. */
    upMs: number;
    /** Time to rise out of / sink back into the hole, in ms. */
    emergeMs: number;
    /** Tapping it is penalised rather than rewarded. */
    harmful?: boolean;
    /** Resolves every other live mouse when whacked. */
    effect?: 'clear';
    /** Placeholder body colour until real art lands. */
    color: number;
    /** Placeholder detail (eyes/snout) colour. */
    accent: number;
}

/** A stage's spawn table: weighted picks from the archetypes it allows. */
export interface SpawnEntry {
    type: MouseTypeId;
    weight: number;
}

/** One scripted beat of a tutorial stage. */
export interface TutorialStep {
    /** Shown in the prompt while this step is active. */
    prompt: string;
    /** Whacks required to finish this step. Omit when the step is timed. */
    quota?: number;
    /** How long the step runs, in ms. Omit when the step is quota-driven. */
    durationMs?: number;
    /** Mice allowed on screen at once. */
    concurrent: number;
    /** Delay between spawns, in ms. */
    intervalMs: number;
    /** Mice never escape — the player must whack them to advance. */
    hold?: boolean;
}

/** One stage of the game. */
export interface StageDef {
    id: string;
    title: string;
    /** Countdown length, or `null` for untimed stages (the tutorial). */
    durationMs: number | null;
    /** Hole arrangement. `hex` is the honeycomb default. */
    layout: 'hex' | 'grid';
    /** How many holes to lay out. 1, 7 or 19 fill the honeycomb rings. */
    holes: number;
    spawn: readonly SpawnEntry[];
    /** Spawn interval range, in ms: `[min, max]`. */
    spawnIntervalMs: readonly [number, number];
    maxConcurrent: number;
    /** `score >= thresholds[n]` earns `n + 1` stars. */
    starThresholds: readonly [number, number, number];
    /** Present ⇒ the stage is scripted instead of randomly spawned. */
    tutorial?: readonly TutorialStep[];
    /** Marks the last stage: its Results button reveals the celebration. */
    finale?: boolean;
}
