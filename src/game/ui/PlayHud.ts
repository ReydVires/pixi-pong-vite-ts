import { Container } from 'pixi.js';
import type { Text } from 'pixi.js';
import { GAME_WIDTH, SCREEN_CENTER } from '../config';
import { createButton } from '../core/display/button';
import { createLabel } from '../core/display/label';
import type { Responsive, ViewportMetrics } from '../core/responsive/Responsive';
import type { Nullable } from '../core/types';
import { ComboView } from './ComboView';
import { ScoreView } from './ScoreView';
import { TimerView } from './TimerView';

/** Y of the HUD's top row — score, countdown and the pause button share it. */
const HUD_ROW_Y = 92;
/**
 * Above this line is HUD chrome (score/timer/pause), never playfield.
 *
 * Exported because `PlayScreen` reads it when testing a tap: skipping the HUD
 * strip is what keeps "tapping pause" from counting as a miss.
 */
export const HUD_ZONE_Y = 170;
/** The combo line hangs directly under the countdown, not off to one side. */
const COMBO_Y = 180;
/** The stage title / tutorial prompt, at the bottom of the screen. */
const PROMPT_Y = 950;

export interface PlayHudOptions {
    /** The pause button was tapped. */
    onPause: () => void;
}

/**
 * The Play screen's HUD: score, countdown, combo line, prompt and the pause
 * button, plus a top layer for modals.
 *
 * A thin composer — the three animated parts each own their own label and
 * timing (`ScoreView`, `TimerView`, `ComboView`), and this class only places
 * them, forwards the screen's values, and owns the pause button and the
 * overlay layer. Screens keep the *rules* (what a tap means, when the clock
 * runs out) and report values here.
 *
 * Layering: the chrome is added to `ui` at construction. Anything the screen
 * draws *above* the chrome but *below* modals (such as the golden's sweep wash)
 * must be added right after `new PlayHud(...)` and before the first
 * `mountOverlay(...)`, which lazily appends the overlay layer last.
 */
export class PlayHud {
    private readonly ui: Container;
    private readonly score: ScoreView;
    private readonly timer: TimerView;
    private readonly combo: ComboView;
    private readonly promptLabel: Text;
    private readonly pauseButton: Container;

    /** Top of the UI stack: modals mount here, above chrome and wash alike. */
    private overlayLayer: Nullable<Container> = null;

    constructor(ui: Container, responsive: Responsive, options: PlayHudOptions) {
        this.ui = ui;
        this.score = new ScoreView(ui);
        this.timer = new TimerView(ui);
        this.combo = new ComboView(ui);

        this.promptLabel = createLabel('', { fontSize: 30 });
        this.promptLabel.anchor.set(0.5, 0.5);
        this.promptLabel.position.set(SCREEN_CENTER.x, PROMPT_Y);
        ui.addChild(this.promptLabel);

        this.pauseButton = createButton('II', options.onPause, { width: 84, height: 62, fontSize: 26 });
        this.pauseButton.x = GAME_WIDTH - 72;
        ui.addChild(this.pauseButton);

        // The top row hangs from the safe edge of the *screen*, not the design
        // box, and is re-anchored on resize so rotation can't leave it behind.
        this.layout(responsive.viewport);
    }

    /**
     * Re-anchor the top row to the screen's safe area.
     *
     * `safeArea` starts at the physical edge of the screen, while the design box
     * can sit inside a letterbox on a tall phone. Anchoring to the box would
     * strand the score and pause button halfway down that phone.
     */
    layout(viewport: ViewportMetrics): void {
        const rowY = viewport.safeArea.y + HUD_ROW_Y;
        this.score.layout(rowY);
        this.timer.layout(rowY);
        this.pauseButton.y = rowY;

        this.combo.layout(viewport.safeArea.y + COMBO_Y);
    }

    /** Show (or hide) the countdown label and ring — stages without a clock stay dark. */
    setTimed(visible: boolean): void {
        this.timer.setVisible(visible);
    }

    /** The line at the bottom: the stage title, or the tutorial's current beat. */
    setPrompt(text: string): void {
        this.promptLabel.text = text;
    }

    /** Hide the score — a finished stage shows its total in the results panel instead. */
    hideScore(): void {
        this.score.hide();
    }

    /** Bank a new score and tween the HUD toward it, punching the label on the way. */
    setScore(next: number): void {
        this.score.set(next);
    }

    /** Restate the combo line; an empty string while nothing is stacked. */
    setCombo(multiplier: number, count: number): void {
        this.combo.set(multiplier, count);
    }

    /** Restate the countdown: `seconds` for the label, `fraction` 0..1 for the ring. */
    setTime(seconds: number, fraction: number): void {
        this.timer.set(seconds, fraction);
    }

    /** A step up the combo ladder: punch the line and shout it. */
    shout(multiplier: number): void {
        this.combo.shout(multiplier);
    }

    /**
     * Mount a modal above everything else in the UI, so it is never buried
     * under HUD chrome or the sweep wash. The overlay layer is created (and
     * appended last) on first use — see the class doc for layering rules.
     */
    mountOverlay(node: Container): void {
        if (!this.overlayLayer) {
            const layer = new Container();
            layer.label = 'overlays';
            this.ui.addChild(layer);
            this.overlayLayer = layer;
        }
        this.overlayLayer.addChild(node);
    }

    /** Tick the score tween, the combo punch and the shout. */
    update(dt: number): void {
        this.score.update(dt);
        this.combo.update(dt);
    }

    destroy(): void {
        this.score.dispose();
        this.combo.dispose();
        this.overlayLayer = null;
    }
}
