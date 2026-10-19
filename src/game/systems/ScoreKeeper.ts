import type { CapyType } from '../levels/types';

/** Running score. Clamped at zero — hazards can cost points, never a deficit. */
export class ScoreKeeper {
    private value = 0;

    get score(): number {
        return this.value;
    }

    add(points: number): void {
        this.value = Math.max(0, this.value + points);
    }

    reset(): void {
        this.value = 0;
    }
}

/**
 * Stars earned for `score`: `n + 1` stars for clearing `thresholds[n]`.
 * `0` means the stage was played but the first threshold wasn't reached.
 */
export function starsFor(score: number, thresholds: readonly [number, number, number]): number {
    if (score >= thresholds[2]) return 3;
    if (score >= thresholds[1]) return 2;
    if (score >= thresholds[0]) return 1;
    return 0;
}

/**
 * Stars required to unlock the next stage.
 *
 * Below this a result does not advance: the player replays the stage. It is
 * deliberately the *first* star — the bar is "you engaged with the stage", not
 * "you mastered it", so a run never dead-ends.
 */
export const STARS_TO_ADVANCE = 1;

/** Whether a result opens the next stage, or sends the player back to this one. */
export function canAdvance(stars: number): boolean {
    return stars >= STARS_TO_ADVANCE;
}

/** What a single tap is worth, before anything is applied. */
export interface TapOutcome {
    /** Points to add to the score — negative for hazards. */
    points: number;
    /** `true` for a scoring whack: counts as a hit and extends the combo. */
    hit: boolean;
}

/**
 * Resolve a tap against an archetype.
 *
 * Hazards sit deliberately *outside* the combo: a bomb's penalty is a flat
 * number that *breaks* the streak. Routing it through the multiplier would
 * penalise a good run hardest, and counting it as a `hit` would reward it.
 */
export function tapOutcome(type: CapyType, multiplier: number): TapOutcome {
    if (type.harmful) return { points: type.points, hit: false };
    return { points: type.points * multiplier, hit: true };
}

/**
 * Points a clear effect farms from *each* capy it sweeps.
 *
 * Flat and type-blind by design: a `golden` pays the same for everything
 * standing, so a swept `bomb` is a bounty rather than the −25 its own tap
 * would have cost. Nothing about the swept capy changes the number.
 *
 * It is also not a whack — see `PlayScreen.clearField` — so it moves the score
 * and nothing else, leaving the combo and the accuracy tally to the taps the
 * player actually made.
 */
export const SWEEP_POINTS = 20;
