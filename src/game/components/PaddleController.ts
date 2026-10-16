import type { Component } from '../core/entities/Component';
import type { Paddle } from './Paddle';

/**
 * Maps pointer movement onto a `Paddle`'s target position — the player's
 * controls in the Pong demo.
 *
 * The screen feeds it world-space x coordinates (via `responsive.toWorld`),
 * so it works identically for mouse and touch.
 *
 * ```ts
 * const controller = paddle.addComponent(new PaddleController(paddle));
 * this.stopMove = input.onMove((event) => controller.moveTo(responsive.toWorld(event).x));
 * ```
 */
export class PaddleController implements Component {
    constructor(private readonly paddle: Paddle) {}

    /** Point the paddle at a world-space x coordinate. */
    moveTo(x: number): void {
        this.paddle.setTargetX(x);
    }

    update(_dt: number): void {
        // Movement itself is handled by the Paddle component; nothing per-frame.
    }
}
