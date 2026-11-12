import type { Component } from '../core/ecs/Component';
import { Easing } from '../core/tween';

/** What `DropIn` drives — anything with a vertical position. */
export interface DropInTarget {
    y: number;
}

export interface DropInOptions {
    /**
     * Where it falls in from. A getter rather than a number, so a resize during
     * the drop still starts off the edge of what is actually visible.
     */
    startY: () => number;
    /** Where it comes to rest. */
    restY: number;
    /** Fall duration in ms. */
    ms: number;
    /** Height of the idle hover around `restY`, in px. Omit for no hover. */
    bobAmplitude?: number;
    /** Phase divisor of the hover sine — larger is slower. @default 620 */
    bobPhaseMs?: number;
}

/**
 * Drops its target in from `startY()` to `restY`, overshooting before it
 * settles, then lets it hover there.
 *
 * The drop and the hover share one clock, so the moment the fall ends is the
 * moment the bob begins — no gap where a still object reads as part of the
 * backdrop. An `easeOutBack` landing is what gives it weight.
 *
 * ```ts
 * const gift = new Entity();
 * gift.addComponent(new DropIn(gift, { startY, restY: 500, ms: 900, bobAmplitude: 7 }));
 * ```
 */
export class DropIn implements Component {
    private readonly startY: () => number;
    private readonly restY: number;
    private readonly ms: number;
    private readonly bobAmplitude: number;
    private readonly bobPhaseMs: number;
    private left: number;
    private bobTime = 0;

    constructor(
        private readonly target: DropInTarget,
        options: DropInOptions,
    ) {
        this.startY = options.startY;
        this.restY = options.restY;
        this.ms = options.ms;
        this.bobAmplitude = options.bobAmplitude ?? 0;
        this.bobPhaseMs = options.bobPhaseMs ?? 620;
        this.left = options.ms;
    }

    update(dt: number): void {
        if (this.left > 0) {
            this.left = Math.max(0, this.left - dt);
            const landed = Easing.easeOutBack(1 - this.left / this.ms);
            const start = this.startY();
            this.target.y = start + (this.restY - start) * landed;
            return;
        }

        if (this.bobAmplitude === 0) return;
        this.bobTime += dt;
        this.target.y = this.restY + Math.sin(this.bobTime / this.bobPhaseMs) * this.bobAmplitude;
    }
}
