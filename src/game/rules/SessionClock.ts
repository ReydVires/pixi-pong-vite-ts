/**
 * Countdown for timed stages.
 *
 * Purely time-based: the stage feeds it `dt` from the screen's `update()`, so
 * pausing the screen simply stops feeding it. Nothing here reads the frame
 * rate, the wall clock, or the DOM.
 *
 * `rate` drains faster than real time: 1.5 means a stage declared as 60s runs
 * out in 40s of wall clock. It is a *feel* knob — the stage table keeps owning
 * the authored duration, this only decides how hard the clock presses. It can
 * also be raised mid-run (`hurry`), so mistakes shorten what is left.
 */
export class SessionClock {
    private elapsed = 0;

    constructor(
        readonly durationMs: number,
        private rate = 1,
    ) {}

    /** Milliseconds left. Never negative. */
    get remainingMs(): number {
        return Math.max(0, this.durationMs - this.elapsed);
    }

    get expired(): boolean {
        return this.remainingMs <= 0;
    }

    update(dt: number): void {
        if (this.expired) return;
        this.elapsed += dt * this.rate;
    }

    /**
     * Press harder by `step`, from here on.
     *
     * The rate only ever rises, so a clean run keeps the authored pace while a
     * run full of mistakes runs its stage out early. See `MISS_CLOCK_STEP` in
     * `PlayScreen` for what currently drives this.
     */
    hurry(step: number): void {
        this.rate += step;
    }
}

/**
 * Whole seconds to show for `remainingMs`.
 *
 * Deliberately `floor`, not `ceil`. Rounding up held every number on screen a
 * second too long and only reached 0 *after* the stage had ended, so a 10s
 * stage read 10 → 1. Flooring makes it open on 9 and count 9 → 0, so the digit
 * the player reads is the time they actually have left.
 */
export function secondsRemaining(remainingMs: number): number {
    return Math.floor(remainingMs / 1000);
}
