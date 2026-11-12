import { Graphics } from 'pixi.js';
import type { Container, Text } from 'pixi.js';
import { COLORS, SCREEN_CENTER } from '../config';
import { createLabel } from '../core/display/label';

/** Radius and stroke of the countdown ring around the timer. */
const RING_RADIUS = 56;
const RING_WIDTH = 5;

/**
 * The HUD's countdown: the seconds label inside a ring that drains with the
 * clock. Hidden entirely on untimed stages — the screen calls `setVisible`.
 */
export class TimerView {
    private readonly label: Text;
    private readonly ring = new Graphics();

    constructor(ui: Container) {
        this.ring.position.x = SCREEN_CENTER.x;
        this.ring.visible = false;
        ui.addChild(this.ring);

        this.label = createLabel('0', { fontSize: 52 });
        this.label.anchor.set(0.5, 0.5);
        this.label.position.x = SCREEN_CENTER.x;
        this.label.visible = false;
        ui.addChild(this.label);
    }

    /** Re-anchor to the safe edge of the screen — see `PlayHud.layout`. */
    layout(y: number): void {
        this.ring.y = y;
        this.label.y = y;
    }

    /** Show (or hide) the countdown — stages without a clock stay dark. */
    setVisible(visible: boolean): void {
        this.label.visible = visible;
        this.ring.visible = visible;
    }

    /** Restate the countdown: `seconds` for the label, `fraction` 0..1 for the ring. */
    set(seconds: number, fraction: number): void {
        this.label.text = `${seconds}`;
        this.drawRing(Math.max(0, Math.min(1, fraction)));
    }

    /** Draw remaining time as a shrinking arc behind the countdown label. */
    private drawRing(fraction: number): void {
        const ring = this.ring;
        const start = -Math.PI / 2;

        ring.clear();
        ring.circle(0, 0, RING_RADIUS).stroke({
            width: RING_WIDTH,
            color: 0x3a3f4b,
            alpha: 0.9,
        });

        if (fraction > 0) {
            const startX = Math.cos(start) * RING_RADIUS;
            const startY = Math.sin(start) * RING_RADIUS;
            ring.moveTo(startX, startY)
                .arc(0, 0, RING_RADIUS, start, start + Math.PI * 2 * fraction)
                .stroke({
                    width: RING_WIDTH,
                    color: COLORS.accent,
                    cap: 'round',
                });
        }
    }
}
