import type { Component } from '../core/entities/Component';
import type { KeyboardInput, KeyCode } from '../core/input/KeyboardInput';
import type { Paddle } from './Paddle';

export interface PaddleKeysOptions {
    /** Key that moves the paddle toward smaller x. */
    left: KeyCode;
    /** Key that moves the paddle toward larger x. */
    right: KeyCode;
    /** Target speed while a key is held, in design px per second. @default 700 */
    speed?: number;
}

/**
 * Drives a `Paddle` from held keyboard keys — the keyboard twin of
 * `PaddleController` (which is pointer-driven). Both can be attached to the
 * same paddle; whichever sets a target last wins for that frame.
 *
 * ```ts
 * paddle.addComponent(new PaddleKeys(keyboard, paddle, { left: 'ArrowLeft', right: 'ArrowRight' }));
 * ```
 */
export class PaddleKeys implements Component {
    private readonly speed: number;

    constructor(
        private readonly keyboard: KeyboardInput,
        private readonly paddle: Paddle,
        private readonly keys: PaddleKeysOptions,
    ) {
        this.speed = keys.speed ?? 700;
    }

    update(dt: number): void {
        const direction =
            (this.keyboard.isDown(this.keys.right) ? 1 : 0) - (this.keyboard.isDown(this.keys.left) ? 1 : 0);

        if (direction === 0) return;

        // Nudge the target from the paddle's current target; Paddle caps the speed.
        this.paddle.setTargetX(this.paddle.getTargetX() + direction * this.speed * (dt / 1000));
    }
}
