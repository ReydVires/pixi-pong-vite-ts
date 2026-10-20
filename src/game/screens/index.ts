import { SCREENS } from '../config';
import type { ScreenManager } from '../core/screens/ScreenManager';
import { CelebrationScreen } from './CelebrationScreen';
import { LetterScreen } from './LetterScreen';
import { MainMenuScreen } from './MainMenuScreen';
import { PlayScreen } from './PlayScreen';
import { PreloaderScreen } from './PreloaderScreen';

/** Wire every screen the game knows about into the screen manager. */
export function registerScreens(screens: ScreenManager): void {
    screens
        .register(SCREENS.Preloader, () => new PreloaderScreen())
        .register(SCREENS.MainMenu, () => new MainMenuScreen())
        .register(SCREENS.Play, () => new PlayScreen())
        .register(SCREENS.Celebration, () => new CelebrationScreen())
        .register(SCREENS.Letter, () => new LetterScreen());
}
