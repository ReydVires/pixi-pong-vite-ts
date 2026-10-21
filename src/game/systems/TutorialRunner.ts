import type { TutorialStep } from '../levels/types';

/** What the script asks the caller to do after a frame, if anything. */
export interface TutorialOutcome {
    /** The step advanced: show this prompt. */
    readonly prompt?: string;
    /** The scripted stage is over — the caller should finish it. */
    readonly finished?: boolean;
}

/**
 * The step machine behind a scripted stage (the tutorial).
 *
 * Pure rules: it tracks which beat is running, how many whacks and
 * milliseconds it has seen, and when to advance. It never touches the field —
 * placing a capy is the caller's job, done through the `spawn` callback it is
 * handed each frame, which is also how a stage with nowhere to put a capy
 * reports back (no placement means the step's spawn delay isn't armed).
 *
 * Keeps `PlayScreen` out of scripted-stage bookkeeping the same way `Spawner`
 * keeps it out of the random-stage maths.
 */
export class TutorialRunner {
    private index = 0;
    private whacks = 0;
    private elapsed = 0;
    private cooldown = 0;

    constructor(private readonly steps: readonly TutorialStep[]) {}

    /** Count one whack toward the current step's quota. */
    recordWhack(): void {
        this.whacks += 1;
    }

    /**
     * Advance the script by one frame.
     *
     * `spawn(hold)` is asked to place a capy when the step wants one; it
     * returns `true` when one was actually placed. An outcome is returned only
     * when something changed — a step boundary — and `null` otherwise.
     */
    update(dt: number, liveCount: number, spawn: (hold: boolean) => boolean): TutorialOutcome | null {
        const step = this.steps[this.index];
        // Defensive: the runner only steps past the end through `advance()`,
        // which reports `finished` itself — this simply cannot run past the table.
        if (!step) return { finished: true };

        this.elapsed += dt;
        this.cooldown -= dt;

        const quotaMet = step.quota !== undefined && this.whacks >= step.quota;
        const timeMet = step.durationMs !== undefined && this.elapsed >= step.durationMs;
        const stepComplete = quotaMet || timeMet;

        // Stop spawning once the step is satisfied, then wait for the field to
        // clear so the next prompt never arrives on top of a live capy.
        if (!stepComplete && this.cooldown <= 0 && liveCount < step.concurrent) {
            if (spawn(step.hold ?? false)) this.cooldown = Math.max(0, step.intervalMs);
        }

        if (stepComplete && liveCount === 0) return this.advance();
        return null;
    }

    /** Roll to the next step, or report the end of the script. */
    private advance(): TutorialOutcome {
        this.index += 1;
        this.whacks = 0;
        this.elapsed = 0;
        this.cooldown = 300;

        const next = this.steps[this.index];
        if (!next) return { finished: true };
        return { prompt: next.prompt };
    }
}
