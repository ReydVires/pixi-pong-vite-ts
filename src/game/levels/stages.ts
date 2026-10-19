import type { StageDef } from './types';

/**
 * The stage table, in order. One new idea per stage.
 *
 * Stage 0 is scripted (see `tutorial`) but still runs on the clock, so a
 * countdown is always on screen and dawdling still ends the run. Everything
 * after it is a timed stage driven by `spawn`, `spawnIntervalMs` and
 * `maxConcurrent`. Difficulty is tuned here — never in code.
 */
export const STAGES: readonly StageDef[] = [
    {
        id: 'tutorial',
        title: 'Tutorial',
        // Generous: the beats need ~6 whacks, so this only catches a player
        // who has stopped playing — it is not meant to be loseable.
        durationMs: 60_000,
        layout: 'hex',
        // Four holes keep the honeycomb feel while leaving one hole per thumb
        // reachable — the full seven is too much to take in while learning.
        holes: 4,
        spawn: [{ type: 'normal', weight: 1 }],
        spawnIntervalMs: [900, 1300],
        maxConcurrent: 2,
        starThresholds: [1, 4, 6],
        tutorial: [
            { prompt: 'Tap the capy!', quota: 1, concurrent: 1, intervalMs: 0, hold: true },
            { prompt: 'Nice! Now get the rest', quota: 3, concurrent: 1, intervalMs: 700, hold: true },
            { prompt: "They escape if you're slow", quota: 2, concurrent: 2, intervalMs: 900 },
            { prompt: "That's it — go!", durationMs: 10_000, concurrent: 2, intervalMs: 700 },
        ],
    },
    {
        id: 'stage-1',
        title: 'Stage 1',
        durationMs: 30_000,
        layout: 'hex',
        holes: 7,
        spawn: [{ type: 'normal', weight: 1 }],
        spawnIntervalMs: [900, 1300],
        maxConcurrent: 2,
        starThresholds: [60, 120, 200],
    },
    {
        // First appearance of `tough`: three taps, and it stays up between
        // them. The pips above its head are the tell. Everything else is
        // Stage 1 again — one new idea, as the table promises.
        id: 'stage-2',
        title: 'Stage 2',
        durationMs: 35_000,
        layout: 'hex',
        holes: 7,
        spawn: [
            { type: 'normal', weight: 3 },
            { type: 'tough', weight: 1 },
        ],
        // Slightly quicker than Stage 1: the toughs sit in a hole longer, so
        // the field needs topping up to keep the same whack-per-second feel.
        spawnIntervalMs: [800, 1200],
        maxConcurrent: 2,
        // Stage 1's thresholds scaled by duration (35/30s), spawn pace and
        // the 3:1 mix — the tough is worth 30 to a normal's 10.
        starThresholds: [110, 220, 360],
    },
];

/** Stage the menu starts with. */
export const FIRST_STAGE_ID = STAGES[0].id;

export function findStage(id: string): StageDef {
    const stage = STAGES.find((candidate) => candidate.id === id);
    if (!stage) throw new Error(`Unknown stage "${id}" — is it listed in STAGES?`);
    return stage;
}

/** The stage after `id`, or `null` when `id` is the last one. */
export function findNextStage(id: string): StageDef | null {
    const index = STAGES.findIndex((candidate) => candidate.id === id);
    if (index === -1 || index + 1 >= STAGES.length) return null;
    return STAGES[index + 1];
}
