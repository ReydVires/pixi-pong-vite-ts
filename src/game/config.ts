import type { ColorSource } from 'pixi.js';

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
export const CLEAR_COLOR: ColorSource = 0x028af8;

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
    /** Results backdrop. */
    results: 0x2b1a5e,
    /** Stars and bonus points. */
    star: 0xffd166,
    /** Hazards and penalties. */
    hazard: 0xff5a5f,
} as const;

/** Unique keys used with `ScreenManager.register` and `ScreenManager.start`. */
export const SCREENS = {
    Preloader: 'Preloader',
    MainMenu: 'MainMenu',
    Play: 'Play',
    Results: 'Results',
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
