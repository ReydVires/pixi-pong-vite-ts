import type { Component } from '../core/entities/Component';

export interface PaddleOptions {
    /** Paddle width in design px. @default 140 */
    width?: number;
    /** Paddle height in design px. @default 24 */
    height?: number;
    /** Horizontal movement speed in design px per second. @default 900 */
    speed?: number;
    /** Playfield bounds the paddle may not leave. */
    bounds: { minX: number; maxX: number };
}

/**
 * Glides a paddle toward `targetX`, clamped to the playfield.
 *
 * The paddle never teleports — it moves at a capped speed — which keeps the
 * game fair for both the pointer-driven player and the AI.
 *
 * ```ts
 * const paddle = new Entity();
 * paddle.addChild(createPaddleVisual());
 * paddle.addComponent(new Paddle(paddle, { bounds: { minX: 0, maxX: 768 } }));
 * ```
 */
export class Paddle implements Component {
    readonly width: number;
    readonly height: number;
    private readonly speed: number;
    private bounds: { minX: number; maxX: number };
    private targetX: number;

    constructor(
        private readonly target: { x: number },
        options: PaddleOptions,
    ) {
        this.width = options.width ?? 140;
        this.height = options.height ?? 24;
        this.speed = options.speed ?? 900;
        this.bounds = options.bounds;
        this.targetX = target.x;
    }

    /** Where the paddle wants to be; movement is capped by `speed`. */
    setTargetX(x: number): void {
        this.targetX = x;
    }

    /** The current target x (useful for relative nudges from keyboard control). */
    getTargetX(): number {
        return this.targetX;
    }

    /** Update the playfield bounds (e.g. when the viewport resizes). */
    setBounds(bounds: { minX: number; maxX: number }): void {
        this.bounds = bounds;
    }

    /** Half-width, handy for collision math. */
    get halfWidth(): number {
        return this.width / 2;
    }

    update(dt: number): void {
        const seconds = dt / 1000;
        const distance = this.targetX - this.target.x;
        const step = Math.min(Math.abs(distance), this.speed * seconds);

        this.target.x += Math.sign(distance) * step;
        this.target.x = Math.max(
            this.bounds.minX + this.halfWidth,
            Math.min(this.bounds.maxX - this.halfWidth, this.target.x),
        );
    }
}
