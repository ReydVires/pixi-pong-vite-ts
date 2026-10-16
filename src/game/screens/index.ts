import { SCREENS } from '../config';
import type { ScreenManager } from '../core/screens/ScreenManager';
import { GameOverScreen } from './GameOverScreen';
import { MainMenuScreen } from './MainMenuScreen';
import { PongScreen } from './PongScreen';
import { PreloaderScreen } from './PreloaderScreen';

/** Wire every screen the game knows about into the screen manager. */
export function registerScreens(screens: ScreenManager): void {
    screens
        .register(SCREENS.Preloader, () => new PreloaderScreen())
        .register(SCREENS.MainMenu, () => new MainMenuScreen())
        .register(SCREENS.Game, () => new PongScreen())
        .register(SCREENS.GameOver, () => new GameOverScreen());
}
