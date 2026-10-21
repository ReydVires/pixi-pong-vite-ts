import { COLORS } from '../config';
import type { Responsive } from '../core/responsive/Responsive';
import type { EffectsSystem } from './EffectsSystem';
import { FIREWORK_COLORS, nextFirework } from './fireworks';
import type { Firework } from './fireworks';

/** Share of the visible height fireworks may use — the rest is the ground. */
const SKY_FRACTION = 0.55;
/** Bursts set off by the present itself when it opens. */
const OPENING_VOLLEY = 4;

/**
 * A firework hangs where a whack's sparks would have dropped: lighter gravity
 * and a longer life, so each one blooms and drifts instead of snapping off.
 */
const SKY_BURST = { count: 26, speed: [180, 620], lifeMs: [500, 1100], size: [3, 8], gravity: 320 } as const;
/** The opening volley is the same bloom with real gravity — it falls from the box. */
const VOLLEY_BURST = { count: 26, speed: [180, 620], lifeMs: [500, 1100], size: [3, 8], gravity: 380 } as const;

/**
 * Keeps a sky full of fireworks going, and fires the present's opening volley.
 *
 * Pure scheduling: each `update(dt)` counts down to the next burst and throws
 * it through the `EffectsSystem` it was built with — the screen owns that
 * system's layer and lifecycle. The schedule is drawn fresh from the viewport
 * after every burst, so the sky is always sprinkled over the *current* visible
 * area, letterbox margins included.
 *
 * Mirrors the other systems' shape: `start()` once, `update(dt)` every frame,
 * `volley(x, y)` when something worth celebrating happens.
 */
export class FireworksSystem {
    /** The next firework to set off, and the wait before it. */
    private firework: Firework = { delayMs: 0, x: 0, y: 0, color: COLORS.white };
    private pending = 0;

    constructor(
        private readonly effects: EffectsSystem,
        private readonly responsive: Responsive,
    ) {}

    /** Begin the show — staggered from the first frame, then random from there. */
    start(): void {
        this.schedule();
        this.pending = 0;
    }

    /** Set off the present's own volley — one bloom per palette colour, falling from the box. */
    volley(x: number, y: number): void {
        for (let i = 0; i < OPENING_VOLLEY; i++) {
            const color = FIREWORK_COLORS[i % FIREWORK_COLORS.length];
            this.effects.addBurst(color, { ...VOLLEY_BURST, x, y: y - 40 });
        }
    }

    /** Throw whichever burst is due, and schedule the next one. */
    update(dt: number): void {
        this.pending -= dt;
        if (this.pending > 0) return;

        this.effects.addBurst(this.firework.color, { ...SKY_BURST, x: this.firework.x, y: this.firework.y });
        this.schedule();
    }

    /** Draw the next firework — and its wait — from the sky as it is now. */
    private schedule(): void {
        const bounds = this.responsive.viewport.visibleBounds;
        this.firework = nextFirework({
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height * SKY_FRACTION,
        });
        this.pending = this.firework.delayMs;
    }
}
