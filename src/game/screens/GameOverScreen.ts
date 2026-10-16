import { ASSETS, COLORS, SCREENS, SCREEN_CENTER } from '../config';
import { createColorBackground, createTextureBackground } from '../core/display/Background';
import { createLabel } from '../core/display/Label';
import type { Unsubscribe } from '../core/input/PointerInput';
import type { Screen, ScreenContext } from '../core/screens/Screen';

export class GameOverScreen implements Screen {
    private stopListening: Unsubscribe | null = null;

    init(context: ScreenContext): void {
        const { world, ui, assets, input, screens, responsive } = context;

        world.addChild(createColorBackground(COLORS.gameOver, responsive));
        world.addChild(createTextureBackground(assets.texture(ASSETS.background), responsive, 0.5));

        const label = createLabel('Game Over', { fontSize: 64 });
        label.anchor.set(0.5);
        label.position.set(SCREEN_CENTER.x, SCREEN_CENTER.y);
        ui.addChild(label);

        this.stopListening = input.once(() => {
            void screens.start(SCREENS.MainMenu);
        });
    }

    destroy(): void {
        this.stopListening?.();
        this.stopListening = null;
    }
}
