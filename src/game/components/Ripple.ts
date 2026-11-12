import { Graphics } from 'pixi.js';
import type { Container } from 'pixi.js';
import type { Component } from '../core/ecs/Component';

export interface RippleOptions {
    fromRadius: number;
    toRadius: number;
    /** Full expansion time in ms. */
    ms: number;
    color: number;
    /** Stroke width at the start; it thins out as the ring grows. */
    width?: number;
}

/**
 * A ring that expands and fades exactly once — the tell that something swept
 * the whole field rather than one hole.
 *
 * `toRadius` is authored per use, not derived, so the ring can be tuned to stop
 * short of the HUD or reach past the last hole depending on what it is selling.
 * `finished` turns true when the expansion completes.
 */
export class Ripple implements Component {
    private readonly ring = new Graphics();
    private readonly fromRadius: number;
    private readonly toRadius: number;
    private readonly ms: number;
    private readonly color: number;
    private readonly width: number;
    private elapsed = 0;

    constructor(owner: Container, options: RippleOptions) {
        this.fromRadius = options.fromRadius;
        this.toRadius = options.toRadius;
        this.ms = options.ms;
        this.color = options.color;
        this.width = options.width ?? 10;

        owner.addChild(this.ring);
        this.draw(0);
    }

    /** True once the ring has finished expanding. */
    get finished(): boolean {
        return this.elapsed >= this.ms;
    }

    update(dt: number): void {
        this.elapsed += dt;
        this.draw(Math.min(1, this.elapsed / this.ms));
    }

    /** `t` is the eased progress, 0..1 across the whole expansion. */
    private draw(t: number): void {
        const eased = 1 - (1 - t) * (1 - t);
        const radius = this.fromRadius + (this.toRadius - this.fromRadius) * eased;

        this.ring.clear().circle(0, 0, radius).stroke({ width: this.width * (1 - t) + 1, color: this.color });
        this.ring.alpha = 1 - t;
    }
}
