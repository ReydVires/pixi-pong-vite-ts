import type { Component } from '../core/entities/component';

export interface PulseOptions {
    /**
     * Minimum scale multiplier. @default 0.9
     */
    min?: number;
    /**
     * Maximum scale multiplier. @default 1.1
     */
    max?: number;
    /**
     * Full pulse cycle duration in milliseconds. @default 1200
     */
    periodMs?: number;
}

/**
 * Gently scales its target up and down in a sine wave.
 *
 * A composable behavior like any other: it stacks with e.g. `Spin` on the same
 * entity, each driving a different property.
 *
 * ```ts
 * const logo = new Entity();
 * logo.addComponent(new Spin(logo, { speed: 30 }));
 * logo.addComponent(new Pulse(logo, { periodMs: 1500 }));
 * ```
 */
export class Pulse implements Component {
    private readonly min: number;
    private readonly max: number;
    private readonly periodMs: number;
    private elapsed = 0;

    constructor(private readonly target: { scale: { set(x: number, y: number): void } }, options: PulseOptions = {}) {
        this.min = options.min ?? 0.9;
        this.max = options.max ?? 1.1;
        this.periodMs = options.periodMs ?? 1200;
    }

    update(dt: number): void {
        this.elapsed = (this.elapsed + dt) % this.periodMs;

        // 0..1 phase across the cycle, then map onto a sine wave between min and max.
        const phase = (this.elapsed / this.periodMs) * Math.PI * 2;
        const scale = this.min + (this.max - this.min) * (0.5 + 0.5 * Math.sin(phase));
        this.target.scale.set(scale, scale);
    }
}
