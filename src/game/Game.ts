import { Application } from 'pixi.js';
import { CLEAR_COLOR, GAME_HEIGHT, GAME_WIDTH, SCREENS } from './config';
import { AssetLoader } from './core/assets/AssetLoader';
import { Responsive } from './core/responsive/Responsive';
import { ScreenManager } from './core/screens/ScreenManager';
import { registerScreens } from './screens';

/**
 * Composition root: builds the Pixi application and every long-lived
 * service, wires the screens together, and starts the first screen.
 */
export class Game {
    readonly app = new Application();
    readonly assets = new AssetLoader();
    readonly responsive: Responsive;
    readonly screens: ScreenManager;

    constructor() {
        this.responsive = new Responsive(this.app);
        this.screens = new ScreenManager(this.app, this.assets, this.responsive);
        registerScreens(this.screens);
    }

    /** Initialize the renderer, mount the canvas and start the first screen. */
    async start(parentId: string): Promise<this> {
        const parent = document.getElementById(parentId);
        if (!parent) {
            throw new Error(`Game parent element "#${parentId}" not found in the DOM.`);
        }

        await this.app.init({
            width: GAME_WIDTH,
            height: GAME_HEIGHT,
            background: CLEAR_COLOR,
            resolution: devicePixelRatio,
            autoDensity: true,
            antialias: true,
        });

        parent.appendChild(this.app.canvas);

        // Fit the renderer to the viewport and keep it in sync on resize.
        this.responsive.attach(parent);

        // Expose the running game in dev builds so it can be poked at from the console.
        if (import.meta.env.DEV) {
            (globalThis as { game?: Game }).game = this;
        }

        await this.screens.start(SCREENS.Preloader);
        return this;
    }

    /** Tear down the active screen and the renderer. */
    destroy(): void {
        this.screens.dispose();
        this.responsive.destroy();
        this.app.destroy(true);
    }
}
