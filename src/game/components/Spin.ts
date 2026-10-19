import type { Component } from '../core/entities/component';

export interface SpinOptions {
    /**
     * Rotation speed in degrees per second. Positive values spin clockwise.
     * @default 30
     */
    speed?: number;
}

/**
 * Rotates its target every frame — a minimal example of a composable behavior.
 *
 * ```ts
 * const logo = new Entity();
 * logo.addComponent(new Spin(logo, { speed: 45 }));
 * ```
 */
export class Spin implements Component {
    private readonly radiansPerSecond: number;

    constructor(private readonly target: { rotation: number }, options: SpinOptions = {}) {
        this.radiansPerSecond = ((options.speed ?? 30) * Math.PI) / 180;
    }

    update(dt: number): void {
        this.target.rotation += this.radiansPerSecond * (dt / 1000);
    }
}
