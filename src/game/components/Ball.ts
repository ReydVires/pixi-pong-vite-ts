import type { Component } from '../core/entities/Component';

export interface BallOptions {
    /** Horizontal speed in design px per second. @default 320 */
    speedX?: number;
    /** Vertical speed in design px per second. @default 320 */
    speedY?: number;
    /** Ball radius in design px. @default 12 */
    radius?: number;
}

/**
 * Moves a ball-shaped target and bounces it off the left/right walls.
 *
 * The screen owns the top/bottom edges — a ball leaving the playfield there
 * is a point, not a bounce — so it reads `state` after ticking the entity.
 *
 * ```ts
 * const ball = new Entity();
 * ball.addChild(createBallVisual());
 * const motion = ball.addComponent(new Ball(ball, { speedX: 320, speedY: 320 }));
 * ```
 */
export class Ball implements Component {
    readonly radius: number;
    velocityX: number;
    velocityY: number;

    constructor(
        private readonly target: { x: number; y: number },
        options: BallOptions = {},
    ) {
        this.radius = options.radius ?? 12;
        this.velocityX = options.speedX ?? 320;
        this.velocityY = options.speedY ?? 320;
    }

    /** Bounce direction: -1 = moving left, +1 = moving right. */
    get directionX(): number {
        return Math.sign(this.velocityX) || 1;
    }

    /** Bounce direction: -1 = moving up, +1 = moving down. */
    get directionY(): number {
        return Math.sign(this.velocityY) || 1;
    }

    /** Reverse horizontal direction and speed up slightly (rally pacing). */
    bounceX(speedUp = 1.04): void {
        this.velocityX = -this.velocityX * speedUp;
    }

    /** Reverse vertical direction (paddle hit). */
    bounceY(): void {
        this.velocityY = -this.velocityY;
    }

    update(dt: number): void {
        const seconds = dt / 1000;
        this.target.x += this.velocityX * seconds;
        this.target.y += this.velocityY * seconds;
    }
}
