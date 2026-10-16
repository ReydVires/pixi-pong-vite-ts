import type { Component } from '../core/entities/Component';
import type { Ball } from './Ball';
import type { Paddle } from './Paddle';

export interface PaddleAIOptions {
    /**
     * How far the paddle aims from the ball center (aim error, in px). @default 0
     */
    aimOffset?: number;
    /** X the paddle drifts back to when the ball is moving away. @default playfield center */
    homeX?: number;
}

/**
 * Drives a `Paddle` to track the ball — the opponent in the Pong demo.
 *
 * Only chases while the ball is moving toward the paddle's goal; otherwise it
 * drifts back toward the middle, which reads as "thinking" and keeps rallies
 * winnable. Speed is capped so the AI is beatable.
 *
 * ```ts
 * paddle.addComponent(new Paddle(paddle, { bounds }));
 * paddle.addComponent(new PaddleAI(paddle, ball, { speed: 420 }));
 * ```
 */
export class PaddleAI implements Component {
    private readonly aimOffset: number;
    private readonly homeX: number;

    constructor(
        private readonly paddle: Paddle,
        private readonly ball: Ball,
        private readonly ballPosition: { x: number; y: number },
        private readonly defendsTop: boolean,
        options: PaddleAIOptions = {},
    ) {
        this.aimOffset = options.aimOffset ?? 0;
        this.homeX = options.homeX ?? 384;
    }

    update(_dt: number): void {
        const ballComing = this.defendsTop ? this.ball.directionY < 0 : this.ball.directionY > 0;

        if (ballComing) {
            // Predict where the ball crosses the paddle line, with a small aim error.
            this.paddle.setTargetX(this.ballPosition.x + this.aimOffset);
        } else {
            // Drift home between returns.
            this.paddle.setTargetX(this.homeX);
        }
    }
}
