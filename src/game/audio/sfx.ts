import type { AudioManager, SoundRecipe } from '../core/audio/AudioManager';
import { noise, tone } from '../core/audio/synth';

/**
 * Every sound the game makes, by name.
 *
 * The names *are* the API: screens call `audio.play(SFX.whack)` and never a
 * recipe directly, so the bank below can be re-voiced — or swapped for
 * recorded files — without touching a single screen.
 */
export const SFX = {
    tap: 'tap',
    whack: 'whack',
    wound: 'wound',
    hazard: 'hazard',
    miss: 'miss',
    clear: 'clear',
    combo: 'combo',
    win: 'win',
} as const;

export type SfxName = (typeof SFX)[keyof typeof SFX];

/**
 * The recipes behind those names — all synthesised, so the game ships with
 * sound and not a byte of audio to download.
 *
 * `o.volume` and `o.rate` come from the caller: rate is the pitch knob, which
 * is how the whack rises with the combo and the milestone jingle rises with
 * the tier. Two ground rules keep the mix readable:
 *
 * - **Levels are relative.** The thud is the loudest thing in the game and
 *   everything else is placed against it; nothing is anywhere near clipping.
 * - **Shape says what happened.** Falling = bad (miss, bomb), rising = good
 *   (the sweep, the milestone), a dead stop = an impact (the whack).
 */
export const SFX_RECIPES: Record<SfxName, SoundRecipe> = {
    /** UI click: bright, and over before the tap is. */
    [SFX.tap]: (ctx, out, o) => {
        tone(ctx, out, { wave: 'triangle', freq: 640, freqTo: 900, ms: 70, gain: 0.18 * o.volume, rate: o.rate });
    },

    /** A capy takes the finishing blow: a body thud topped with a crack. */
    [SFX.whack]: (ctx, out, o) => {
        tone(ctx, out, { wave: 'sine', freq: 220, freqTo: 70, ms: 140, gain: 0.5 * o.volume, rate: o.rate });
        noise(ctx, out, { ms: 80, cutoff: 2600, cutoffTo: 420, gain: 0.3 * o.volume, rate: o.rate });
    },

    /** A wound, not a kill: the same hit with the weight taken out of it. */
    [SFX.wound]: (ctx, out, o) => {
        tone(ctx, out, { wave: 'sine', freq: 300, freqTo: 150, ms: 80, gain: 0.32 * o.volume, rate: o.rate });
    },

    /** A bomb: a falling buzz, deliberately nothing like the thud. */
    [SFX.hazard]: (ctx, out, o) => {
        tone(ctx, out, { wave: 'sawtooth', freq: 320, freqTo: 70, ms: 280, gain: 0.3 * o.volume, rate: o.rate });
        noise(ctx, out, { ms: 200, cutoff: 1400, cutoffTo: 180, gain: 0.22 * o.volume, rate: o.rate });
    },

    /** A whiff. Falling, short and thin — never mistakable for a hit. */
    [SFX.miss]: (ctx, out, o) => {
        tone(ctx, out, { wave: 'square', freq: 300, freqTo: 170, ms: 150, gain: 0.16 * o.volume, rate: o.rate });
    },

    /** The golden's sweep: a shimmer rising out across the whole field. */
    [SFX.clear]: (ctx, out, o) => {
        tone(ctx, out, { wave: 'sine', freq: 320, freqTo: 1500, ms: 420, gain: 0.24 * o.volume, rate: o.rate });
        noise(ctx, out, { ms: 380, cutoff: 900, cutoffTo: 6000, gain: 0.12 * o.volume, rate: o.rate });
    },

    /** The combo ladder stepping up: a three-note rise, pitched by the tier. */
    [SFX.combo]: (ctx, out, o) => {
        [523.25, 659.25, 783.99].forEach((freq, i) => {
            tone(ctx, out, { wave: 'triangle', freq, ms: 120, gain: 0.2 * o.volume, rate: o.rate, delay: i * 80 });
        });
    },

    /** The finale, the moment the present opens: a four-note flourish. */
    [SFX.win]: (ctx, out, o) => {
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
            tone(ctx, out, { wave: 'triangle', freq, ms: 300, gain: 0.2 * o.volume, rate: o.rate, delay: i * 130 });
        });
    },
};

/** Hand the whole bank to the audio manager, once, at startup. */
export function registerSfx(audio: AudioManager): void {
    audio.registerAll(SFX_RECIPES);
}
