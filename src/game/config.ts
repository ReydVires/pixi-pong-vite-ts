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
    game: 0x00ff00,
    gameOver: 0xff0000,
    white: 0xffffff,
    black: 0x000000,
    /** Pong playfield background. */
    pong: 0x101828,
    /** Pong center line + paddles. */
    pongAccent: 0x4ade80,
} as const;

/** Unique keys used with `ScreenManager.register` and `ScreenManager.start`. */
export const SCREENS = {
    Preloader: 'Preloader',
    MainMenu: 'MainMenu',
    Game: 'Game',
    GameOver: 'GameOver',
} as const;

/** Registry of static assets. Keep every alias/path here so it is easy to swap. */
export const ASSETS = {
    background: { alias: 'background', src: 'assets/bg.png' },
    logo: { alias: 'logo', src: 'assets/logo.png' },
} as const;
