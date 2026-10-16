import { ASSETS, COLORS, SCREENS, SCREEN_CENTER } from '../config';
import { createColorBackground, createTextureBackground } from '../core/display/Background';
import { createLabel } from '../core/display/Label';
import type { Unsubscribe } from '../core/input/PointerInput';
import type { Screen, ScreenContext } from '../core/screens/Screen';

export class GameScreen implements Screen {
    private stopListening: Unsubscribe | null = null;

    init(context: ScreenContext): void {
        const { world, ui, assets, input, screens, responsive } = context;

        // This is the "game world": put sprites, parallax and gameplay here.
        world.addChild(createColorBackground(COLORS.game, responsive));
        world.addChild(createTextureBackground(assets.texture(ASSETS.background), responsive, 0.5));

        // HUD and prompts go in the ui layer.
        const message = createLabel(
            'Make something fun!\nBuilt with PixiJS + TypeScript',
        );
        message.anchor.set(0.5);
        message.position.set(SCREEN_CENTER.x, SCREEN_CENTER.y);
        ui.addChild(message);

        this.stopListening = input.once(() => {
            void screens.start(SCREENS.GameOver);
        });
    }

    destroy(): void {
        this.stopListening?.();
        this.stopListening = null;
    }
}
