import type { Container, Text } from 'pixi.js';
import { createLabel } from '../core/display/label';
import { Easing, Tweens } from '../core/tween';

/** Left margin of the score, in design px. */
const SCORE_X = 56;

/**
 * The HUD's running score: a label that tweens to its new value and punches on
 * the way. Owns its own tween clock; the screen just calls `set(score)`.
 */
export class ScoreView {
    private readonly label: Text;
    private readonly tweens = new Tweens();

    /** Score currently shown. */
    private displayed = 0;
    /** Score to tween toward. */
    private target = 0;

    constructor(ui: Container) {
        this.label = createLabel('0', { fontSize: 52 });
        this.label.anchor.set(0, 0.5);
        this.label.x = SCORE_X;
        ui.addChild(this.label);
    }

    /** Re-anchor to the safe edge of the screen — see `PlayHud.layout`. */
    layout(y: number): void {
        this.label.y = y;
    }

    /** Hide the score — a finished stage shows its total in the results panel. */
    hide(): void {
        this.label.visible = false;
    }

    /** Bank a new score and tween the label toward it, punching it on the way. */
    set(next: number): void {
        const label = this.label;
        if (next === this.target) return;
        const delta = next - this.target;
        if (delta === 0) return;
        this.target = next;
        const durationMs = Math.min(420, 220 + Math.abs(delta) * 0.08);

        this.tweens.to('score', this.displayed, next, {
            durationMs,
            easing: Easing.easeOutCubic,
            onUpdate: (value) => {
                this.displayed = Math.round(value);
                label.text = `${this.displayed}`;
            },
            onComplete: () => {
                this.displayed = next;
                label.text = `${next}`;
            },
        });

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

    update(dt: number): void {
        this.tweens.update(dt);
    }

    dispose(): void {
        this.tweens.clear();
        this.displayed = 0;
        this.target = 0;
    }
}
