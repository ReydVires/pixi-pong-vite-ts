import type { CapyType } from '../levels/types';

/**
 * How many taps a capy takes before it goes down.
 *
 * This is data plus one rule, not per-frame behavior — the screen reads it
 * after each tap. `hp > 1` is what makes `tough` and `runner` linger instead
 * of going straight back down after the first whack.
 */
export class HitTarget {
    private hp: number;

    constructor(readonly type: CapyType) {
        this.hp = type.hp;
    }

    get remainingHp(): number {
        return Math.max(0, this.hp);
    }

    get downed(): boolean {
        return this.hp <= 0;
    }

    /** Record a tap; returns `true` when it was the finishing blow. */
    hit(): boolean {
        if (this.downed) return false;
        this.hp -= 1;
        return this.downed;
    }

    /** Resolve the capy without a tap — used when a clear effect sweeps it up. */
    forceDown(): void {
        this.hp = 0;
    }
}
