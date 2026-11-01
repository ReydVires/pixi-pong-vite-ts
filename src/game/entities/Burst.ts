import { Sparks } from '../components/Sparks';
import { OneShot } from '../core/entities/OneShot';
import type { BurstOptions } from '../systems/particles';

/**
 * A one-shot cloud of confetti-coloured particles.
 *
 * A `OneShot` wrapped around a single `Sparks` component: the entity is the
 * lifetime handle the effects system keeps, and the component owns the motion
 * and the drawing. It lives in world coordinates and never moves.
 */
export class Burst extends OneShot {
    private readonly sparks: Sparks;

    constructor(color: number, options: BurstOptions) {
        super();
        this.sparks = this.addComponent(new Sparks(this, color, options));
    }

    get finished(): boolean {
        return this.sparks.finished;
    }
}
