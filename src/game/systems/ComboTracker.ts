/**
 * Consecutive-whack streak → score multiplier.
 *
 * Pure state: the screen calls `recordHit()` / `recordMiss()` and reads
 * `multiplier` when awarding points. A miss (or a hazard tap) resets the run.
 */
export class ComboTracker {
    private streak = 0;
    private bestStreak = 0;

    /** Hits in the current run. */
    private readonly perStep = 4;
    private readonly cap = 5;

    get count(): number {
        return this.streak;
    }

    /** Longest run seen this stage — reported on the results screen. */
    get bestCount(): number {
        return this.bestStreak;
    }

    /** ×1 for the first `perStep` hits, rising to `cap`. */
    get multiplier(): number {
        return Math.min(this.cap, 1 + Math.floor(this.streak / this.perStep));
    }

    recordHit(): void {
        this.streak += 1;
        this.bestStreak = Math.max(this.bestStreak, this.streak);
    }

    recordMiss(): void {
        this.streak = 0;
    }

    reset(): void {
        this.streak = 0;
        this.bestStreak = 0;
    }
}
