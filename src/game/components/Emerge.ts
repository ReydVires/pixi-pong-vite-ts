import type { Component } from '../core/entities/Component';

export type EmergeState = 'hidden' | 'emerging' | 'active' | 'retreating';

/** What `Emerge` drives on the thing it is attached to. */
export interface EmergeTarget {
    /** `0` = fully sunk in the hole, `1` = fully risen. */
    setEmergeProgress(progress: number): void;
}

export interface EmergeOptions {
    /** Time to rise, and equally to sink, in ms. */
    emergeMs: number;
    /** Time spent fully risen before escaping, in ms. */
    upMs: number;
    /** Never auto-retreat — the player must whack it to send it down. */
    hold?: boolean;
    /** Fired once, when the capy finishes sinking out of sight. */
    onRetreated?: () => void;
}

/**
 * The life cycle of one capy: `hidden → emerging → active → retreating`,
 * then back to `hidden` via `onRetreated`.
 *
 * `hittable` is the only thing callers need to gate taps on, and `retain()`
 * is the escape hatch the screen uses to give a wounded capy time to finish.
 * Time only ever advances from `update(dt)`, so pausing the screen freezes it.
 */
export class Emerge implements Component {
    private current: EmergeState = 'hidden';
    private timer = 0;
    private retainLeft = 0;

    constructor(
        private readonly target: EmergeTarget,
        private readonly options: EmergeOptions,
    ) {}

    get state(): EmergeState {
        return this.current;
    }

    /** True while a tap on this capy should count. */
    get hittable(): boolean {
        return this.current === 'emerging' || this.current === 'active';
    }

    /** Rise out of the hole. No-op unless the capy is still `hidden`. */
    start(): void {
        if (this.current !== 'hidden') return;
        this.current = 'emerging';
        this.timer = 0;
        this.target.setEmergeProgress(0);
    }

    /** Sink back down — used for both a whack and an escape. */
    retreat(): void {
        if (this.current !== 'emerging' && this.current !== 'active') return;
        this.current = 'retreating';
        this.timer = 0;
        this.retainLeft = 0;
    }

    /** Keep it up for `ms` past its window, so a wound can be finished off. */
    retain(ms: number): void {
        this.retainLeft = Math.max(this.retainLeft, ms);
    }

    update(dt: number): void {
        if (this.current === 'hidden') return;
        this.timer += dt;

        switch (this.current) {
            case 'emerging': {
                const progress = Math.min(1, this.timer / this.options.emergeMs);
                this.target.setEmergeProgress(progress);
                if (progress >= 1) {
                    this.current = 'active';
                    this.timer = 0;
                }
                break;
            }
            case 'active': {
                if (this.retainLeft > 0) {
                    this.retainLeft -= dt;
                    break;
                }
                if (!this.options.hold && this.timer >= this.options.upMs) {
                    this.retreat();
                }
                break;
            }
            case 'retreating': {
                const progress = Math.max(0, 1 - this.timer / this.options.emergeMs);
                this.target.setEmergeProgress(progress);
                if (progress <= 0) {
                    this.current = 'hidden';
                    this.timer = 0;
                    this.target.setEmergeProgress(0);
                    this.options.onRetreated?.();
                }
                break;
            }
        }
    }
}
