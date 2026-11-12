import { Entity } from './Entity';

/**
 * An entity whose owner can poll when its life is over.
 *
 * `finished` is the only extra promise: once it is true the owner may unmount
 * and destroy the entity. A one-shot never removes itself — the pool that owns
 * it does — so every short-lived thing (`Burst`, `Shockwave`, `FadeCover`)
 * leaves through the same door.
 *
 * The timing still lives in a component (`Sparks`, `Ripple`, `Fade`); this
 * class only forwards the answer.
 */
export abstract class OneShot extends Entity {
    abstract get finished(): boolean;
}
