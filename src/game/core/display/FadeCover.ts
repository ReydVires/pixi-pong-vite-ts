import type { Container } from 'pixi.js';
import { COLORS } from '../../config';
import { OneShot } from '../entities/OneShot';
import type { Responsive } from '../responsive/Responsive';
import type { Nullable } from '../types';
import { createColorBackground } from './background';
import { Fade } from './Fade';

/** Fade up from black as a screen arrives, in ms. */
export const FADE_IN_MS = 650;

/**
 * A full-bleed black cover that fades out as a screen arrives.
 *
 * Mounted in `ui` by the constructor and driven by its `Fade` component;
 * `finished` reports when the cover is clear. Until then it hides everything
 * underneath — which is the point: the scene finishes assembling (async assets,
 * layout, the lot) behind an opaque cover instead of popping in piece by piece.
 *
 * Shared by every screen that arrives through it, so the fade always takes the
 * same length of time wherever the player navigates from.
 *
 * ```ts
 * this.cover = new FadeCover(ui, responsive);
 * // update(dt): this.cover = tickCover(this.cover, dt);
 * ```
 */
export class FadeCover extends OneShot {
    private readonly fade: Fade;

    constructor(ui: Container, responsive: Responsive) {
        super();

        this.addChild(createColorBackground(COLORS.black, responsive));
        this.fade = this.addComponent(new Fade(this, { from: 1, to: 0, ms: FADE_IN_MS }));
        ui.addChild(this);
    }

    /** True once the cover is clear. */
    get finished(): boolean {
        return this.fade.finished;
    }

    /** Unmount and free the cover; only call once `finished` is true. */
    dispose(): void {
        this.removeFromParent();
        this.destroy({ children: true });
    }
}

/**
 * Tick a fade cover and drop it once it has finished.
 *
 * Owner-side on purpose: a one-shot never removes itself, so a screen treats
 * the cover like any other `OneShot`.
 */
export function tickCover(cover: Nullable<FadeCover>, dt: number): Nullable<FadeCover> {
    if (!cover) return null;

    cover.update(dt);
    if (!cover.finished) return cover;

    cover.dispose();
    return null;
}
