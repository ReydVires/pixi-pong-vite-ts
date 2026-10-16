import { ASSETS, COLORS, SCREENS, SCREEN_CENTER } from '../config';
import { createColorBackground, createTextureBackground } from '../core/display/Background';
import { createLabel } from '../core/display/Label';
import type { Unsubscribe } from '../core/input/PointerInput';
import type { Screen, ScreenContext } from '../core/screens/Screen';

/** Data carried across the Pong → GameOver transition. */
export interface GameOverParams {
    playerScore: number;
    aiScore: number;
}

export class GameOverScreen implements Screen<GameOverParams> {
    private stopListening: Unsubscribe | null = null;

    init(context: ScreenContext, params: GameOverParams): void {
        const { world, ui, assets, input, screens, responsive } = context;

        world.addChild(createColorBackground(COLORS.gameOver, responsive));
        world.addChild(createTextureBackground(assets.texture(ASSETS.background), responsive, 0.5));

        const label = createLabel('Game Over', { fontSize: 64 });
        label.anchor.set(0.5);
        label.position.set(SCREEN_CENTER.x, SCREEN_CENTER.y - 80);
        ui.addChild(label);

        // The final score, handed over by the previous screen via `start()`.
        const score = createLabel(`${params.playerScore} : ${params.aiScore}`, { fontSize: 48 });
        score.anchor.set(0.5);
        score.position.set(SCREEN_CENTER.x, SCREEN_CENTER.y + 20);
        ui.addChild(score);

        const won = params.playerScore > params.aiScore;
        const verdict = createLabel(won ? 'You win!' : 'AI wins', { fontSize: 28 });
        verdict.anchor.set(0.5);
        verdict.position.set(SCREEN_CENTER.x, SCREEN_CENTER.y + 100);
        ui.addChild(verdict);

        this.stopListening = input.once(() => {
            void screens.start(SCREENS.MainMenu);
        });
    }

    destroy(): void {
        this.stopListening?.();
        this.stopListening = null;
    }
}
