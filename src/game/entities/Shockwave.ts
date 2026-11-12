import { Ripple } from '../components/Ripple';
import type { RippleOptions } from '../components/Ripple';
import { OneShot } from '../core/ecs/OneShot';

export interface ShockwaveOptions extends RippleOptions {
    /** Centre in design/world units. */
    x: number;
    y: number;
}

/**
 * A ring that expands and fades once — the tell that something just swept the
 * whole field rather than one hole.
 *
 * A positioned `OneShot` around `Ripple`: the component owns the expansion and
 * the drawing, and this class only places it and forwards `finished`.
 */
export class Shockwave extends OneShot {
    private readonly ripple: Ripple;

    constructor(options: ShockwaveOptions) {
        super();
        this.position.set(options.x, options.y);
        this.ripple = this.addComponent(new Ripple(this, options));
    }

    get finished(): boolean {
        return this.ripple.finished;
    }
}
