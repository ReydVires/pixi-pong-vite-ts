import type { Container, Graphics } from 'pixi.js';
import { COLORS } from '../config';
import { createColorBackground } from '../core/display/background';
import type { Responsive } from '../core/responsive/Responsive';

/** How long the wash takes to fade back out, in ms. */
const WASH_MS = 240;
/** How strong it gets: a tint over the field, not a whiteout. */
const WASH_PEAK = 0.25;

/**
 * The golden's full-screen wash: a gold tint over the whole field that lights
 * up when a sweep fires it and fades back out over its own duration.
 *
 * Presentation only — `PlayScreen` owns the rule (a `clear` effect sweeps the
 * field) and simply calls `arm()`; the wash times itself, so the screen keeps
 * no flash timer of its own. Mounted in `ui` right after the HUD chrome and
 * before the first overlay, so pausing still dims over the top of it — and
 * left non-interactive, so it can never swallow a tap.
 */
export class SweepWash {
    private readonly view: Graphics;
    /** Milliseconds left on the fade. */
    private left = 0;

    constructor(ui: Container, responsive: Responsive) {
        this.view = createColorBackground(COLORS.star, responsive);
        this.view.alpha = 0;
        ui.addChild(this.view);
    }

    /** Light the wash at full strength; it fades out over the next `WASH_MS`. */
    arm(): void {
        this.left = WASH_MS;
    }

    /** Tick the fade. A no-op once the wash has burnt out. */
    update(dt: number): void {
        if (this.left <= 0) return;
        this.left = Math.max(0, this.left - dt);
        this.view.alpha = WASH_PEAK * (this.left / WASH_MS);
    }
}
