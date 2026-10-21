import type { Container, Text } from 'pixi.js';
import { COLORS } from '../config';
import { createLabel } from '../core/display/label';

/** Lifetime of a floating score popup, in ms. */
const POPUP_MS = 700;
/** How far a popup drifts upward per millisecond, in design units. */
const RISE_SPEED = 0.05;

interface Popup {
    label: Text;
    life: number;
}

/**
 * Owns short-lived floating labels mounted into a Pixi container.
 *
 * Screens decide *what* is shouted and *where* — a score at a hole, a "Miss!"
 * where the tap whiffed — this system handles the shared lifecycle: creation,
 * the rise-and-fade each frame, and destruction once a popup plays out. That
 * keeps rise speed and fade identical for every popup in the game.
 *
 * Mirrors `EffectsSystem`: build it with the layer to draw into, then
 * `add(...)` / `update(dt)` / `destroy()`.
 */
export class PopupsSystem {
    private readonly popups: Popup[] = [];

    constructor(private readonly layer: Container) {}

    /** Float `text` above `(x, y)`, rising and fading out. */
    add(text: string, x: number, y: number, fill: number = COLORS.star, fontSize = 36): void {
        const label = createLabel(text, {
            fontSize,
            fill,
            stroke: { color: COLORS.black, width: 3 },
        });
        label.anchor.set(0.5);
        label.position.set(x, y);

        this.layer.addChild(label);
        this.popups.push({ label, life: 0 });
    }

    update(dt: number): void {
        for (let i = this.popups.length - 1; i >= 0; i--) {
            const popup = this.popups[i];
            popup.life += dt;
            popup.label.y -= RISE_SPEED * dt;
            popup.label.alpha = Math.max(0, 1 - popup.life / POPUP_MS);

            if (popup.life >= POPUP_MS) {
                popup.label.destroy();
                this.popups.splice(i, 1);
            }
        }
    }

    destroy(): void {
        for (const popup of this.popups) popup.label.destroy();
        this.popups.length = 0;
    }
}
