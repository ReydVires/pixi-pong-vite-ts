import type { Component } from '../core/ecs/Component';

/** What `Punch` drives — anything with a scale. */
export interface PunchTarget {
    scale: { set(x: number, y: number): void };
}

export interface PunchOptions {
    /** Extra scale at the moment of the punch — `0.28` means 1.28x. */
    amount: number;
    /** How long it takes to settle back to 1, in ms. */
    ms: number;
}

/**
 * A scale punch on demand: `start()` kicks the target up by `amount`, and it
 * eases back to its resting size over `ms`.
 *
 * Unlike a tween it holds the property every frame, so nothing else can leave
 * it stuck mid-punch. Calls before the first `start()` keep it at 1.
 *
 * ```ts
 * const punch = entity.addComponent(new Punch(entity, { amount: 0.25, ms: 300 }));
 * punch.start(); // on the beat worth celebrating
 * ```
 */
export class Punch implements Component {
    private readonly amount: number;
    private readonly ms: number;
    private left = 0;

    constructor(
        private readonly target: PunchTarget,
        options: PunchOptions,
    ) {
        this.amount = options.amount;
        this.ms = options.ms;
    }

    /** Start (or restart) the punch. */
    start(): void {
        this.left = this.ms;
    }

    update(dt: number): void {
        if (this.left > 0) this.left = Math.max(0, this.left - dt);

        const scale = 1 + this.amount * (this.left / this.ms);
        this.target.scale.set(scale, scale);
    }
}
