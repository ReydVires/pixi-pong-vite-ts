import { AUDIO_SETTINGS } from '../../config';

/** Per-play overrides. */
export interface SoundOptions {
    /** Extra level on top of the recipe's own, 0..1. @default 1 */
    volume?: number;
    /** Pitch multiplier: `1` plays the sound as written. @default 1 */
    rate?: number;
}

/** What a recipe actually receives — the defaults, already applied. */
export type ResolvedSoundOptions = Required<SoundOptions>;

/**
 * A sound written as code rather than shipped as a file: it builds its nodes
 * on `ctx`, routes them into `out` (the effects bus) and starts them. Anything
 * Web Audio can do is fair game; `synth.ts` has the usual two ingredients.
 */
export type SoundRecipe = (ctx: AudioContext, out: AudioNode, options: ResolvedSoundOptions) => void;

/** A sound file, shaped like the `ASSETS` / `FONTS` registries in `config.ts`. */
export interface AudioDefinition {
    /** Key the sound gets registered and played under. */
    alias: string;
    /** Path relative to the site base. */
    src: string;
}

/** What counts as a user gesture for the browser's autoplay policy. */
const GESTURES = ['pointerdown', 'keydown', 'touchstart'] as const;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * All of the game's sound, with none of its files.
 *
 * Sounds are registered as *recipes* — small functions that schedule nodes on
 * one shared `AudioContext` — so a project can ship synthesised effects from
 * day one and drop in recorded files later (`load()`) without changing how
 * anything is played: screens only ever call `play('whack')`.
 *
 * Two browser rules shape the design:
 *
 * - An `AudioContext` may only start from a user gesture, so the context is
 *   created lazily and the first tap or keypress resumes it. Anything played
 *   before that is dropped rather than queued, so a page never bursts into a
 *   pile of stacked sounds the moment the player touches something.
 * - The player's volume and mute choice is theirs, so it is remembered in
 *   `localStorage` and survives a reload.
 */
export class AudioManager {
    private ctx: AudioContext | null = null;
    private master: GainNode | null = null;
    private sfx: GainNode | null = null;

    private readonly recipes = new Map<string, SoundRecipe>();
    private readonly buffers = new Map<string, AudioBuffer>();

    private volumeValue: number = AUDIO_SETTINGS.masterVolume;
    private mutedValue: boolean = AUDIO_SETTINGS.muted;
    private unlockedValue = false;

    /**
     * Runs in the capture phase, so a screen's own tap handler fires *after*
     * the unlock — which is what lets the very first tap make a sound.
     */
    private readonly handleGesture = (): void => {
        void this.unlock();
    };

    constructor() {
        this.readSettings();
        for (const type of GESTURES) {
            window.addEventListener(type, this.handleGesture, { capture: true, passive: true });
        }
    }

    // --- Settings ------------------------------------------------------------

    /** Master level, 0..1. */
    get volume(): number {
        return this.volumeValue;
    }

    /** Whether sound is off. */
    get muted(): boolean {
        return this.mutedValue;
    }

    /** True once a user gesture has been seen and the context started. */
    get unlocked(): boolean {
        return this.unlockedValue;
    }

    /** The live context, or `null` while nothing has needed one. */
    get context(): AudioContext | null {
        return this.ctx;
    }

    /** Context state, or `'none'` before a context exists. */
    get state(): AudioContextState | 'none' {
        return this.ctx?.state ?? 'none';
    }

    /** Set the master level. Values outside 0..1 are clamped. */
    setVolume(value: number): void {
        this.volumeValue = clamp01(value);
        this.applyGain();
        this.saveSettings();
    }

    setMuted(muted: boolean): void {
        this.mutedValue = muted;
        this.applyGain();
        this.saveSettings();
    }

    /** Flip mute and return the new state — the whole body of a toggle button. */
    toggleMuted(): boolean {
        this.setMuted(!this.mutedValue);
        return this.mutedValue;
    }

    // --- Lifecycle -----------------------------------------------------------

    /**
     * Create (or resume) the audio context. Called automatically on the first
     * gesture; call it yourself if something only works on a running context.
     * Safe to call repeatedly.
     */
    async unlock(): Promise<void> {
        const ctx = this.ensureContext();
        // Flagged before awaiting: the press that unlocked audio should be
        // allowed to play its own sound, not just the ones after it.
        this.unlockedValue = true;
        this.detachGestures();

        if (ctx.state === 'running') return;

        try {
            await ctx.resume();
        } catch {
            // A browser may refuse until some *later* gesture; the next tap
            // tries again. Nothing to report — this is a policy, not a bug.
        }
    }

    /** Close the context and release every listener. */
    destroy(): void {
        this.detachGestures();
        void this.ctx?.close();
        this.ctx = null;
        this.master = null;
        this.sfx = null;
        this.unlockedValue = false;
    }

    // --- Sounds --------------------------------------------------------------

    /** Register a synthesised sound under `name`. Chainable. */
    register(name: string, recipe: SoundRecipe): this {
        this.recipes.set(name, recipe);
        return this;
    }

    /** Register a whole bank at once — see `src/game/audio/sfx.ts`. */
    registerAll(bank: Record<string, SoundRecipe>): this {
        for (const [name, recipe] of Object.entries(bank)) this.register(name, recipe);
        return this;
    }

    /** Whether anything is registered under `name`. */
    has(name: string): boolean {
        return this.recipes.has(name);
    }

    /**
     * Play a registered sound.
     *
     * Returns whether anything was scheduled. An unknown name is a warning and
     * a `false`, never a throw — a typo in a sound name should not be able to
     * take a screen down mid-tap.
     */
    play(name: string, options: SoundOptions = {}): boolean {
        const recipe = this.recipes.get(name);
        if (!recipe) {
            console.warn(`[audio] no sound registered as "${name}"`);
            return false;
        }

        // Muted means silent, not turned down: there is nothing to schedule,
        // and no half-played sound left waiting for the player to unmute.
        if (this.mutedValue) return false;

        // Before the first gesture the context is suspended, so a sound played
        // now would arrive late and all at once.
        if (!this.unlockedValue) return false;

        const ctx = this.ensureContext();
        if (!this.sfx) return false;

        recipe(ctx, this.sfx, {
            volume: options.volume ?? 1,
            rate: options.rate ?? 1,
        });
        return true;
    }

    /**
     * Fetch, decode and register a sound file, so `play(alias)` treats it like
     * any synthesised sound.
     *
     * A missing or undecodable file warns and resolves to `null`: audio is
     * decoration, and decoration must never be able to break the game.
     */
    async load(definition: AudioDefinition): Promise<AudioBuffer | null> {
        const ctx = this.ensureContext();

        try {
            const response = await fetch(definition.src);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
            this.buffers.set(definition.alias, buffer);
            this.register(definition.alias, (context, out, options) => {
                const source = context.createBufferSource();
                source.buffer = buffer;
                source.playbackRate.value = options.rate;

                const gain = context.createGain();
                gain.gain.value = options.volume;

                source.connect(gain);
                gain.connect(out);
                source.start();
            });
            return buffer;
        } catch (error) {
            console.warn(`[audio] could not load "${definition.alias}" (${definition.src})`, error);
            return null;
        }
    }

    /** Load several files, reporting progress 0..1 like `AssetLoader.load`. */
    async loadAll(
        definitions: readonly AudioDefinition[],
        onProgress?: (progress: number) => void,
    ): Promise<void> {
        for (let i = 0; i < definitions.length; i++) {
            await this.load(definitions[i]);
            onProgress?.((i + 1) / definitions.length);
        }
    }

    /** The decoded buffer behind a loaded file, if there is one. */
    buffer(alias: string): AudioBuffer | undefined {
        return this.buffers.get(alias);
    }

    // --- Internals -----------------------------------------------------------

    /** Build the context and its gain graph the first time something needs it. */
    private ensureContext(): AudioContext {
        if (this.ctx) return this.ctx;

        const ctx = new AudioContext();

        // master → speakers, and the effects bus into master, so mute and
        // volume are one knob each instead of a walk over every voice.
        const master = ctx.createGain();
        master.gain.value = this.mutedValue ? 0 : this.volumeValue;
        master.connect(ctx.destination);

        const sfx = ctx.createGain();
        sfx.gain.value = AUDIO_SETTINGS.sfxVolume;
        sfx.connect(master);

        this.ctx = ctx;
        this.master = master;
        this.sfx = sfx;
        return ctx;
    }

    /** Push volume/mute onto the master bus, ramped so it never clicks. */
    private applyGain(): void {
        if (!this.master || !this.ctx) return;
        this.master.gain.setTargetAtTime(this.mutedValue ? 0 : this.volumeValue, this.ctx.currentTime, 0.01);
    }

    private detachGestures(): void {
        for (const type of GESTURES) {
            window.removeEventListener(type, this.handleGesture, { capture: true });
        }
    }

    private readSettings(): void {
        try {
            const saved = window.localStorage.getItem(AUDIO_SETTINGS.storageKey);
            if (!saved) return;

            const parsed = JSON.parse(saved) as Partial<{ volume: number; muted: boolean }>;
            if (typeof parsed.volume === 'number') this.volumeValue = clamp01(parsed.volume);
            if (typeof parsed.muted === 'boolean') this.mutedValue = parsed.muted;
        } catch {
            // No storage (private mode) or a corrupt value: keep the defaults.
        }
    }

    private saveSettings(): void {
        try {
            window.localStorage.setItem(
                AUDIO_SETTINGS.storageKey,
                JSON.stringify({ volume: this.volumeValue, muted: this.mutedValue }),
            );
        } catch {
            // Remembering the choice is a nicety, never a requirement.
        }
    }
}
