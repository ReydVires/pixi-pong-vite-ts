import { Graphics } from 'pixi.js';
import { Entity } from '../core/entities/Entity';

export interface ShockwaveOptions {
    /** Centre in design/world units. */
    x: number;
    y: number;
    fromRadius: number;
    toRadius: number;
    /** Full expansion time in ms. */
    ms: number;
    color: number;
    /** Stroke width at the start; it thins out as the ring grows. */
    width?: number;
}

/**
 * A ring that expands and fades once — the tell that something just swept the
 * whole field rather than one hole.
 *
 * `toRadius` is authored per use, not derived, so the ring can be tuned to stop
 * short of the HUD or reach past the last hole depending on what it is selling.
 * Like `Burst` it owns its lifetime and reports `finished`.
 */
export class Shockwave extends Entity {
    private readonly options: ShockwaveOptions;
    private readonly ring = new Graphics();
    private elapsed = 0;

    constructor(options: ShockwaveOptions) {
        super();

        this.options = options;
        this.position.set(options.x, options.y);
        this.addChild(this.ring);
        this.draw(0);
    }

    get finished(): boolean {
        return this.elapsed >= this.options.ms;
    }

    override update(dt: number): void {
        super.update(dt);
        this.elapsed += dt;
        this.draw(Math.min(1, this.elapsed / this.options.ms));
    }

    /** `t` is the eased progress, 0..1 across the whole expansion. */
    private draw(t: number): void {
        const { fromRadius, toRadius, color, width = 10 } = this.options;
        const eased = 1 - (1 - t) * (1 - t);
        const radius = fromRadius + (toRadius - fromRadius) * eased;

        this.ring.clear().circle(0, 0, radius).stroke({ width: width * (1 - t) + 1, color });
        this.alpha = 1 - t;
    }
}
