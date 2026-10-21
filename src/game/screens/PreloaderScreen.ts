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

    async init(context: ScreenContext, _params: void): Promise<void> {
        const { world, ui, assets, screens, responsive } = context;

        world.addChild(createColorBackground(COLORS.clear, responsive));

        // Phase 1: the display font first (so every later label wears it),
        // then the logo — the mark the splash screen is already showing, and
        // the screen's anchor through the rest of the load. It is not tracked
        // in a field: it is a world child, so teardown takes it along.
        await assets.loadFont(FONTS.display);
        const logoTexture = await assets.load(ASSETS.logo);
        const logo = createImage(logoTexture);
        logo.setSize(LOGO_SCALE * logo.width, LOGO_SCALE * logo.height);
        logo.position.set(SCREEN_CENTER.x, LOGO_Y);
        world.addChild(logo);

        // Phase 2: the backdrop, behind a progress bar waiting under the logo.
        const bar = new ProgressBar();
        bar.view.position.set(SCREEN_CENTER.x, BAR_Y);
        ui.addChild(bar.view);
        this.bar = bar;

        const backdrop = await assets.load(ASSETS.background, (progress) => bar.setProgress(progress));
        // The backdrop draws above whatever the world already holds, so the
        // logo is re-appended after it — `addChild` moves an existing child,
        // it does not duplicate it.
        world.addChild(createTextureBackground(backdrop, responsive));
        world.addChild(logo);
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
