import type { Component } from '../core/entities/component';

/**
 * The kick a combo milestone gives the playfield.
 *
 * Short and small on purpose: hit testing reads the holes' own slots, so the
 * shake is decoration taps never see, and it has to be over before the player
 * needs to aim again. The amplitude dies with the square of the time left,
 * which is what makes it read as one hit rather than a wobble.
 */
const SHAKE_MS = 320;
const SHAKE_AMPLITUDE = 10;
/** Two rates, in ms per radian, so the axes never move as one neat wobble. */
const SHAKE_X_RATE = 21;
const SHAKE_Y_RATE = 14;
/** How much of the kick goes sideways — a field shakes more than it bounces. */
const SHAKE_Y_SCALE = 0.7;

/**
 * Shakes its target's position for a short burst, then puts it back exactly
 * where it belongs.
 *
 * Both axes start at zero and the amplitude dies with the clock left, so the
 * target is never snapped sideways the frame a kick lands, and never left
 * sitting off-centre once the kick is over.
 *
 * ```ts
 * const field = new Entity();
 * const shake = field.addComponent(new Shake(field));
 * shake.kick(); // on a combo milestone
 * ```
 */
export class Shake implements Component {
    private left = 0;
    private time = 0;

    constructor(private readonly target: { x: number; y: number }) {}

    /** Start (or restart) the kick. */
    kick(): void {
        this.left = SHAKE_MS;
        this.time = 0;
    }

    update(dt: number): void {
        if (this.left <= 0) {
            if (this.target.x !== 0 || this.target.y !== 0) {
                this.target.x = 0;
                this.target.y = 0;
            }
            return;
        }

        this.left = Math.max(0, this.left - dt);
        this.time += dt;

        const amp = SHAKE_AMPLITUDE * (this.left / SHAKE_MS) ** 2;
        this.target.x = Math.sin(this.time / SHAKE_X_RATE) * amp;
        this.target.y = Math.sin(this.time / SHAKE_Y_RATE) * amp * SHAKE_Y_SCALE;
    }
}
