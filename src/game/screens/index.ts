import { SCREENS } from '../config';
import type { ScreenManager } from '../core/screens/ScreenManager';
import { CelebrationScreen } from './CelebrationScreen';
import { MainMenuScreen } from './MainMenuScreen';
import { PreloaderScreen } from './PreloaderScreen';
import type { PlayParams } from './PlayScreen';

/**
 * The route map: every screen key and the params its `init()` accepts.
 *
 * Core's `ScreenRoutes` interface ships empty; the game declares the real
 * routes here by merging into it, which is what lets `register()` below and
 * every `start()` in the game check keys and payloads against one table.
 */
declare module '../core/screens/screen' {
    interface ScreenRoutes {
        /** Boot: loads the shared assets behind a progress bar. */
        Preloader: void;
        /** Title screen. */
        MainMenu: void;
        /** One stage — the params say which. */
        Play: PlayParams;
        /** The birthday present reveal. */
        Celebration: void;
        /** The birthday letter. */
        Letter: void;
    }
}

/** Wire every screen the game knows about into the screen manager. */
export function registerScreens(screens: ScreenManager): void {
    screens
        .register(SCREENS.Preloader, () => new PreloaderScreen())
        .register(SCREENS.MainMenu, () => new MainMenuScreen())
        .register(SCREENS.Play, async () => {
            const { PlayScreen } = await import('./PlayScreen');
            return new PlayScreen();
        })
        .register(SCREENS.Celebration, async () => new CelebrationScreen())
        .register(SCREENS.Letter, async () => {
            const { LetterScreen } = await import('./LetterScreen');
            return new LetterScreen();
        });
}
