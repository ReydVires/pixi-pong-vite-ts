import { SCREENS } from '../config';
import type { ScreenManager } from '../core/screens/ScreenManager';
import { CelebrationScreen } from './CelebrationScreen';
import { MainMenuScreen } from './MainMenuScreen';
import { PreloaderScreen } from './PreloaderScreen';

/** Wire every screen the game knows about into the screen manager. */
export function registerScreens(screens: ScreenManager): void {
    screens
        .register(SCREENS.Preloader, () => new PreloaderScreen())
        .register(SCREENS.MainMenu, () => new MainMenuScreen())
        .register(SCREENS.Play, async () => {
            const { PlayScreen } = await import('./PlayScreen');
            return new PlayScreen();
        })
        .register(SCREENS.Celebration, () => new CelebrationScreen())
        .register(SCREENS.Letter, async () => {
            const { LetterScreen } = await import('./LetterScreen');
            return new LetterScreen();
        });
}
