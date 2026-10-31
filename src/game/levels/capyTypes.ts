import type { CapyType, CapyTypeId } from './types';

/**
 * The five archetypes.
 *
 * `tough` and `runner` keep `staysWhenHit`, which is what makes "not every
 * capy goes straight back down after one whack" a rule rather than a special
 * case — `hp` decides how many whacks, and the type decides whether it lingers
 * (or, for a `runner`, relocates).
 *
 * Colours are placeholders for real art; they are read by the shapes drawn in
 * `entities/Capy.ts` and by the star bursts a whack throws in `PlayScreen`.
 */
export const CAPY_TYPES: Record<CapyTypeId, CapyType> = {
    normal: {
        id: 'normal',
        points: 10,
        hp: 1,
        staysWhenHit: false,
        upMs: 1500,
        emergeMs: 260,
        color: 0xffd6a5,
        accent: 0x4a3520,
    },
    tough: {
        id: 'tough',
        points: 30,
        hp: 3,
        staysWhenHit: true,
        upMs: 2600,
        emergeMs: 300,
        color: 0xff8fab,
        accent: 0x4a3520,
    },
    bomb: {
        id: 'bomb',
        points: -25,
        hp: 1,
        staysWhenHit: false,
        upMs: 1800,
        emergeMs: 260,
        harmful: true,
        color: 0x3a3f4b,
        accent: 0xff5a5f,
    },
    golden: {
        id: 'golden',
        points: 10,
        hp: 1,
        staysWhenHit: false,
        upMs: 1600,
        emergeMs: 260,
        effect: 'clear',
        color: 0xffd166,
        accent: 0x8a5a00,
    },
    runner: {
        id: 'runner',
        points: 20,
        hp: 2,
        // The one type that *moves*: every whack sends it to another hole, so
        // the second tap has to travel. Every other archetype is a decision
        // about timing; this one is about aim.
        //
        // A hurt runner with a hop left relocates straight away. This flag only
        // comes into play once it is out of hops, when it lingers like a
        // `tough` for a finishing tap.
        staysWhenHit: true,
        hops: 2,
        upMs: 650,
        // Up and down faster than anything else: the hop is the tell, and a
        // slow rise or dive reads as the capy drifting rather than running.
        emergeMs: 180,
        color: 0xc8b6ff,
        accent: 0x4a3520,
    },
};
