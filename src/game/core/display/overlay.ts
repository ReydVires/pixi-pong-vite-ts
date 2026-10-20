import { Container } from 'pixi.js';
import { COLORS, SCREEN_CENTER } from '../../config';
import { createColorBackground } from './background';
import { createButton } from './button';
import { createLabel } from './label';
import type { ButtonOptions } from './button';
import type { Responsive } from '../responsive/Responsive';

/** Vertical rhythm of a panel, top to bottom. */
const TITLE_Y = -180;
const FIGURE_Y = -86;
/** Body lines start here when there is no figure to sit above them. */
const BODY_START_Y = -36;
const BODY_STEP_Y = 62;
/** The hero line's own size and the breathing room around it. */
const HERO_FONT_SIZE = 96;
const HERO_GAP_ABOVE = 34;
const HERO_GAP_BELOW = 30;
/** Gap between the last body line and the first button. */
const BUTTON_GAP_Y = 76;
const BUTTON_STEP_Y = 96;

export interface OverlayAction {
    readonly label: string;
    /** Fired on tap. The overlay plays its own click first. */
    readonly onTap: () => void;
    /** Button colour. Defaults to the accent, with the first action emphasised. */
    readonly fill?: number;
}

export interface OverlayOptions {
    /**
     * Debug label for the overlay container. Defaults to `overlay`.
     *
     * A screen can have more than one (pause *and* results), so naming them
     * keeps the dev-tools tree — and any probe walking it — unambiguous.
     */
    readonly label?: string;
    /** Big line at the top of the panel, e.g. "Paused". */
    readonly title?: string;
    /**
     * A graphic to sit between the title and the lines, e.g. a row of stars.
     *
     * Placed in the body flow rather than at a fixed offset, so it can never
     * collide with the title above or the lines below — the caller builds the
     * figure at the origin and the overlay decides where the origin goes.
     */
    readonly figure?: Container;
    /**
     * The headline number of the panel, e.g. the final score.
     *
     * Drawn much larger than the body lines and given its own breathing room,
     * so the one figure the player actually came to see cannot be mistaken for
     * a detail line. Sits between the figure and the lines.
     */
    readonly hero?: string;
    /** Lines of detail under the title, e.g. "Score 420". */
    readonly lines?: readonly string[];
    /** Buttons, top to bottom. The first is treated as the primary action. */
    readonly actions: readonly OverlayAction[];
    /** Dim strength over the frozen screen behind. @default 0.72 */
    readonly dim?: number;
    /**
     * Called before an action runs — used to play a UI sound. Kept as a callback
     * so this module needs no audio dependency.
     */
    readonly onAction?: () => void;
}

/**
 * A modal panel over the screen behind it.
 *
 * A screen's own flow (a run in progress, a stage ending) needs to *interrupt*
 * itself — pause, results — without tearing down and rebuilding everything it
 * has on screen. A separate `Screen` cannot do that: transitioning destroys the
 * outgoing screen and every object in it.
 *
 * So this is deliberately not a screen. It is a display object a screen can
 * build once and toggle, dimming and swallowing input over whatever is behind
 * it. It owns no lifecycle and no state of its own; the caller decides when it
 * is visible.
 *
 * The dim spans `responsive.visibleBounds`, not the design rect, so the
 * letterbox margins are covered too — a fixed 768x1024 dim would leave gameplay
 * visible around the edges on any viewport that isn't exactly the design ratio.
 */
export function createOverlay(responsive: Responsive, options: OverlayOptions): Container {
    const overlay = new Container();
    overlay.label = options.label ?? 'overlay';

    const dim = createColorBackground(COLORS.black, responsive, options.dim ?? 0.72);
    // Swallow taps aimed at whatever is behind: a modal that lets the playfield
    // take hits through it is worse than no modal at all.
    dim.eventMode = 'static';
    overlay.addChild(dim);

    const body = new Container();
    overlay.addChild(body);

    let y = SCREEN_CENTER.y + BODY_START_Y;

    if (options.title) {
        const title = createLabel(options.title, { fontSize: 64 });
        title.anchor.set(0.5);
        title.position.set(SCREEN_CENTER.x, SCREEN_CENTER.y + TITLE_Y);
        body.addChild(title);
    }

    if (options.figure) {
        options.figure.position.set(SCREEN_CENTER.x, SCREEN_CENTER.y + FIGURE_Y);
        body.addChild(options.figure);
    }

    // The hero number: the panel's headline, so it gets its own size and its
    // own margins rather than sharing the body rhythm. The gaps above and below
    // are what stop a 96px number from crowding the stars or the detail lines.
    if (options.hero) {
        y += HERO_GAP_ABOVE;
        const hero = createLabel(options.hero, { fontSize: HERO_FONT_SIZE });
        hero.anchor.set(0.5);
        hero.position.set(SCREEN_CENTER.x, y);
        body.addChild(hero);
        y += HERO_FONT_SIZE / 2 + HERO_GAP_BELOW;
    }

    for (const line of options.lines ?? []) {
        const label = createLabel(line, { fontSize: 30 });
        label.anchor.set(0.5);
        label.position.set(SCREEN_CENTER.x, y);
        body.addChild(label);
        y += BODY_STEP_Y;
    }

    // The buttons sit below whatever the body actually drew, rather than at a
    // fixed y — a panel with two lines and one with five both look deliberate.
    let buttonY = Math.max(y + BUTTON_GAP_Y, SCREEN_CENTER.y);

    options.actions.forEach((action, index) => {
        const buttonOptions: ButtonOptions = { fill: action.fill ?? (index === 0 ? COLORS.accent : 0x3a3f4b) };
        const button = createButton(action.label, () => {
            options.onAction?.();
            action.onTap();
        }, buttonOptions);
        button.position.set(SCREEN_CENTER.x, buttonY);
        body.addChild(button);
        buttonY += BUTTON_STEP_Y;
    });

    return overlay;
}
