import { ASSETS, COLORS, SCREENS, SCREEN_CENTER } from '../config';
import { createColorBackground, createTextureBackground } from '../core/display/Background';
import { ProgressBar } from '../core/display/ProgressBar';
import type { Screen, ScreenContext } from '../core/screens/Screen';

/**
 * Merges the old Boot + Preloader scenes: draws a backdrop, loads the
 * first texture, then loads the remaining assets behind an animated
 * progress bar before handing over to the main menu.
 */
export class PreloaderScreen implements Screen {
    private bar: ProgressBar | null = null;

    async init(context: ScreenContext, _params: void): Promise<void> {
        const { world, ui, assets, screens, responsive } = context;

        world.addChild(createColorBackground(COLORS.clear, responsive));

        // Phase 1: minimal backdrop asset so the loading UI has something behind it.
        const background = await assets.load(ASSETS.background);
        world.addChild(createTextureBackground(background, responsive));

        // Phase 2: the rest of the game's assets, behind a progress bar.
        const bar = new ProgressBar();
        bar.view.position.set(SCREEN_CENTER.x, SCREEN_CENTER.y);
        ui.addChild(bar.view);
        this.bar = bar;

        await assets.load(ASSETS.logo, (progress) => bar.setProgress(progress));
        bar.setProgress(1);
        await bar.settle();

        // The screen may have been torn down while loading — don't transition then.
        if (this.bar !== bar) return;

        await screens.start(SCREENS.MainMenu);
    }

    update(dt: number): void {
        this.bar?.update(dt);
    }

    destroy(): void {
        this.bar?.destroy();
        this.bar = null;
    }
}
