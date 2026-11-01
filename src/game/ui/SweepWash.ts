import type { Container } from 'pixi.js';
import { COLORS } from '../config';
import { createColorBackground } from '../core/display/background';
import { Fade } from '../core/display/Fade';
import { Entity } from '../core/entities/Entity';
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
 * field) and simply calls `fire()`; the wash times itself, so the screen keeps
 * no flash timer of its own. Mounted in `ui` right after the HUD chrome and
 * before the first overlay, so pausing still dims over the top of it — and
 * left non-interactive, so it can never swallow a tap.
 */
export class SweepWash extends Entity {
    private readonly fade: Fade;

    constructor(ui: Container, responsive: Responsive) {
        super();

        this.addChild(createColorBackground(COLORS.star, responsive));
        this.fade = this.addComponent(
            new Fade(this, { from: WASH_PEAK, to: 0, ms: WASH_MS, autoPlay: false }),
        );
        this.alpha = 0;
        ui.addChild(this);
    }

    /** Light the wash at full strength; it fades out over the next `WASH_MS`. */
    fire(): void {
        this.fade.start();
    }
}
