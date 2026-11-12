import type { Container, Text } from 'pixi.js';
import { COLORS } from '../config';
import { createLabel } from '../core/display/label';
import type { Component } from '../core/ecs/Component';

/** Lifetime of a floating score popup, in ms. */
const POPUP_MS = 700;
/** How far a popup drifts upward per millisecond, in design units. */
const RISE_SPEED = 0.05;
/** How long the comic punch-in takes, in ms. */
const PUNCH_MS = 150;
/** Comic words start at this share of their resting size. */
const PUNCH_FROM = 0.35;
/** How far past resting size the punch overshoots. */
const PUNCH_OVERSHOOT = 0.14;
/** Share of a comic word's life spent at full size before it fades. */
const PUNCH_HOLD_SHARE = 0.6;

export interface PopupOptions {
    /** Text colour. @default COLORS.star */
    fill?: number;
    /** @default 36 */
    fontSize?: number;
    /** Outline width in px. @default 3 */
    strokeWidth?: number;
    /** Total lifetime in ms. @default 700 */
    lifeMs?: number;
    /** Upward drift per ms. @default 0.05 */
    rise?: number;
    /** Scale in with an overshoot, the way a comic sound effect lands. */
    punch?: boolean;
    /** Rotation in radians. @default 0 */
    tilt?: number;
    /** Extra spacing between letters, in px. @default 0 */
    letterSpacing?: number;
}

interface Popup {
    label: Text;
    life: number;
    lifeMs: number;
    rise: number;
    punch: boolean;
}

/**
 * Holds the short-lived floating labels mounted into one layer.
 *
 * Screens decide *what* is shouted and *where* — a score at a hole, a "Miss!"
 * where the tap whiffed — the pool owns the shared lifecycle: creation, the
 * rise-and-fade each frame, and destruction once a popup plays out. One pool for
 * every popup keeps the pacing identical across the game.
 *
 * A popup either drifts (scores, callouts) or punches in (comic hit words,
 * where the arrival is the point).
 */
export class PopupsPool implements Component {
    private readonly popups: Popup[] = [];

    constructor(private readonly layer: Container) {}

    /** Float `text` above `(x, y)`, rising and fading out. */
    add(text: string, x: number, y: number, options: PopupOptions = {}): void {
        const {
            fill = COLORS.star,
            fontSize = 36,
            strokeWidth = 3,
            lifeMs = POPUP_MS,
            rise = RISE_SPEED,
            punch = false,
            tilt = 0,
            letterSpacing = 0,
        } = options;

        const label = createLabel(text, {
            fontSize,
            fill,
            letterSpacing,
            stroke: { color: COLORS.black, width: strokeWidth },
        });
        label.anchor.set(0.5);
        label.position.set(x, y);
        label.rotation = tilt;
        if (punch) label.scale.set(PUNCH_FROM);

        this.layer.addChild(label);
        this.popups.push({ label, life: 0, lifeMs, rise, punch });
    }

    update(dt: number): void {
        for (let i = this.popups.length - 1; i >= 0; i--) {
            const popup = this.popups[i];
            popup.life += dt;
            popup.label.y -= popup.rise * dt;

            if (popup.punch) {
                const punch = Math.min(1, popup.life / PUNCH_MS);
                const grow = 1 - (1 - punch) ** 3;
                const overshoot = Math.sin(punch * Math.PI) * PUNCH_OVERSHOOT;
                popup.label.scale.set(PUNCH_FROM + (1 - PUNCH_FROM) * grow + overshoot);
            }

            const fadeFrom = popup.punch ? popup.lifeMs * PUNCH_HOLD_SHARE : 0;
            const fade = Math.max(0, popup.life - fadeFrom) / (popup.lifeMs - fadeFrom);
            popup.label.alpha = Math.max(0, 1 - fade);

            if (popup.life >= popup.lifeMs) {
                popup.label.destroy();
                this.popups.splice(i, 1);
            }
        }
    }

    dispose(): void {
        for (const popup of this.popups) popup.label.destroy();
        this.popups.length = 0;
    }
}
