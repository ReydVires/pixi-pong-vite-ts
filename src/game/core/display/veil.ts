import type { Container, Graphics } from 'pixi.js';
import { COLORS } from '../../config';
import type { Responsive } from '../responsive/Responsive';
import { createColorBackground } from './background';

/** Fade up from black as a screen arrives, in ms. */
export const FADE_IN_MS = 650;

/**
 * The black sheet a screen fades up from on arrival.
 *
 * Mounted full-bleed in `ui` by the constructor and faded by `update(dt)`; once
 * it is gone it destroys itself and `update` returns `true` so the screen can
 * drop the reference. Until then it is just an opaque sheet over everything —
 * which is the point: the scene underneath finishes assembling (async assets,
 * layout, the lot) behind a cover instead of popping in as each piece lands.
 *
 * Shared by every screen that arrives through it, so the fade always takes the
 * same length of time wherever the player navigates from.
 *
 * ```ts
 * this.veil = new ScreenVeil(ui, responsive);
 * // update(dt): if (this.veil?.update(dt)) this.veil = null;
 * ```
 */
export class ScreenVeil {
    /** The black sheet itself, mounted in `ui` by the constructor. */
    private readonly view: Graphics;
    /** Time left on the fade. */
    private left = FADE_IN_MS;

    constructor(ui: Container, responsive: Responsive) {
        this.view = createColorBackground(COLORS.black, responsive);
        ui.addChild(this.view);
    }

    /** Fade the sheet away. Returns `true` once it has gone (and destroyed itself). */
    update(dt: number): boolean {
        this.left = Math.max(0, this.left - dt);
        this.view.alpha = this.left / FADE_IN_MS;
        if (this.left > 0) return false;

        this.view.destroy();
        return true;
    }
}
