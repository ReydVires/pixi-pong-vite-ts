import { Graphics } from 'pixi.js';
import { SFX } from '../audio/sfx';
import { CELEBRATION, COLORS, SCREENS, SCREEN_CENTER } from '../config';
import { createColorBackground } from '../core/display/background';
import { createLabel } from '../core/display/label';
import { createSceneButton } from '../core/display/sceneButton';
import type { Screen, ScreenContext } from '../core/screens/screen';

/** Vertical rhythm, top to bottom. */
const TITLE_Y = 190;
/** Where the body starts — under the title, with room for its own first line. */
const BODY_TOP = 300;
/** Width the letter's words wrap to, in design px. */
const BODY_WIDTH = 600;
/** Baseline-to-baseline gap between two lines, and the gap a blank line gets. */
const LINE_GAP = 54;
const BLANK_GAP = 28;
/** The way back, kept clear of the last line. */
const BACK_Y = 900;
/** Fade up from black as the screen arrives, in ms. */
const FADE_IN_MS = 650;

/**
 * The birthday letter itself — the present's promise, kept.
 *
 * The celebration ends on a button that says "Read the letter"; this screen is
 * what that button meant. The words live in `CELEBRATION.letter`, so the whole
 * note can be rewritten without touching the layout.
 *
 * `Back` returns to the celebration rather than the menu: the present is still
 * the thing on show, and the letter is a visit, not an exit.
 */
export class LetterScreen implements Screen {
    /** Black sheet the screen fades up from on arrival. */
    private veil: Graphics | null = null;

    init(context: ScreenContext, _params: void): void {
        const { world, ui, screens, responsive } = context;

        // The same night sky as the celebration, minus the fireworks: the letter
        // is meant to be read, and a burst behind the words is only a flicker.
        // Full-bleed, not a design-box rect — otherwise the letterbox margins
        // around a portrait viewport show the renderer's clear colour instead.
        world.addChild(createColorBackground(COLORS.sky, responsive));

        const title = createLabel(CELEBRATION.letterTitle, { fontSize: 44, fill: COLORS.star });
        title.anchor.set(0.5);
        title.position.set(SCREEN_CENTER.x, TITLE_Y);
        ui.addChild(title);

        // Advanced as we go rather than by index, so a blank entry in the letter
        // becomes an actual gap in the stanza instead of an empty line's worth.
        let y = BODY_TOP;
        for (const line of CELEBRATION.letter) {
            if (line === '') {
                y += BLANK_GAP;
                continue;
            }

            const text = createLabel(line, {
                fontSize: 30,
                align: 'center',
                wordWrap: true,
                wordWrapWidth: BODY_WIDTH,
            });
            text.anchor.set(0.5, 0);
            text.position.set(SCREEN_CENTER.x, y);
            ui.addChild(text);

            y += LINE_GAP;
        }

        const back = createSceneButton('Back', () => {
            context.audio.play(SFX.tap);
            void screens.start(SCREENS.MainMenu);
        });
        back.position.set(SCREEN_CENTER.x, BACK_Y);
        ui.addChild(back);

        this.veil = createColorBackground(COLORS.black, responsive);
        ui.addChild(this.veil);
    }

    update(dt: number): void {
        const veil = this.veil;
        if (!veil) return;

        veil.alpha = Math.max(0, veil.alpha - dt / FADE_IN_MS);
        if (veil.alpha === 0) {
            veil.destroy();
            this.veil = null;
        }
    }

    destroy(): void {
        this.veil = null;
    }
}
