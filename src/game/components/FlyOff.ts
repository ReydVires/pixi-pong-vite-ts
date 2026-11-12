import type { Container } from 'pixi.js';
import type { Component } from '../core/ecs/Component';

export interface FlyOffOptions {
    /** How far the target rises by the end, in px. */
    rise: number;
    /** Rotation at the end, in radians. */
    spin: number;
    /** Extra scale at the end — `0.2` means it ends 1.2x. */
    growth: number;
    /** Duration in ms. */
    ms: number;
}

/**
 * Tosses one layer off its host: it accelerates away, tumbles, grows and
 * fades, then hides itself.
 *
 * For parts that have to *leave* rather than dissolve — a ribbon whose bow is
 * drawn exactly where the face behind it ends up. It is linear on purpose:
 * a pull should keep accelerating, not ease out into a float.
 *
 * ```ts
 * const untie = entity.addComponent(new FlyOff(ribbon, { rise: 150, spin: 0.5, growth: 0.2, ms: 460 }));
 * untie.start(); // when the host opens
 * ```
 */
export class FlyOff implements Component {
    private readonly rise: number;
    private readonly spin: number;
    private readonly growth: number;
    private readonly ms: number;
    private left = 0;

    constructor(
        private readonly target: Container,
        options: FlyOffOptions,
    ) {
        this.rise = options.rise;
        this.spin = options.spin;
        this.growth = options.growth;
        this.ms = options.ms;
    }

    /** Put the target back at rest and start the toss. */
    start(): void {
        this.target.y = 0;
        this.target.rotation = 0;
        this.target.scale.set(1);
        this.target.alpha = 1;
        this.target.visible = true;
        this.left = this.ms;
    }

    update(dt: number): void {
        if (this.left <= 0) return;

        this.left = Math.max(0, this.left - dt);
        const t = 1 - this.left / this.ms;

        this.target.y = -this.rise * t * t;
        this.target.rotation = this.spin * t;
        this.target.scale.set(1 + this.growth * t);
        this.target.alpha = 1 - t;

        if (this.left === 0) this.target.visible = false;
    }
}
