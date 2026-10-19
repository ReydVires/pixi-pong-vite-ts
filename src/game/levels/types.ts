/**
 * Data model for stages and capys.
 *
 * Everything a stage can express lives here as plain data, so adding a stage —
 * or tuning one — never touches gameplay code. See `stages.ts` for the tables
 * and `capyTypes.ts` for the archetypes.
 */

export type CapyTypeId = 'normal' | 'tough' | 'bomb' | 'golden' | 'runner';

/** How one capy archetype behaves and scores. */
export interface CapyType {
    id: CapyTypeId;
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
    /** Resolves every other live capy when whacked. */
    effect?: 'clear';
    /**
     * How many times it can slip to another hole rather than leaving.
     *
     * Set on a type that will not hold still: each time it would escape, it
     * resurfaces somewhere else, so a whack has to *travel* rather than just
     * land in time. Its `upMs` is then the stay in one hole, not its whole
     * life. Set as the number of extra appearances it gets; the stay after the
     * last one ends in an ordinary escape.
     */
    hops?: number;
    /** Placeholder body colour until real art lands. */
    color: number;
    /** Placeholder detail (eyes/snout) colour. */
    accent: number;
}

/** A stage's spawn table: weighted picks from the archetypes it allows. */
export interface SpawnEntry {
    type: CapyTypeId;
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
    /** Capys allowed on screen at once. */
    concurrent: number;
    /** Delay between spawns, in ms. */
    intervalMs: number;
    /** Capys never escape — the player must whack them to advance. */
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
    /**
     * Marks this stage's Results button as the one that reveals the celebration.
     *
     * The last stage is the finale by default, so appending a stage carries the
     * ending along with it; setting this replaces that default outright. Only
     * one stage ever holds it. See `isFinaleStage`.
     */
    finale?: boolean;
}
