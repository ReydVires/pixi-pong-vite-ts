/**
 * The two ingredients every synthesised sound is built from.
 *
 * Both schedule their whole envelope up front and let Web Audio run it, so
 * nothing here has to be ticked per frame or cleaned up by hand: create the
 * nodes, start them, forget them. Everything is measured in the context's own
 * clock, which means a burst is placed exactly relative to whatever is already
 * playing rather than to the next animation frame.
 */

/** Knobs both primitives share. */
export interface VoiceOptions {
    /** How long the sound lasts, in milliseconds. */
    ms: number;
    /** Peak level, 0..1. @default 0.3 */
    gain?: number;
    /** Wait before starting, in milliseconds — this is what makes arpeggios. @default 0 */
    delay?: number;
    /** Pitch multiplier, so one recipe can play higher or lower. @default 1 */
    rate?: number;
}

/** A pitched blip: an oscillator with a fast attack and a long tail. */
export interface ToneOptions extends VoiceOptions {
    /** Waveform. `'sine'` is round and soft, `'sawtooth'`/`'square'` are buzzy. @default 'square' */
    wave?: OscillatorType;
    /** Starting frequency, in Hz. */
    freq: number;
    /** Frequency to glide to by the end, in Hz. @default `freq` — no glide */
    freqTo?: number;
    /** Attack time, in seconds. @default 0.005 */
    attack?: number;
}

/** A burst of white noise through a low-pass filter: impacts, clicks, sweeps. */
export interface NoiseOptions extends VoiceOptions {
    /** Filter cutoff at the start, in Hz. @default 4000 */
    cutoff?: number;
    /** Cutoff to sweep to by the end, in Hz. */
    cutoffTo?: number;
    /** Filter resonance: higher is more whistle-y. @default 0.7 */
    q?: number;
}

const DEFAULT_GAIN = 0.3;
const DEFAULT_ATTACK = 0.005;

/** Ramps can't reach zero on an exponential curve — they get as close as this. */
const SILENCE = 0.0001;

const seconds = (ms: number): number => ms / 1000;

/** A gain shaft that snaps up and slides down: a hit, not a hum. */
function envelope(ctx: AudioContext, ctxTime: number, peak: number, attack: number, end: number): GainNode {
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctxTime);
    gain.gain.linearRampToValueAtTime(peak, Math.min(ctxTime + attack, end));
    gain.gain.exponentialRampToValueAtTime(SILENCE, end);
    return gain;
}

/**
 * Play one note. Frequency automation is exponential, which is how pitch is
 * actually heard: `freq` halving sounds like a fall of one octave either way.
 */
export function tone(ctx: AudioContext, out: AudioNode, options: ToneOptions): void {
    const rate = options.rate ?? 1;
    const start = ctx.currentTime + seconds(options.delay ?? 0);
    const end = start + seconds(options.ms);
    const attack = options.attack ?? DEFAULT_ATTACK;

    const osc = ctx.createOscillator();
    osc.type = options.wave ?? 'square';
    osc.frequency.setValueAtTime(Math.max(options.freq * rate, 1), start);
    if (options.freqTo !== undefined) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(options.freqTo * rate, 1), end);
    }

    const gain = envelope(ctx, start, Math.max(options.gain ?? DEFAULT_GAIN, SILENCE), attack, end);

    osc.connect(gain);
    gain.connect(out);
    osc.start(start);
    osc.stop(end + 0.02);
}

/**
 * Play one burst of noise. The filter sweep is what turns the same source into
 * a click (`cutoff: 2600 -> 420`), a thud or a rising shimmer.
 *
 * Bursts are cut from a one-second buffer, so keep `ms` under a second.
 */
export function noise(ctx: AudioContext, out: AudioNode, options: NoiseOptions): void {
    const rate = options.rate ?? 1;
    const start = ctx.currentTime + seconds(options.delay ?? 0);
    const end = start + seconds(options.ms);
    const peak = Math.max(options.gain ?? DEFAULT_GAIN, SILENCE);

    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer(ctx);
    source.playbackRate.value = rate;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = options.q ?? 0.7;
    filter.frequency.setValueAtTime(Math.max((options.cutoff ?? 4000) * rate, 1), start);
    if (options.cutoffTo !== undefined) {
        filter.frequency.exponentialRampToValueAtTime(Math.max(options.cutoffTo * rate, 1), end);
    }

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(peak, start);
    gain.gain.exponentialRampToValueAtTime(SILENCE, end);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    source.start(start);
    source.stop(end + 0.02);
}

/**
 * One second of white noise per context, reused by every burst.
 *
 * A whack can fire a dozen times a second; filling a fresh buffer for each one
 * would hand the garbage collector a steady stream of small arrays for nothing.
 */
const noiseCache = new WeakMap<AudioContext, AudioBuffer>();

function noiseBuffer(ctx: AudioContext): AudioBuffer {
    const cached = noiseCache.get(ctx);
    if (cached) return cached;

    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;

    noiseCache.set(ctx, buffer);
    return buffer;
}
