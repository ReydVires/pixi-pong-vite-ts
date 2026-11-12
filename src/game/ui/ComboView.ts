import type { Container, Text } from 'pixi.js';
import { COLORS, COMBO_WORDS, SCREEN_CENTER } from '../config';
import { createLabel } from '../core/display/label';

/** How long the combo label stays punched after a step up, in ms. */
const PUNCH_MS = 260;
/** Extra scale at the start of that punch. */
const PUNCH_SCALE = 0.4;
/** Lifetime of the shout, in ms. */
const WORD_MS = 760;
/** Shout size — louder than the combo line it covers, quieter than a title. */
const WORD_SIZE = 46;
/** Share of the life spent growing, so the shout erupts rather than fades in. */
const WORD_POP = 0.22;
/** Scale it erupts from; it grows into its own size from here. */
const WORD_FROM = 0.3;
/** Share of the life held at full strength; everything after that fades out. */
const WORD_HOLD = 0.6;

/**
 * The HUD's combo line and the ladder's shout.
 *
 * `set()` restates the streak; `shout()` is the milestone beat: the line punches
 * and — when the ladder has a word for that multiplier — a word erupts in its
 * place, then hands the line back.
 */
export class ComboView {
    private readonly label: Text;
    private readonly word: Text;
    /** Milliseconds left on the line's punch. */
    private punchLeft = 0;
    /** The shout's remaining life; 0 means the line is showing. */
    private wordLeft = 0;

    constructor(ui: Container) {
        this.label = createLabel('', { fontSize: 26, fill: COLORS.star });
        this.label.anchor.set(0.5, 0.5);
        this.label.position.x = SCREEN_CENTER.x;
        ui.addChild(this.label);

        // The shout lands on the combo line's own spot — built once and
        // re-shown, because a shout is a visibility flip, not new layout.
        this.word = createLabel('', {
            fontSize: WORD_SIZE,
            fill: COLORS.star,
            stroke: { width: 5 },
        });
        this.word.anchor.set(0.5, 0.5);
        this.word.position.x = SCREEN_CENTER.x;
        this.word.visible = false;
        ui.addChild(this.word);
    }

    /** Re-anchor to the safe edge of the screen — see `PlayHud.layout`. */
    layout(y: number): void {
        this.label.y = y;
        this.word.y = y;
    }

    /** Restate the combo line; an empty string while nothing is stacked. */
    set(multiplier: number, count: number): void {
        this.label.text = count > 0 ? `x${multiplier}  combo ${count}` : '';
    }

    /** A step up the ladder: punch the line, and shout its word if it has one. */
    shout(multiplier: number): void {
        this.punchLeft = PUNCH_MS;

        const word = COMBO_WORDS[multiplier];
        if (!word) return;

        this.word.text = word;
        this.word.visible = true;
        this.word.alpha = 1;
        this.word.scale.set(WORD_FROM);
        this.wordLeft = WORD_MS;
    }

    update(dt: number): void {
        if (this.punchLeft > 0) this.punchLeft = Math.max(0, this.punchLeft - dt);
        this.label.scale.set(1 + PUNCH_SCALE * (this.punchLeft / PUNCH_MS));

        this.updateShout(dt);
    }

    dispose(): void {
        this.punchLeft = 0;
        this.wordLeft = 0;
    }

    /**
     * Play the shout out — grow in, hold, fade — and hand the combo line back.
     * The plain line is hidden while the shout is up, so a miss taken during it
     * still lands in the label when it returns.
     */
    private updateShout(dt: number): void {
        if (this.wordLeft > 0) {
            this.wordLeft = Math.max(0, this.wordLeft - dt);

            const t = 1 - this.wordLeft / WORD_MS;
            const grow = 1 - (1 - Math.min(1, t / WORD_POP)) ** 2;
            const fade = 1 - Math.max(0, t - WORD_HOLD) / (1 - WORD_HOLD);

            this.word.scale.set(WORD_FROM + (1 - WORD_FROM) * grow);
            this.word.alpha = Math.max(0, fade);

            if (this.wordLeft === 0) this.word.visible = false;
        }

        this.label.visible = this.wordLeft <= 0;
    }
}
