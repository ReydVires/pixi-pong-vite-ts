import { Graphics } from 'pixi.js';
import { Emerge } from '../components/Emerge';
import { HitTarget } from '../components/HitTarget';
import { COLORS } from '../config';
import { Entity } from '../core/entities/Entity';
import type { CapyType } from '../levels/types';
import type { Hole } from './Hole';

/** How long a hit flash stays visible, in ms. */
const FLASH_MS = 140;

/**
 * Emerge progress below which the health pips stay hidden.
 *
 * The pips sit *above* the head, so the front lip cannot cover them the way it
 * covers the body — without this gate they hover over an empty hole for the
 * whole of a sunk capy's life (spawn and the tail of a retreat).
 */
const PIP_MIN_PROGRESS = 0.5;

/**
 * A capy rising out of its hole.
 *
 * Position is relative to its `Hole`: `Emerge` drives it through
 * `setEmergeProgress()` (0 = sunk, 1 = risen), and `HitTarget` counts the taps
 * it takes. Deciding what a tap *means* — points, hazards, clearing the field —
 * belongs to `PlayScreen`, which owns the stage rules.
 *
 * The body is drawn from circles as a placeholder for real art; swapping in a
 * sprite later only touches `createBody()`.
 */
export class Capy extends Entity {
    readonly type: CapyType;
    readonly hitTarget: HitTarget;
    readonly emerge: Emerge;

    /** Set by the screen; fired when the capy finishes sinking away. */
    onRetreated: (() => void) | null = null;

    /**
     * The hole it is standing in — not the one it was built in, because a
     * `runner` moves house. Its position is always relative to this, so only
     * `hopTo()` may write it.
     */
    private spot: Hole;
    /** Appearances still owed. Zero for everything but a `runner`. */
    private movesLeft: number;
    private readonly headRadius: number;
    private readonly flashOverlay: Graphics;
    private readonly pips: Graphics;
    private flashLeft = 0;
    private settled = false;

    constructor(type: CapyType, hole: Hole, hold = false) {
        super();

        this.type = type;
        this.spot = hole;
        this.hitTarget = new HitTarget(type);
        this.headRadius = hole.slot.radius * 0.7;
        this.movesLeft = type.hops ?? 0;

        // Matches the blocky head + muzzle, so a hit flash doesn't ring past it.
        const r0 = this.headRadius;
        this.flashOverlay = new Graphics()
            .roundRect(-r0 * 0.95, -r0 * 0.75, r0 * 1.9, r0 * 1.3, r0 * 0.4)
            .fill(0xffffff)
            .roundRect(-r0 * 0.725, r0 * 0.145, r0 * 1.45, r0 * 0.75, r0 * 0.32)
            .fill(0xffffff);
        this.flashOverlay.alpha = 0;
        this.pips = new Graphics();

        this.addChild(this.createBody(), this.flashOverlay, this.pips);

        // Must be attached, or `update()` never ticks it and the capy is
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

    /** Where it currently is. Moves when it hops. */
    get hole(): Hole {
        return this.spot;
    }

    /** True while it still has somewhere else to be. */
    get canHop(): boolean {
        return this.movesLeft > 0;
    }

    /**
     * Pop up in another hole instead of leaving for good.
     *
     * A capy's parent *is* its position — the hole's socket is what draws it
     * behind the hole's own lip — so moving house is a re-mount, and `mount()`
     * takes it out of the old socket without being asked.
     */
    hopTo(hole: Hole): void {
        this.movesLeft -= 1;
        this.spot = hole;
        hole.mount(this);
        this.setEmergeProgress(0);
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

    /** True once the screen has scored or swept this capy — never an escape. */
    markSettled(): void {
        this.settled = true;
    }

    get isSettled(): boolean {
        return this.settled;
    }

    /** Called by `Emerge` — moves and scales the capy as it rises or sinks. */
    setEmergeProgress(progress: number): void {
        const radius = this.hole.slot.radius;
        // Tuned against the hole for the blocky capybara silhouette: at 0 the
        // whole shape (hazard marker, muzzle corners *and* ears) tucks behind
        // the front lip; at 1 the muzzle sits just inside the rim so it reads
        // as standing in the hole.
        this.position.y = radius * (0.554 - 1.005 * progress);
        this.scale.set(0.55 + 0.45 * progress);
        this.pips.visible = progress >= PIP_MIN_PROGRESS;
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

        // Capybara silhouette: a blocky skull and a blunt, squared muzzle.
        // Deliberately built from rounded rectangles — a plain circle with
        // round ears on top reads "bear", which is what this replaces.
        body.roundRect(-r * 0.95, -r * 0.75, r * 1.9, r * 1.3, r * 0.4).fill(this.type.color);
        body.roundRect(-r * 0.725, r * 0.145, r * 1.45, r * 0.75, r * 0.32).fill(this.type.color);

        // Ears: tiny nubs poking above the top corners, not discs.
        body.circle(-r * 0.68, -r * 0.7, r * 0.16).fill(this.type.color);
        body.circle(r * 0.68, -r * 0.7, r * 0.16).fill(this.type.color);
        body.circle(-r * 0.68, -r * 0.7, r * 0.08).fill(this.type.accent);
        body.circle(r * 0.68, -r * 0.7, r * 0.08).fill(this.type.accent);

        // Eyes: high on the skull and wide apart, as a capybara's are.
        body.circle(-r * 0.52, -r * 0.3, r * 0.13).fill(0xffffff);
        body.circle(r * 0.52, -r * 0.3, r * 0.13).fill(0xffffff);
        body.circle(-r * 0.5, -r * 0.3, r * 0.065).fill(0x1b1b1b);
        body.circle(r * 0.5, -r * 0.3, r * 0.065).fill(0x1b1b1b);

        // Nose: a wide oval on the muzzle, darkened from the coat so it always
        // silhouettes — a fixed brown disappears on the dark bomb coat.
        const nose = darken(this.type.color, 0.62);
        body.ellipse(0, r * 0.42, r * 0.36, r * 0.26).fill(nose);
        body.circle(-r * 0.13, r * 0.38, r * 0.05).fill(0x1b1b1b);
        body.circle(r * 0.13, r * 0.38, r * 0.05).fill(0x1b1b1b);

        if (this.type.harmful) {
            // Warning marker above the skull, clear of the ears.
            body.poly([0, -r * 1.15, r * 0.22, -r * 0.68, -r * 0.22, -r * 0.68], true).fill(COLORS.hazard);
        } else if (this.type.effect === 'clear') {
            // Four-point sparkle, the mirror of the hazard's spike: "this one is
            // good news" has to read before the first tap, not after it.
            const points: number[] = [];
            for (let i = 0; i < 8; i++) {
                const angle = (Math.PI / 4) * i - Math.PI / 2;
                const arm = (i % 2 === 0 ? 0.26 : 0.095) * r;
                points.push(Math.cos(angle) * arm, -r * 0.95 + Math.sin(angle) * arm);
            }
            body.poly(points, true).fill(COLORS.white).stroke({ width: 2, color: this.type.accent });
        }

        return body;
    }

    /** Health pips above the head — only drawn for multi-hit capys. */
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

/** Push a hex colour toward black — `amount` in [0,1]. Keeps the hue. */
function darken(color: number, amount: number): number {
    const channel = (shift: number): number => Math.round(((color >> shift) & 0xff) * (1 - amount));
    return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}
