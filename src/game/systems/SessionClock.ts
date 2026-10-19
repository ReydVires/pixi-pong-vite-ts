/**
 * Countdown for timed stages.
 *
 * Purely time-based: the stage feeds it `dt` from the screen's `update()`, so
 * pausing the screen simply stops feeding it. Nothing here reads the frame
 * rate, the wall clock, or the DOM.
 *
 * `rate` drains faster than real time: 1.5 means a stage declared as 60s runs
 * out in 40s of wall clock. It is a *feel* knob — the stage table keeps owning
 * the authored duration, this only decides how hard the clock presses.
 */
export class SessionClock {
    private elapsed = 0;

    constructor(
        readonly durationMs: number,
        readonly rate = 1,
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
}
