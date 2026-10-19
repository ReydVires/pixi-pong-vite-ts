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
        layout: 'grid',
        // Four holes in a 2x2 grid: one per thumb, and few enough to take in
        // while learning. The full seven-hole honeycomb is too much at once.
        holes: 4,
        spawn: [{ type: 'normal', weight: 1 }],
        spawnIntervalMs: [900, 1300],
        maxConcurrent: 2,
        starThresholds: [10, 40, 100],
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
        holes: 4,
        spawn: [{ type: 'normal', weight: 1 }],
        spawnIntervalMs: [900, 1300],
        maxConcurrent: 2,
        starThresholds: [60, 120, 300],
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
        maxConcurrent: 3,
        // Stage 1's thresholds scaled by duration (35/30s), spawn pace and
        // the 3:1 mix — the tough is worth 30 to a normal's 10.
        starThresholds: [110, 220, 360],
    },
    {
        // First appearance of `bomb`: tap it and you lose 25 and your streak.
        // The red spike over its head is the tell, and letting it sink away
        // again is free — so the stage is only won by *not* swatting everything.
        id: 'stage-3',
        title: 'Stage 3',
        durationMs: 35_000,
        layout: 'hex',
        holes: 7,
        spawn: [
            { type: 'normal', weight: 3 },
            { type: 'tough', weight: 1 },
            { type: 'bomb', weight: 1 },
        ],
        spawnIntervalMs: [800, 1200],
        // Three at once, unlike Stage 2: a hazard only teaches anything if
        // there is something else to hit and a reason to hurry.
        maxConcurrent: 3,
        // Sits above Stage 2 because it should look like progress, and stays
        // reachable because a bomb penalty shaves the ceiling rather than
        // moving it out of sight.
        starThresholds: [120, 240, 380],
    },
    {
        // First appearance of `golden`: it sweeps the whole field on its way
        // down, paying a flat bounty per capy whatever it caught — a bomb
        // included, so clearing a field you were avoiding is the big payout.
        // It wears a sparkle so it reads before the first tap.
        id: 'stage-4',
        title: 'Stage 4',
        durationMs: 35_000,
        layout: 'hex',
        holes: 7,
        // Stage 3's 3:1:1 scaled up by two, so the mix feels the same and the
        // golden stays the rare treat — roughly one spawn in eleven.
        spawn: [
            { type: 'normal', weight: 6 },
            { type: 'tough', weight: 2 },
            { type: 'bomb', weight: 2 },
            { type: 'golden', weight: 1 },
        ],
        spawnIntervalMs: [800, 1200],
        maxConcurrent: 4,
        // Stage 3's, lifted ~18% for the free points a clear hands out on top
        // of its own score. A first guess — the golden is the least predictable
        // thing in the table, since its value is whatever happens to be up.
        starThresholds: [140, 280, 440],
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
