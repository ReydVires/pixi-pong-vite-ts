/**
 * Countdown for timed stages.
 *
 * Purely time-based: the stage feeds it `dt` from the screen's `update()`, so
 * pausing the screen simply stops feeding it. Nothing here reads the frame
 * rate, the wall clock, or the DOM.
 */
export class SessionClock {
    private elapsed = 0;

    constructor(readonly durationMs: number) {}

    /** Milliseconds left. Never negative. */
    get remainingMs(): number {
        return Math.max(0, this.durationMs - this.elapsed);
    }

    get expired(): boolean {
        return this.remainingMs <= 0;
    }

    update(dt: number): void {
        if (this.expired) return;
        this.elapsed += dt;
    }
}
