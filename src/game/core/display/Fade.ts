import type { Component } from '../entities/component';

/** Anything with an alpha channel — a Container, a Sprite, a Graphics. */
export interface FadeTarget {
    alpha: number;
}

export interface FadeOptions {
    /** Alpha at the start. */
    from: number;
    /** Alpha at the end. */
    to: number;
    /** Duration in ms. */
    ms: number;
    /** Start on construction. @default true */
    autoPlay?: boolean;
}

/**
 * A one-shot alpha fade, restartable with `start()`.
 *
 * Attached as a component so a display object can fade itself without owning a
 * clock: `FadeCover` fades a black cover off on arrival, `SweepWash` burns a
 * tint off the field, and both are an entity with this attached. The constructor
 * only
 * writes alpha when it is about to play, so a sheet that is armed later stays
 * clear until then.
 */
export class Fade implements Component {
    private left = 0;
    private running = false;
    private readonly from: number;
    private readonly to: number;
    private readonly ms: number;

    constructor(
        private readonly target: FadeTarget,
        options: FadeOptions,
    ) {
        this.from = options.from;
        this.to = options.to;
        this.ms = options.ms;

        if (options.autoPlay ?? true) this.start();
    }

    /** True once the fade has run out (or before it was ever started). */
    get finished(): boolean {
        return !this.running;
    }

    /** Start over from `from`. */
    start(): void {
        this.left = this.ms;
        this.running = true;
        this.target.alpha = this.from;
    }

    update(dt: number): void {
        if (!this.running) return;

        this.left = Math.max(0, this.left - dt);
        const progress = 1 - this.left / this.ms;
        this.target.alpha = this.from + (this.to - this.from) * progress;
        if (this.left === 0) this.running = false;
    }
}
