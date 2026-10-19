import type { Text } from 'pixi.js';
import { Pulse } from '../components/Pulse';
import { Spin } from '../components/Spin';
import { ASSETS, COLORS, SCREENS, SCREEN_CENTER } from '../config';
import { createColorBackground, createTextureBackground } from '../core/display/Background';
import { createButton } from '../core/display/Button';
import { createImage } from '../core/display/Image';
import { createLabel } from '../core/display/Label';
import { Entity } from '../core/entities/Entity';
import type { Unsubscribe } from '../core/input/PointerInput';
import type { ViewportMetrics } from '../core/responsive/Responsive';
import type { Screen, ScreenContext } from '../core/screens/Screen';
import { FIRST_STAGE_ID } from '../levels/stages';

export class MainMenuScreen implements Screen {
    private readonly entities: Entity[] = [];
    private stopListening: Unsubscribe | null = null;
    private info: Text | null = null;

    init(context: ScreenContext, _params: void): void {
        const { world, ui, assets, screens, responsive } = context;

        // Backdrop lives in the world layer so it can bleed past the design area.
        world.addChild(createColorBackground(COLORS.clear, responsive));
        world.addChild(createTextureBackground(assets.texture(ASSETS.background), responsive));

        // Menu chrome lives in the ui layer, always inside the design area.
        const logo = new Entity();
        const logoImage = createImage(assets.texture(ASSETS.logo));
        logoImage.setSize(0.5 * logoImage.width, 0.5 * logoImage.height);
        logo.addChild(logoImage);
        logo.position.set(SCREEN_CENTER.x, SCREEN_CENTER.y - 200);
        // Two behaviors composed onto one entity — they stack automatically.
        logo.addComponent(new Spin(logo, { speed: 30 }));
        logo.addComponent(new Pulse(logo, { periodMs: 1500 }));
        ui.addChild(logo);
        this.entities.push(logo);

        const play = createButton('Play', () => {
            this.stopListening?.();
            this.stopListening = null;
            void screens.start(SCREENS.Play, { stageId: FIRST_STAGE_ID });
        }, { width: 340, height: 88, fontSize: 40 });
        play.position.set(SCREEN_CENTER.x, SCREEN_CENTER.y + 140);
        ui.addChild(play);

        // Show a tiny blurb so first-time players know the tutorial is ahead
        const tut = createLabel(
            'Starts with a quick tutorial — tap the first mouse, then they escape',
            { fontSize: 16, fill: COLORS.white },
        );
        tut.anchor.set(0.5);
        tut.position.set(SCREEN_CENTER.x, SCREEN_CENTER.y + 230);
        ui.addChild(tut);

        // Demonstrates reacting to the live viewport (orientation + breakpoint).
        this.info = createLabel('', { fontSize: 18, fill: COLORS.white });
        this.info.anchor.set(0.5);
        ui.addChild(this.info);
        this.layout(responsive.viewport);
    }

    update(dt: number): void {
        for (const entity of this.entities) {
            entity.update(dt);
        }
    }

    onResize(viewport: ViewportMetrics): void {
        this.layout(viewport);
    }

    destroy(): void {
        this.stopListening?.();
        this.stopListening = null;
        this.entities.length = 0;
        this.info = null;
    }

    /** Pin the status label to the bottom of the *visible* area, not the design area. */
    private layout(viewport: ViewportMetrics): void {
        if (!this.info) return;

        const { visibleBounds } = viewport;
        this.info.text = `from ${viewport.breakpoint} · @2026`;
        this.info.position.set(SCREEN_CENTER.x, visibleBounds.y + visibleBounds.height - 40);
    }
}
