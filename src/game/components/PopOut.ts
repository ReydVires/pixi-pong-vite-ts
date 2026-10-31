import type { Container } from 'pixi.js';
import type { Component } from '../core/entities/component';
import { Easing } from '../systems/TweenSystem';

export interface PopOutOptions {
    /** Local y the target rests at once it has popped out. */
    restY: number;
    /** How far below `restY` it starts, in px. */
    rise: number;
    /** Spring duration in ms. */
    ms: number;
    /** Overshoot factor — `1` is a plain ease-out, higher overshoots more. */
    spring: number;
    /** Idle sway amplitude after the pop, in radians. Omit for no sway. */
    swayRadians?: number;
    /** Phase divisor of the sway sine — larger is slower. @default 520 */
    swayPhaseMs?: number;
}

/**
 * Reveals a hidden child by springing it up from below `restY`, then keeps a
 * slow sway going so a still face does not look like a sticker on the lid.
 *
 * The rise and the growth share one clock, so there is a single moment where
 * the target is full size and has overshot its resting height — appearing and
 * *then* jumping reads as two separate effects.
 *
 * ```ts
 * const pop = entity.addComponent(new PopOut(face, { restY, rise: 150, ms: 620, spring: 1.8 }));
 * pop.start(); // when the box opens
 * ```
 */
export class PopOut implements Component {
    private readonly restY: number;
    private readonly rise: number;
    private readonly ms: number;
    private readonly spring: number;
    private readonly swayRadians: number;
    private readonly swayPhaseMs: number;
    private left = 0;
    private swayTime = 0;

    constructor(
        private readonly target: Container,
        options: PopOutOptions,
    ) {
        this.restY = options.restY;
        this.rise = options.rise;
        this.ms = options.ms;
        this.spring = options.spring;
        this.swayRadians = options.swayRadians ?? 0;
        this.swayPhaseMs = options.swayPhaseMs ?? 520;
    }

    /** Reveal the target and start the spring. */
    start(): void {
        this.target.visible = true;
        this.target.y = this.restY + this.rise;
        this.target.scale.set(0.05);
        this.swayTime = 0;
        this.left = this.ms;
    }

    update(dt: number): void {
        if (!this.target.visible) return;

        if (this.left > 0) {
            this.left = Math.max(0, this.left - dt);
            const t = 1 - this.left / this.ms;

            this.target.y = this.restY + this.rise * (1 - Easing.easeOutBack(t, this.spring));
            const scale = 0.05 + 0.95 * Easing.easeOutBack(Math.min(1, t * 1.4), this.spring);
            this.target.scale.set(scale);
            return;
        }

        if (this.swayRadians === 0) return;

        this.swayTime += dt;
        this.target.y = this.restY;
        this.target.scale.set(1);
        this.target.rotation = Math.sin(this.swayTime / this.swayPhaseMs) * this.swayRadians;
    }
}
