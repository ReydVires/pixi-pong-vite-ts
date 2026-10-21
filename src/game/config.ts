import { Color, type ColorSource } from 'pixi.js';

/** Logical game resolution. Portrait by default. */
export const GAME_WIDTH = 768;
export const GAME_HEIGHT = 1024;

/** Center of the design resolution — handy for laying out UI. */
export const SCREEN_CENTER = { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 };

/**
 * Viewport thresholds (in CSS pixels), measured against the *shortest* side
 * so the breakpoint doesn't flip when the device rotates.
 *
 * shortest < tablet  -> "mobile"
 * shortest < desktop -> "tablet"
 * otherwise          -> "desktop"
 */
export const BREAKPOINTS = { tablet: 600, desktop: 900 } as const;

/** Color shown before the first screen draws anything. */
export const CLEAR_COLOR: ColorSource = new Color('#028af8');

/** Palette used by the screens. */
export const COLORS = {
    clear: 0x028af8,
    white: 0xffffff,
    black: 0x000000,
    /** Playfield ground behind the honeycomb. */
    playfield: 0x1f6f3f,
    /** Hole mound / rim. */
    mound: 0x6b4a2f,
    /** Dark hole interior. */
    pit: 0x140d05,
    /** Primary button and highlight. */
    accent: 0xff7aa2,
    /** Stars and bonus points. */
    star: 0xffd166,
    /** Hazards and penalties. */
    hazard: 0xff5a5f,
    /** Night sky the finale's fireworks play against. */
    sky: 0x0a0f24,
} as const;

/** Unique keys used with `ScreenManager.register` and `ScreenManager.start`. */
export const SCREENS = {
    Preloader: 'Preloader',
    MainMenu: 'MainMenu',
    Play: 'Play',
    Celebration: 'Celebration',
    Letter: 'Letter',
} as const;

/** Bundled text face. The preloader loads it before any label is created. */
export const FONT_FAMILY = 'Titan One';

/** Registry of static assets. Keep every alias/path here so it is easy to swap. */
export const ASSETS = {
    background: { alias: 'background', src: 'assets/bg.png' },
    logo: { alias: 'logo', src: 'assets/logo.svg' },
} as const;

/**
 * Registry of bundled web fonts. Drop a `.woff2` into `public/assets/fonts/`
 * and list it here, then `await assets.loadFont(...)` before creating text.
 */
export const FONTS = {
    display: {
        alias: 'font-display',
        src: 'assets/fonts/titan-one.woff2',
        family: FONT_FAMILY,
    },
} as const;

/**
 * Audio defaults.
 *
 * Sounds are synthesised rather than loaded (see `core/audio/synth.ts` and
 * `audio/sfx.ts`), so there is nothing to ship and no preloading to do. To add
 * recorded sounds instead, register them with `audio.load({ alias, src })` and
 * put the files in `public/assets/audio/`.
 */
export const AUDIO_SETTINGS = {
    /** Master level, 0..1. */
    masterVolume: 0.8,
    /** Level of the effects bus, relative to master. */
    sfxVolume: 1,
    /** Start muted? Read from storage first if the player has chosen before. */
    muted: false,
    /** Where the player's own volume/mute choice is remembered. */
    storageKey: 'whack-a-capy:audio',
} as const;

/**
 * The personal half of the finale — edit the words, not the code.
 *
 * `gift` is optional in practice: drop a picture at `public/assets/gift.png`
 * and it is used as-is. Until then the celebration draws its own present box,
 * so a missing file can never break the ending.
 */
export const CELEBRATION = {
    /** Small line above the title. */
    name: 'For you',
    title: 'Happy Birthday!',
    message: 'You cleared every stage. Time for your real present.',
    gift: 'assets/gift.png',

    /** The letter behind the "Read the letter" button. One string per line. */
    letterTitle: 'A note for you',
    letter: [
        'You cleared every stage,',
        'every combo, every hazard.',
        '',
        'This is the part where I run out of',
        'levels and have to say it plainly:',
        '',
        'happy birthday.',
        '',
        'Thanks for playing.',
    ],
} as const;

/**
 * What the combo ladder shouts at each step up, keyed by multiplier.
 *
 * The shout replaces nothing: a milestone keeps its sparks and its score, and
 * gets this on top. There is no entry for x1, because the ladder starts there.
 * A ladder longer than the table still gets its kick, just no word.
 *
 * Content, like `CELEBRATION`: edit the words, not the code.
 */
export const COMBO_WORDS: Record<number, string> = {
    2: 'NICE!',
    3: 'GREAT!',
    4: 'AWESOME!',
    6: 'UNSTOPPABLE!',
    9: 'CAPY MASTER!',
    12: 'CAPY LEGEND!',
    14: 'KEEP UP!',
    20: 'UNBEATABLE!',
};
