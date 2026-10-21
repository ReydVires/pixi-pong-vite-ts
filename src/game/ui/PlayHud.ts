import { Container, Graphics } from 'pixi.js';
import type { Text } from 'pixi.js';
import { COLORS, COMBO_WORDS, GAME_WIDTH, SCREEN_CENTER } from '../config';
import { createButton } from '../core/display/button';
import { createLabel } from '../core/display/label';
import type { Responsive } from '../core/responsive/Responsive';
import { Easing, TweenSystem } from '../systems/TweenSystem';

/** Y of the HUD's top row — score, countdown and the pause button share it. */
const HUD_ROW_Y = 92;
/**
 * Above this line is HUD chrome (score/timer/pause), never playfield.
 *
 * Exported because `PlayScreen` reads it when testing a tap: skipping the HUD
 * strip is what keeps "tapping pause" from counting as a miss.
 */
export const HUD_ZONE_Y = 170;
/** Radius and stroke for the countdown ring around the timer. */
const TIMER_RING_RADIUS = 56;
const TIMER_RING_WIDTH = 5;
/** The combo line hangs directly under the countdown, not off to one side. */
const COMBO_Y = 180;
/** How long the combo label stays punched after the multiplier steps up, in ms. */
const COMBO_PUNCH_MS = 260;
/** Extra scale at the start of that punch. */
const COMBO_PUNCH_SCALE = 0.4;
/** Lifetime of the shout, in ms. */
const COMBO_WORD_MS = 760;
/** Shout size — louder than the combo line it covers, quieter than a title. */
const COMBO_WORD_SIZE = 46;
/** Share of the life spent growing, so the shout erupts rather than fades in. */
const COMBO_WORD_POP = 0.22;
/** Scale it erupts from; it grows into its own size from here. */
const COMBO_WORD_FROM = 0.3;
/** Share of the life held at full strength; everything after that fades out. */
const COMBO_WORD_HOLD = 0.6;

export interface PlayHudOptions {
    /** The pause button was tapped. */
    onPause: () => void;
}

/**
 * The Play screen's HUD: score, countdown, combo line, prompt and the pause
 * button — plus everything that animates them.
 *
 * A composed unit rather than half of `PlayScreen`: it owns its own labels,
 * its score tween and the combo milestone's shout/punch, and exposes simple
 * setters (`setScore`, `setCombo`, `setTime`, `shout`, …). Screens keep the
 * *rules* — what a tap means, when the clock runs out — and report values here.
 *
 * Layering: the chrome is added to `ui` at construction. Anything the screen
 * draws *above* the chrome but *below* modals (such as the golden's sweep
 * wash) must be added right after `new PlayHud(...)` and before the first
 * `mountOverlay(...)`, which lazily appends the overlay layer last.
 */
export class PlayHud {
    private readonly ui: Container;
    private readonly scoreLabel: Text;
    private readonly timerLabel: Text;
    private readonly timerRing: Graphics;
    private readonly comboLabel: Text;
    private readonly comboWord: Text;
    private readonly promptLabel: Text;

    /** Score currently shown on the HUD. */
    private displayedScore = 0;
    /** Score to tween toward. */
    private targetScore = 0;
    private readonly tweens = new TweenSystem();

    /** Milliseconds left on the combo label's punch. */
    private comboPunch = 0;
    /** The ladder's shout, shown in place of the combo line while it plays. */
    private wordLeft = 0;

    /** Top of the UI stack: modals mount here, above chrome and wash alike. */
    private overlayLayer: Container | null = null;

    constructor(ui: Container, responsive: Responsive, options: PlayHudOptions) {
        this.ui = ui;

        // Nudge the whole top row clear of a notched phone's Dynamic Island. The
        // safe area is in design units already, and clamped to the design box,
        // so this can only ever move the row down — never off the top.
        const rowY = Math.max(HUD_ROW_Y, responsive.safeArea.y + HUD_ROW_Y * 0.6);

        this.scoreLabel = createLabel('0', { fontSize: 52 });
        this.scoreLabel.anchor.set(0, 0.5);
        this.scoreLabel.position.set(56, rowY);
        ui.addChild(this.scoreLabel);

        this.timerRing = new Graphics();
        this.timerRing.position.set(SCREEN_CENTER.x, rowY);
        this.timerRing.visible = false;
        ui.addChild(this.timerRing);

        this.timerLabel = createLabel('0', { fontSize: 52 });
        this.timerLabel.anchor.set(0.5, 0.5);
        this.timerLabel.position.set(SCREEN_CENTER.x, rowY);
        this.timerLabel.visible = false;
        ui.addChild(this.timerLabel);

        // The combo line follows the row it hangs from, so the two cannot drift
        // apart on a device that pushes the HUD down.
        const comboY = COMBO_Y + (rowY - HUD_ROW_Y);

        this.comboLabel = createLabel('', { fontSize: 26, fill: COLORS.star });
        this.comboLabel.anchor.set(0.5, 0.5);
        this.comboLabel.position.set(SCREEN_CENTER.x, comboY);
        ui.addChild(this.comboLabel);

        // The milestone's shout: the combo line's own spot, so the ladder's
        // answer arrives exactly where the ladder is read. Built once and
        // re-shown, because a shout is a visibility flip — not new text laid
        // out in the middle of a tap.
        this.comboWord = createLabel('', {
            fontSize: COMBO_WORD_SIZE,
            fill: COLORS.star,
            stroke: { width: 5 },
        });
        this.comboWord.anchor.set(0.5, 0.5);
        this.comboWord.position.set(SCREEN_CENTER.x, comboY);
        this.comboWord.visible = false;
        ui.addChild(this.comboWord);

        this.promptLabel = createLabel('', { fontSize: 30 });
        this.promptLabel.anchor.set(0.5, 0.5);
        this.promptLabel.position.set(SCREEN_CENTER.x, 950);
        ui.addChild(this.promptLabel);

        const pause = createButton('II', options.onPause, { width: 84, height: 62, fontSize: 26 });
        pause.position.set(GAME_WIDTH - 72, rowY);
        ui.addChild(pause);
    }

    /** Show (or hide) the countdown label and ring — stages without a clock stay dark. */
    setTimed(visible: boolean): void {
        this.timerLabel.visible = visible;
        this.timerRing.visible = visible;
    }

    /** The line at the bottom: the stage title, or the tutorial's current beat. */
    setPrompt(text: string): void {
        this.promptLabel.text = text;
    }

    /** Hide the score — a finished stage shows its total in the results panel instead. */
    hideScore(): void {
        this.scoreLabel.visible = false;
    }

    /** Bank a new score and tween the HUD toward it, punching the label on the way. */
    setScore(next: number): void {
        const label = this.scoreLabel;
        if (next === this.targetScore) return;
        const delta = next - this.targetScore;
        if (delta === 0) return;
        this.targetScore = next;
        const durationMs = Math.min(420, 220 + Math.abs(delta) * 0.08);

        this.tweens.to('score', this.displayedScore, next, {
            durationMs,
            easing: Easing.easeOutCubic,
            onUpdate: (value) => {
                this.displayedScore = Math.round(value);
                label.text = `${this.displayedScore}`;
            },
            onComplete: () => {
                this.displayedScore = next;
                label.text = `${next}`;
            },
        });

        // Keep the HUD emphasis local; the tween system owns timing/easing.
        const scaleFrom = Math.abs(delta) >= 50 ? 1.12 : 1.08;
        label.scale.set(scaleFrom);
        label.rotation = (Math.random() - 0.5) * 0.08;
        this.tweens.to('score-scale', scaleFrom, 1, {
            durationMs: 300,
            easing: Easing.easeOutBack,
            onUpdate: (scale) => label.scale.set(scale),
        });
        this.tweens.to('score-rotation', label.rotation, 0, {
            durationMs: 300,
            easing: Easing.easeOutCubic,
            onUpdate: (rotation) => {
                label.rotation = rotation;
            },
        });
    }

    /** Restate the combo line; an empty string while nothing is stacked. */
    setCombo(multiplier: number, count: number): void {
        this.comboLabel.text = count > 0 ? `x${multiplier}  combo ${count}` : '';
    }

    /** Restate the countdown: `seconds` for the label, `fraction` 0..1 for the ring. */
    setTime(seconds: number, fraction: number): void {
        this.timerLabel.text = `${seconds}`;
        this.drawTimerRing(Math.max(0, Math.min(1, fraction)));
    }

    /**
     * A step up the combo ladder: punch the line and shout it.
     *
     * The whack that caused this already threw its own sparks, so a milestone
     * adds weight and a word rather than more particles — the ladder should feel
     * like a new tier, not like a slightly bigger hit. The word lands on the
     * combo line it answers, which is the one band free in every layout: under
     * the HUD, clear of the topmost hole and its own score popup.
     *
     * A ladder with no word for this multiplier still gets its punch.
     */
    shout(multiplier: number): void {
        this.comboPunch = COMBO_PUNCH_MS;

        const word = COMBO_WORDS[multiplier];
        if (!word) return;

        this.comboWord.text = word;
        this.comboWord.visible = true;
        this.comboWord.alpha = 1;
        this.comboWord.scale.set(COMBO_WORD_FROM);
        this.wordLeft = COMBO_WORD_MS;
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
        this.tweens.update(dt);

        if (this.comboPunch > 0) this.comboPunch = Math.max(0, this.comboPunch - dt);
        this.comboLabel.scale.set(1 + COMBO_PUNCH_SCALE * (this.comboPunch / COMBO_PUNCH_MS));

        this.updateShout(dt);
    }

    destroy(): void {
        this.tweens.clear();
        this.displayedScore = 0;
        this.targetScore = 0;
        this.comboPunch = 0;
        this.wordLeft = 0;
        this.overlayLayer = null;
    }

    /** Draw remaining time as a shrinking arc behind the countdown label. */
    private drawTimerRing(fraction: number): void {
        const ring = this.timerRing;
        const start = -Math.PI / 2;

        ring.clear();
        ring.circle(0, 0, TIMER_RING_RADIUS).stroke({
            width: TIMER_RING_WIDTH,
            color: 0x3a3f4b,
            alpha: 0.9,
        });

        if (fraction > 0) {
            const startX = Math.cos(start) * TIMER_RING_RADIUS;
            const startY = Math.sin(start) * TIMER_RING_RADIUS;
            ring.moveTo(startX, startY)
                .arc(0, 0, TIMER_RING_RADIUS, start, start + Math.PI * 2 * fraction)
                .stroke({
                    width: TIMER_RING_WIDTH,
                    color: COLORS.accent,
                    cap: 'round',
                });
        }
    }

    /**
     * Play the shout out — grow in, hold, fade — and hand the combo line back.
     *
     * The plain line is hidden while the shout is up rather than showing through
     * it, and comes back reading whatever the streak is by then, so a miss taken
     * during the shout still lands in the label.
     */
    private updateShout(dt: number): void {
        if (this.wordLeft > 0) {
            this.wordLeft = Math.max(0, this.wordLeft - dt);

            const t = 1 - this.wordLeft / COMBO_WORD_MS;
            const grow = 1 - (1 - Math.min(1, t / COMBO_WORD_POP)) ** 2;
            const fade = 1 - Math.max(0, t - COMBO_WORD_HOLD) / (1 - COMBO_WORD_HOLD);

            this.comboWord.scale.set(COMBO_WORD_FROM + (1 - COMBO_WORD_FROM) * grow);
            this.comboWord.alpha = Math.max(0, fade);

            if (this.wordLeft === 0) this.comboWord.visible = false;
        }

        this.comboLabel.visible = this.wordLeft <= 0;
    }
}
