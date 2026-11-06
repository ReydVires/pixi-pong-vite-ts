import { Container } from 'pixi.js';
import { ASSETS, COLORS, FONTS, SCREENS, SCREEN_CENTER } from '../config';
import { createColorBackground, createTextureBackground } from '../core/display/background';
import { createImage } from '../core/display/image';
import { ProgressBar } from '../core/display/ProgressBar';
import type { Screen, ScreenContext } from '../core/screens/screen';
import type { Nullable } from '../core/types';

/** Share of the logo's native size — roughly what the HTML splash shows. */
const LOGO_SCALE = 0.55;
/** The logo rides high; the progress bar waits underneath it. */
const LOGO_Y = SCREEN_CENTER.y - 90;
const BAR_Y = SCREEN_CENTER.y + 90;

/**
 * Loads the game's assets behind a progress bar, then hands over to the menu.
 */
export class PreloaderScreen implements Screen {
    private bar: Nullable<ProgressBar> = null;
    /** Set by `destroy()`; checked once the load finishes. */
    private disposed = false;

    async init(context: ScreenContext, _params: void): Promise<void> {
        const { world, ui, assets, screens, responsive } = context;

        world.addChild(createColorBackground(COLORS.clear, responsive));

        const backdrop = new Container();
        world.addChild(backdrop);

        await assets.loadFont(FONTS.display);

        const logoTexture = await assets.load(ASSETS.logo);
        const logo = createImage(logoTexture);
        logo.setSize(LOGO_SCALE * logo.width, LOGO_SCALE * logo.height);
        logo.position.set(SCREEN_CENTER.x, LOGO_Y);
        world.addChild(logo);

        const bar = new ProgressBar();
        bar.view.position.set(SCREEN_CENTER.x, BAR_Y);
        ui.addChild(bar.view);
        this.bar = bar;

        const backdropTexture = await assets.load(ASSETS.background, (progress) => bar.setProgress(progress));
        backdrop.addChild(createTextureBackground(backdropTexture, responsive));
        bar.setProgress(1);
        await bar.settle();

        // The screen may have been torn down while loading — don't transition then.
        if (this.disposed) return;

        await screens.start(SCREENS.MainMenu);
    }

    update(dt: number): void {
        this.bar?.update(dt);
    }

    destroy(): void {
        this.disposed = true;
        this.bar?.destroy();
        this.bar = null;
    }
}
