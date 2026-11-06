import { HIT_WORDS } from '../config';
import type { HitWordKind } from '../config';

/**
 * Deals the hit-word tables in shuffled rounds.
 *
 * A plain random pick repeats often enough to be noticed — "POW! POW!" reads
 * as a bug, not a style. Every word in a list is therefore dealt once before
 * any can come back, and each outcome keeps its own deck so a bomb never eats
 * into the whack words.
 */
export class HitWords {
    private readonly decks: Record<HitWordKind, string[]> = {
        downed: [],
        wound: [],
        hazard: [],
    };

    next(kind: HitWordKind): string {
        const deck = this.decks[kind];
        if (deck.length === 0) deck.push(...shuffled(HIT_WORDS[kind]));
        return deck.pop()!;
    }
}

/** Fisher–Yates over a copy; the caller's table stays readonly. */
function shuffled(source: readonly string[]): string[] {
    const words = [...source];
    for (let i = words.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [words[i], words[j]] = [words[j], words[i]];
    }
    return words;
}
