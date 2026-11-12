import { Graphics } from 'pixi.js';
import type { Text } from 'pixi.js';
import { SFX } from '../audio/sfx';
import { CELEBRATION, COLORS, SCREENS, SCREEN_CENTER } from '../config';
import { EffectsPool } from '../components/EffectsPool';
import { FireworksPool } from '../components/FireworksPool';
import { createColorBackground } from '../core/display/background';
import { createLabel } from '../core/display/label';
import { FadeCover, tickCover } from '../core/display/FadeCover';
import { Entity } from '../core/ecs/Entity';
import type { Screen, ScreenContext } from '../core/screens/screen';
import type { Nullable } from '../core/types';
import { Gift, GIFT_Y, giftStartY } from '../entities/Gift';
import { WishPanel, LOWER_TEXT_Y } from '../ui/WishPanel';

/**
 * The birthday reveal.
 *
 * The last stage's results panel sends the player here through a button that
 * looks exactly like every other stage's "Next", so the present arrives as a
 * surprise. Fireworks play over the night sky the whole time, the present drops
 * in and waits to be tapped, and opening it is what shows the wish.
 *
 * The present itself is a composed actor (`entities/Gift`): it owns its art —
 * the optional picture, the drawn stand-in, the capy inside — and every
 * animation it does to itself. This screen keeps the orchestration: the sky,
 * the hint, the wish, and the side effects of the one tap that opens the box.
 */
export class CelebrationScreen implements Screen {
    private context: Nullable<ScreenContext> = null;
    private sky: Nullable<Entity> = null;
    private effects: Nullable<EffectsPool> = null;
    private fireworks: Nullable<FireworksPool> = null;

    private gift: Nullable<Gift> = null;
    private hint: Nullable<Text> = null;
    private wish: Nullable<WishPanel> = null;
    /** Black sheet the screen fades up from on arrival. */
    private cover: Nullable<FadeCover> = null;

    async init(context: ScreenContext, _params: void): Promise<void> {
        const { world, ui, assets, responsive } = context;
        this.context = context;

        world.addChild(createColorBackground(COLORS.sky, responsive));

        // Fireworks go in their own layer *behind* the present, so a burst can
        // never hide the thing the player is meant to tap. The layer is an
        // entity hosting both pools, so ticking it drives the whole show.
        const sky = new Entity();
        world.addChild(sky);
        this.sky = sky;
        this.effects = sky.addComponent(new EffectsPool(sky));

        // A pool of light under the present: on a dark screen it is what makes
        // the box the bright object, rather than one more shape on the sky.
        const glow = new Graphics().circle(0, 0, 260).fill({ color: COLORS.star, alpha: 0.12 });
        glow.position.set(SCREEN_CENTER.x, GIFT_Y);
        world.addChild(glow);

        this.hint = createLabel('Tap the present', { fontSize: 30 });
        this.hint.anchor.set(0.5);
        this.hint.position.set(SCREEN_CENTER.x, LOWER_TEXT_Y);
        ui.addChild(this.hint);

        this.wish = new WishPanel(ui, {
            name: CELEBRATION.name,
            title: CELEBRATION.title,
            message: CELEBRATION.message,
            onReadLetter: () => {
                this.context?.audio.play(SFX.tap);
                void this.context?.screens.start(SCREENS.Letter);
            },
        });

        // Staggered from the first frame, then random from there.
        this.fireworks = sky.addComponent(new FireworksPool(this.effects, responsive));
        this.fireworks.start();

        this.cover = new FadeCover(ui, responsive);

        this.gift = await Gift.create(assets, {
            // Re-read every frame, so a resize mid-drop still falls in from
            // outside the screen rather than from inside the letterbox.
            startY: () => giftStartY(this.context?.responsive.visibleBounds),
            onOpen: () => this.onGiftOpened(),
        });
        world.addChild(this.gift);
    }

    update(dt: number): void {
        if (!this.gift) return;

        this.sky?.update(dt); // drives the effects pool and the fireworks together
        this.gift?.update(dt);

        this.cover = tickCover(this.cover, dt);

        this.wish?.update(dt);
    }

    destroy(): void {
        this.sky = null;
        this.effects = null;
        this.fireworks = null;
        this.context = null;
        this.gift = null;
        this.hint = null;
        this.wish = null;
        this.cover = null;
    }

    // --- The present --------------------------------------------------------

    /**
     * The side effects of the one tap that opens the box: the win, the hint
     * handing over to the wish, and the present's own volley of fireworks.
     * Everything the box does to *itself* (punch, ribbon, capy) lives in `Gift`.
     */
    private onGiftOpened(): void {
        // The flourish lands with the punch, not after it — the whole point of
        // the reveal is that everything happens on this one tap.
        this.context?.audio.play(SFX.win);

        if (this.hint) this.hint.visible = false;
        this.wish?.reveal();

        const { x, y } = this.gift?.position ?? SCREEN_CENTER;
        this.fireworks?.volley(x, y);
    }
}
