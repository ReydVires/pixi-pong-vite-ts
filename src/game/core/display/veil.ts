import type { Container } from 'pixi.js';
import { COLORS } from '../../config';
import { Entity } from '../entities/Entity';
import type { Responsive } from '../responsive/Responsive';
import { createColorBackground } from './background';
import { Fade } from './fade';

/** Fade up from black as a screen arrives, in ms. */
export const FADE_IN_MS = 650;

/**
 * The black sheet a screen fades up from on arrival.
 *
 * Mounted full-bleed in `ui` by the constructor and faded by `update(dt)`; once
 * it is gone it removes and destroys itself and `update` returns `true` so the
 * screen can drop the reference. Until then it is just an opaque sheet over
 * everything — which is the point: the scene underneath finishes assembling
 * (async assets, layout, the lot) behind a cover instead of popping in as each
 * piece lands.
 *
 * Shared by every screen that arrives through it, so the fade always takes the
 * same length of time wherever the player navigates from.
 *
 * ```ts
 * this.veil = new ScreenVeil(ui, responsive);
 * // update(dt): if (this.veil?.update(dt)) this.veil = null;
 * ```
 */
export class ScreenVeil extends Entity {
    private readonly fade: Fade;

    constructor(ui: Container, responsive: Responsive) {
        super();

        this.addChild(createColorBackground(COLORS.black, responsive));
        this.fade = this.addComponent(new Fade(this, { from: 1, to: 0, ms: FADE_IN_MS }));
        ui.addChild(this);
    }

    /** Fade the sheet away. Returns `true` once it has gone (and destroyed itself). */
    override update(dt: number): boolean {
        super.update(dt);
        if (!this.fade.finished) return false;

        this.removeFromParent();
        this.destroy({ children: true });
        return true;
    }
}
