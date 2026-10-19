import { Graphics } from 'pixi.js';
import { Emerge } from '../components/Emerge';
import { HitTarget } from '../components/HitTarget';
import { COLORS } from '../config';
import { Entity } from '../core/entities/Entity';
import type { MouseType } from '../levels/types';
import type { Hole } from './Hole';

/** How long a hit flash stays visible, in ms. */
const FLASH_MS = 140;

/**
 * A mouse rising out of its hole.
 *
 * Position is relative to its `Hole`: `Emerge` drives it through
 * `setEmergeProgress()` (0 = sunk, 1 = risen), and `HitTarget` counts the taps
 * it takes. Deciding what a tap *means* — points, hazards, clearing the field —
 * belongs to `PlayScreen`, which owns the stage rules.
 *
 * The body is drawn from circles as a placeholder for real art; swapping in a
 * sprite later only touches `createBody()`.
 */
export class Mouse extends Entity {
    readonly type: MouseType;
    readonly hole: Hole;
    readonly hitTarget: HitTarget;
    readonly emerge: Emerge;

    /** Set by the screen; fired when the mouse finishes sinking away. */
    onRetreated: (() => void) | null = null;

    private readonly headRadius: number;
    private readonly flashOverlay: Graphics;
    private readonly pips: Graphics;
    private flashLeft = 0;
    private settled = false;

    constructor(type: MouseType, hole: Hole, hold = false) {
        super();

        this.type = type;
        this.hole = hole;
        this.hitTarget = new HitTarget(type);
        this.headRadius = hole.slot.radius * 0.7;

        this.flashOverlay = new Graphics().circle(0, 0, this.headRadius).fill(0xffffff);
        this.flashOverlay.alpha = 0;
        this.pips = new Graphics();

        this.addChild(this.createBody(), this.flashOverlay, this.pips);

        // Must be attached, or `update()` never ticks it and the mouse is
        // frozen at progress 0 — sunk, and unable to ever retreat.
        this.emerge = this.addComponent(
            new Emerge(this, {
                emergeMs: type.emergeMs,
                upMs: type.upMs,
                hold,
                onRetreated: () => this.onRetreated?.(),
            }),
        );

        this.setEmergeProgress(0);
        this.drawPips();
    }

    /** Start rising out of the hole. */
    start(): void {
        this.emerge.start();
    }

    /** Whether a tap at `(x, y)` should count — a generous circle over the hole. */
    near(x: number, y: number, radiusScale: number): boolean {
        const radius = this.hole.slot.radius * radiusScale;
        const dx = x - this.hole.slot.x;
        const dy = y - this.hole.slot.y;
        return dx * dx + dy * dy <= radius * radius;
    }

    /** Brief white flash so a tap feels answered even before points land. */
    flash(): void {
        this.flashLeft = FLASH_MS;
    }

    /** Redraw the health pips after the hp changed. */
    refreshHealth(): void {
        this.drawPips();
    }

    /** True once the screen has scored or swept this mouse — never an escape. */
    markSettled(): void {
        this.settled = true;
    }

    get isSettled(): boolean {
        return this.settled;
    }

    /** Called by `Emerge` — moves and scales the mouse as it rises or sinks. */
    setEmergeProgress(progress: number): void {
        const radius = this.hole.slot.radius;
        // Tuned against the hole: at 0 the whole mouse (hazard marker, chin
        // *and* ears) tucks behind the front lip, so nothing pokes out above
        // the rim or below the mound; at 1 the chin sits just inside the rim
        // so it reads as standing in the hole.
        this.position.y = radius * (0.566 - 1.066 * progress);
        this.scale.set(0.56 + 0.44 * progress);
    }

    override update(dt: number): void {
        super.update(dt);

        if (this.flashLeft > 0) {
            this.flashLeft = Math.max(0, this.flashLeft - dt);
            this.flashOverlay.alpha = this.flashLeft / FLASH_MS;
        }
    }

    private createBody(): Graphics {
        const r = this.headRadius;
        const body = new Graphics();

        // Ears first — the head covers their lower halves, so they read as
        // sitting behind it.
        body.circle(-r * 0.6, -r * 0.8, r * 0.42).fill(this.type.color);
        body.circle(r * 0.6, -r * 0.8, r * 0.42).fill(this.type.color);
        body.circle(-r * 0.6, -r * 0.8, r * 0.2).fill(this.type.accent);
        body.circle(r * 0.6, -r * 0.8, r * 0.2).fill(this.type.accent);

        body.circle(0, 0, r).fill(this.type.color);
        body.circle(0, r * 0.44, r * 0.3).fill(this.type.accent);

        body.circle(-r * 0.34, -r * 0.16, r * 0.2).fill(0xffffff);
        body.circle(r * 0.34, -r * 0.16, r * 0.2).fill(0xffffff);
        body.circle(-r * 0.3, -r * 0.14, r * 0.1).fill(0x1b1b1b);
        body.circle(r * 0.3, -r * 0.14, r * 0.1).fill(0x1b1b1b);

        // Hazards carry a warning marker so they can be told apart *before*
        // they cost points.
        if (this.type.harmful) {
            body.poly([0, -r * 1.1, r * 0.24, -r * 0.6, -r * 0.24, -r * 0.6], true).fill(COLORS.hazard);
        }

        return body;
    }

    /** Health pips above the head — only drawn for multi-hit mice. */
    private drawPips(): void {
        this.pips.clear();
        if (this.type.hp <= 1) return;

        const size = 14;
        const gap = 8;
        const width = this.type.hp * size + (this.type.hp - 1) * gap;
        const startX = -width / 2 + size / 2;
        const y = -this.headRadius * 1.5;

        for (let i = 0; i < this.hitTarget.remainingHp; i++) {
            this.pips.circle(startX + i * (size + gap), y, size / 2).fill(0xffffff);
        }
    }
}
