import { Entity } from './Entity';

/**
 * An entity with a lifetime its owner can poll.
 *
 * `finished` is the only extra promise: once it is true the owner may unmount
 * and destroy the entity. One-shots never remove themselves — the screen or
 * system that owns one does that — so every short-lived thing (`Burst`,
 * `Shockwave`, `FadeCover`) leaves through the same door.
 *
 * It is still an `Entity`: the timing lives in a component (`Sparks`, `Ripple`,
 * `Fade`) and this class only forwards the answer.
 */
export abstract class OneShot extends Entity {
    abstract get finished(): boolean;
}
