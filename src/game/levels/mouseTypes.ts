import type { MouseType, MouseTypeId } from './types';

/**
 * The five archetypes.
 *
 * `tough` and `runner` keep `staysWhenHit`, which is what makes "not every
 * mouse goes straight back down after one whack" a rule rather than a special
 * case — `hp` decides how many whacks, the type decides whether it lingers.
 *
 * Colours are placeholders for real art; nothing reads them but the shapes
 * drawn in `entities/Mouse.ts`.
 */
export const MOUSE_TYPES: Record<MouseTypeId, MouseType> = {
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
        staysWhenHit: true,
        upMs: 2200,
        emergeMs: 200,
        color: 0xc8b6ff,
        accent: 0x4a3520,
    },
};
