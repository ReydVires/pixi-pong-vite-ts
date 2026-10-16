import type { Application, Container } from 'pixi.js';
import type { AssetLoader } from '../assets/AssetLoader';
import type { PointerInput } from '../input/PointerInput';
import type { Responsive, ViewportMetrics } from '../responsive/Responsive';
import type { ScreenManager } from './ScreenManager';

/** Everything a screen is allowed to reach out to. */
export interface ScreenContext {
    /** The running Pixi application (renderer, ticker, screen bounds). */
    readonly app: Application;

    /**
     * Gameplay/backdrop root. Shares the design coordinate space, but the
     * visible area extends beyond it — use `responsive.visibleBounds` for
     * full-bleed artwork. Destroyed automatically on transition.
     */
    readonly world: Container;

    /**
     * HUD/menu root, drawn above the world. Keep interactive elements inside
     * the design area so they stay on screen. Destroyed automatically on transition.
     */
    readonly ui: Container;

    /** Navigate to other screens. */
    readonly screens: ScreenManager;

    /** Pointer input scoped to this screen (already bound to a full-screen hit area). */
    readonly input: PointerInput;

    /** Asset access with progress reporting. */
    readonly assets: AssetLoader;

    /** Viewport scaling, orientation and breakpoint info. */
    readonly responsive: Responsive;
}

/**
 * A screen (menu, level, ...) as a plain object composed of display
 * objects and behaviors — no inheritance from a scene base class.
 *
 * Screens may declare a `params` type: data handed over by the previous
 * screen at transition time (e.g. the final score for a game-over screen).
 * Screens that don't need data use the default `void`.
 */
export interface Screen<P = void> {
    /** Build the screen. May be async to load assets; `update()` runs meanwhile. */
    init(context: ScreenContext, params: P): Promise<void> | void;

    /** Optional per-frame hook, called while the screen is active. `dt` in milliseconds. */
    update?(dt: number): void;

    /** Optional hook fired whenever the viewport changes (resize, orientation, breakpoint). */
    onResize?(viewport: ViewportMetrics): void;

    /** Optional teardown hook — release subscriptions and owned resources. */
    destroy?(): void;
}

export type ScreenFactory<P = void> = (params: P) => Screen<P>;
