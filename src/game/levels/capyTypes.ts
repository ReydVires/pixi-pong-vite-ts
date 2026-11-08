import type { CapyType, CapyTypeId } from './types';

/**
 * The five archetypes.
 *
 * `tough` and `runner` keep `staysWhenHit`, which is what makes "not every
 * capy goes straight back down after one whack" a rule rather than a special
 * case — `hp` decides how many whacks, and the type decides whether it lingers
 * (or, for a `runner`, relocates).
 *
 * Coats are sampled from the SansanPlanet reference art — rose-tan fur, coral,
 * warm charcoal, orange and a muted lilac. They are read by the shapes drawn in
 * `entities/Capy.ts` and by the star bursts a whack throws in `PlayScreen`, so
 * each archetype keeps a hue the player can name at a glance. Each archetype
 * also carries a `hurt` palette shaded from that same hue, so the hit face
 * blends with the coat instead of sitting on top of it.
 */
export const CAPY_TYPES: Record<CapyTypeId, CapyType> = {
    normal: {
        id: 'normal',
        points: 10,
        hp: 1,
        staysWhenHit: false,
        upMs: 1500,
        emergeMs: 260,
        color: 0xcd9a86,
        accent: 0x2d2b2a,
        hurt: { mouth: 0x8f6353, tongue: 0xd98f7d, tear: 0xead0c0 },
    },
    tough: {
        id: 'tough',
        points: 30,
        hp: 3,
        staysWhenHit: true,
        upMs: 2600,
        emergeMs: 300,
        color: 0xd86868,
        accent: 0x2d2b2a,
        hurt: { mouth: 0x9c4a4a, tongue: 0xdd8585, tear: 0xf0c0bd },
    },
    bomb: {
        id: 'bomb',
        points: -25,
        hp: 1,
        staysWhenHit: false,
        upMs: 1800,
        emergeMs: 260,
        harmful: true,
        color: 0x2d2b2a,
        accent: 0xd86868,
        hurt: { mouth: 0x171110, tongue: 0x8a5550, tear: 0xb9a9a2 },
    },
    golden: {
        id: 'golden',
        points: 10,
        hp: 1,
        staysWhenHit: false,
        upMs: 1600,
        emergeMs: 260,
        effect: 'clear',
        color: 0xe8a848,
        accent: 0x675247,
        hurt: { mouth: 0xb4762a, tongue: 0xe9b06b, tear: 0xf6d9a6 },
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
        // The reference has no purple, so the old lavender is kept at half its
        // chroma: still the runner's, still quieter than the sampled hues.
        color: 0xb7aed3,
        accent: 0x2d2b2a,
        hurt: { mouth: 0x766b98, tongue: 0xc9bde2, tear: 0xe4ddf2 },
    },
};
