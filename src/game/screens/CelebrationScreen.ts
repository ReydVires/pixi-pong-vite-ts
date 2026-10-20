import { Container, Graphics, Rectangle } from 'pixi.js';
import type { Text } from 'pixi.js';
import { SFX } from '../audio/sfx';
import { Burst } from '../components/Burst';
import { CELEBRATION, COLORS, SCREENS, SCREEN_CENTER } from '../config';
import type { AssetLoader } from '../core/assets/AssetLoader';
import { createColorBackground } from '../core/display/background';
import { createImage } from '../core/display/image';
import { createLabel } from '../core/display/label';
import { createSceneButton } from '../core/display/sceneButton';
import type { Screen, ScreenContext } from '../core/screens/screen';
import { drawCapyFace } from '../entities/capyFace';
import { CAPY_TYPES } from '../levels/capyTypes';
import { FIREWORK_COLORS, nextFirework } from '../systems/fireworks';
import type { Firework } from '../systems/fireworks';
import type { BurstOptions } from '../systems/particles';

/** Where the present comes to rest, and where it falls in from. */
const GIFT_Y = 500;
const GIFT_FALL_FROM = -320;
/** Longest side the present may occupy, in design px. */
const GIFT_MAX_SIZE = 340;
/** How long the drop takes, in ms. */
const GIFT_DROP_MS = 900;
/** How long the box stays punched after it opens, in ms. */
const GIFT_PUNCH_MS = 320;
/** Height of the idle hover, in design px. */
const GIFT_BOB = 7;

/**
 * How the ribbon comes off when the present opens.
 *
 * It has to actually leave: the bow is drawn above the lid, which is exactly
 * where the capy's snout ends up, so a ribbon left tied on would sit across its
 * face for the rest of the screen.
 */
const UNTIE_MS = 460;
const UNTIE_RISE = 150;
const UNTIE_SPIN = 0.5;

/**
 * The capy in the box, and how it gets out.
 *
 * `FACE_RADIUS` is the head the holes draw, blown up. `FACE_SEAT` is how far
 * above the present's lid its centre rests, and that is what decides the whole
 * look: the lid cuts the head off at that line, so the seat is set just clear of
 * the nose so the animal reads as a capybara rather than a pair of ears over a
 * box. `FACE_RISE` is how far down inside the present it starts, and
 * `FACE_SPRING` makes the rise overshoot its resting height — the point of a
 * jack-in-the-box is that it overshoots, and the budget for that overshoot is
 * what sets `WISH_Y` where it is.
 */
const FACE_RADIUS = 104;
const FACE_SEAT = 0.7;
const FACE_RISE = 150;
const FACE_POP_MS = 620;
const FACE_SPRING = 1.8;

/** How long the wish takes to fade in once the box is open, in ms. */
const REVEAL_FADE_MS = 600;
/** Fade up from black as the screen arrives, in ms. */
const FADE_IN_MS = 650;
/** Share of the visible height fireworks may use — the rest is the ground. */
const SKY_FRACTION = 0.55;
/** Bursts set off by the box itself when it opens. */
const OPENING_VOLLEY = 4;

/**
 * A firework hangs where a whack's sparks would have dropped: lighter gravity
 * and a longer life, so each one blooms and drifts instead of snapping off.
 */
const FIREWORK_BURST = { count: 26, speed: [180, 620], lifeMs: [500, 1100], size: [3, 8], gravity: 320 } as const;

/** Colours of the drawn stand-in present, in the game's own palette. */
const BOX_FILL = 0xff8fab;
const BOX_LID = 0xef6f92;
/** Local y of the drawn box's lid — the line the capy's chin is tucked behind. */
const BOX_TOP = -136;

/**
 * Vertical rhythm of the reveal, top to bottom.
 *
 * The lines above the present are packed as tightly as they are because the
 * capy has to spring out of the box *underneath* the title: its ears clear
 * `WISH_Y` even at the top of the pop's overshoot, on the lowest pass of the
 * box's hover at the same time.
 */
const NAME_Y = 64;
const WISH_Y = 128;
/** The line under the present: the "tap it" hint, then the wish — never both. */
const LOWER_TEXT_Y = 700;
/** Where the screen's primary button sits, and the way out below it. */
const PRIMARY_Y = 860;
const MENU_Y = 950;

/** The present's art, and where its top edge sits in the gift's own space. */
interface GiftArt {
    readonly view: Container;
    /** The lid, not the bow: the capy leans out over this line. */
    readonly top: number;
    /**
     * The drawn present's ribbon, or `null` when the art is a supplied picture.
     * Its own layer because ribbon is tied on last and comes off first.
     */
    readonly ribbon: Container | null;
}

/**
 * The birthday reveal.
 *
 * The last stage's Results sends the player here through a button that looks
 * exactly like every other stage's "Next", so the present arrives as a
 * surprise. Fireworks play over the night sky the whole time, the present drops
 * in and waits to be tapped, and opening it is what shows the wish.
 *
 * The picture is optional: whatever `CELEBRATION.gift` points at is used when
 * the file exists, and a drawn box stands in when it does not — a missing asset
 * is the expected state until the art is dropped in, never a broken ending.
 * Either way the capy is inside it, and tapping the present is what lets it out.
 */
export class CelebrationScreen implements Screen {
    private context: ScreenContext | null = null;
    private readonly bursts: Burst[] = [];

    private skyLayer: Container | null = null;
    private uiLayer: Container | null = null;
    private gift: Container | null = null;
    /** The capy living in the present, hidden until the box is opened. */
    private face: Container | null = null;
    /** The drawn present's ribbon, taken off when the box is opened. */
    private ribbon: Container | null = null;
    /** Local y the popped capy's centre rests at, sitting on the present's lid. */
    private faceRestY = 0;
    private hint: Text | null = null;
    private wish: Container | null = null;
    /** Black sheet the screen fades up from on arrival. */
    private veil: Graphics | null = null;

    /** The next firework to set off, and the wait before it. */
    private firework: Firework = { delayMs: 0, x: 0, y: 0, color: COLORS.white };
    private pending = 0;

    private dropLeft = 0;
    private bobTime = 0;
    private giftPunch = 0;
    /** Time left on the capy's spring out of the box. */
    private popLeft = 0;
    /** Time left on the ribbon coming off. */
    private untieLeft = 0;
    /** Free-running clock for the head's idle sway. */
    private faceTime = 0;
    private fadeLeft = FADE_IN_MS;
    private opened = false;

    async init(context: ScreenContext, _params: void): Promise<void> {
        const { world, ui, assets, screens, responsive } = context;
        this.context = context;
        this.uiLayer = ui;

        world.addChild(createColorBackground(COLORS.sky, responsive));

        // Fireworks go in their own layer *behind* the present, so a burst can
        // never hide the thing the player is meant to tap.
        this.skyLayer = new Container();
        world.addChild(this.skyLayer);

        // A pool of light under the present: on a dark screen it is what makes
        // the box the bright object, rather than one more shape on the sky.
        const glow = new Graphics().circle(0, 0, 260).fill({ color: COLORS.star, alpha: 0.12 });
        glow.position.set(SCREEN_CENTER.x, GIFT_Y);
        world.addChild(glow);

        this.gift = await this.buildGift(assets);
        this.gift.position.set(SCREEN_CENTER.x, this.giftStartY());
        world.addChild(this.gift);
        this.dropLeft = GIFT_DROP_MS;

        this.hint = createLabel('Tap the present', { fontSize: 30 });
        this.hint.anchor.set(0.5);
        this.hint.position.set(SCREEN_CENTER.x, LOWER_TEXT_Y);
        ui.addChild(this.hint);

        this.buildWish();

        // The way out is always on screen: the surprise should never be a trap
        // for someone who does not realise the box is the thing to touch.
        const menu = createSceneButton('Menu', () => {
            this.context?.audio.play(SFX.tap);
            void screens.start(SCREENS.MainMenu);
        });
        menu.position.set(SCREEN_CENTER.x, MENU_Y);
        ui.addChild(menu);

        // Staggered from the first frame, then random from there.
        this.scheduleFirework();
        this.pending = 0;

        const veil = createColorBackground(COLORS.black, responsive);
        ui.addChild(veil);
        this.veil = veil;
    }

    update(dt: number): void {
        this.pending -= dt;
        if (this.pending <= 0) {
            this.throwBurst(this.firework.color, this.firework.x, this.firework.y, FIREWORK_BURST);
            this.scheduleFirework();
        }

        for (let i = this.bursts.length - 1; i >= 0; i--) {
            const burst = this.bursts[i];
            burst.update(dt);
            if (!burst.finished) continue;

            burst.destroy({ children: true });
            this.bursts.splice(i, 1);
        }

        this.updateGift(dt);
        this.updateRibbon(dt);
        this.updateFace(dt);

        if (this.veil) {
            this.fadeLeft = Math.max(0, this.fadeLeft - dt);
            this.veil.alpha = this.fadeLeft / FADE_IN_MS;
        }

        if (this.wish?.visible && this.wish.alpha < 1) {
            this.wish.alpha = Math.min(1, this.wish.alpha + dt / REVEAL_FADE_MS);
        }
    }

    destroy(): void {
        this.bursts.length = 0;
        this.context = null;
        this.skyLayer = null;
        this.uiLayer = null;
        this.gift = null;
        this.face = null;
        this.ribbon = null;
        this.hint = null;
        this.wish = null;
        this.veil = null;
    }

    // --- The present --------------------------------------------------------

    /**
     * Open the present. The one tap is the whole climax: the box punches, its
     * ribbon comes off, the capy springs out of it, its own volley goes up, and
     * the wish fades in underneath.
     */
    private openGift(): void {
        if (this.opened) return;
        this.opened = true;
        this.giftPunch = GIFT_PUNCH_MS;
        this.untieLeft = this.ribbon ? UNTIE_MS : 0;
        // The flourish lands with the punch, not after it — the whole point of
        // the reveal is that everything happens on this one tap.
        this.context?.audio.play(SFX.win);

        if (this.hint) this.hint.visible = false;
        if (this.wish) this.wish.visible = true;

        // Revealed rather than built: the spring starts on the next frame, so
        // nothing is being laid out during the tap it is meant to reward.
        if (this.face) {
            this.face.visible = true;
            this.popLeft = FACE_POP_MS;
        }

        const { x, y } = this.gift?.position ?? SCREEN_CENTER;
        for (let i = 0; i < OPENING_VOLLEY; i++) {
            this.throwBurst(FIREWORK_COLORS[i % FIREWORK_COLORS.length], x, y - 40, {
                count: 26,
                speed: [180, 620],
                lifeMs: [500, 1100],
                size: [3, 8],
                gravity: 380,
            });
        }
    }

    /** Where the drop starts: off the top edge of whatever is visible. */
    private giftStartY(): number {
        const visible = this.context?.responsive.visibleBounds;
        return Math.min(GIFT_FALL_FROM, (visible?.y ?? 0) - GIFT_MAX_SIZE);
    }

    /**
     * Drop the box in, then let it hover.
     *
     * The drop overshoots its resting place and settles back — landing with a
     * bounce is what keeps a still box from reading as part of the backdrop.
     */
    private updateGift(dt: number): void {
        const gift = this.gift;
        if (!gift) return;

        if (this.dropLeft > 0) {
            this.dropLeft = Math.max(0, this.dropLeft - dt);
            const landed = easeOutBack(1 - this.dropLeft / GIFT_DROP_MS);
            const start = this.giftStartY();
            gift.y = start + (GIFT_Y - start) * landed;
        } else {
            this.bobTime += dt;
            gift.y = GIFT_Y + Math.sin(this.bobTime / 620) * GIFT_BOB;
        }

        // Punch and hover touch different channels (scale vs position), so the
        // opening flourish never fights the drop that brought it there.
        if (this.giftPunch > 0) this.giftPunch = Math.max(0, this.giftPunch - dt);
        const punch = 1 + 0.28 * (this.giftPunch / GIFT_PUNCH_MS);
        gift.scale.set(punch);
    }

    /**
     * Lift the ribbon off the present, in the same beat as the punch.
     *
     * It accelerates away and tumbles, which reads as a ribbon pulled free
     * rather than one that has been faded out, and it is left hidden once it is
     * gone — the capy's face is the thing worth looking at from then on.
     */
    private updateRibbon(dt: number): void {
        const ribbon = this.ribbon;
        if (!ribbon || this.untieLeft <= 0) return;

        this.untieLeft = Math.max(0, this.untieLeft - dt);
        const t = 1 - this.untieLeft / UNTIE_MS;

        ribbon.y = -UNTIE_RISE * t * t;
        ribbon.rotation = UNTIE_SPIN * t;
        ribbon.scale.set(1 + 0.2 * t);
        ribbon.alpha = 1 - t;

        if (this.untieLeft === 0) ribbon.visible = false;
    }

    /**
     * Spring the capy out of the present.
     *
     * The rise and the growth share one clock, so there is a single moment where
     * it is at full size and has overshot its resting height — a body that
     * appears and *then* jumps reads as two separate effects. Once it has
     * landed it keeps a slow sway, which is what stops a still face from
     * looking like a sticker on the lid.
     */
    private updateFace(dt: number): void {
        const face = this.face;
        if (!face?.visible) return;

        if (this.popLeft > 0) {
            this.popLeft = Math.max(0, this.popLeft - dt);
            const t = 1 - this.popLeft / FACE_POP_MS;

            face.y = this.faceRestY + FACE_RISE * (1 - easeOutBack(t, FACE_SPRING));
            face.scale.set(0.05 + 0.95 * easeOutBack(Math.min(1, t * 1.4), FACE_SPRING));
            return;
        }

        this.faceTime += dt;
        face.y = this.faceRestY;
        face.scale.set(1);
        face.rotation = Math.sin(this.faceTime / 520) * 0.05;
    }

    /**
     * The present itself: the supplied picture when it loads, a drawn box when
     * it does not, and the capy waiting inside either of them.
     *
     * The capy goes in *behind* the art. That is the whole trick — the box hides
     * its chin, so it reads as leaning out of the present, and no artwork has to
     * be split into a front and a back to sell it.
     */
    private async buildGift(assets: AssetLoader): Promise<Container> {
        const gift = new Container();

        const art = (await this.loadGiftArt(assets)) ?? this.drawGiftBox();
        this.ribbon = art.ribbon;
        gift.addChild(this.buildFace(art.top), art.view);
        // A generous square around the art: a present should be easy to hit, and
        // its own hit area is what makes the box the target rather than the tap
        // needing to land on a drawn edge.
        gift.hitArea = new Rectangle(-GIFT_MAX_SIZE / 2, -GIFT_MAX_SIZE / 2, GIFT_MAX_SIZE, GIFT_MAX_SIZE);
        gift.eventMode = 'static';
        gift.cursor = 'pointer';
        gift.on('pointertap', () => this.openGift());

        return gift;
    }

    /**
     * The picture at `CELEBRATION.gift`, or `null` when there is nothing to
     * load. A missing file is caught here rather than left to reject the whole
     * screen — the ending has to survive its own artwork being absent.
     */
    private async loadGiftArt(assets: AssetLoader): Promise<GiftArt | null> {
        try {
            const texture = await assets.load({ alias: 'gift', src: CELEBRATION.gift });
            const image = createImage(texture);

            // Fit inside a square, whichever side is longer, so the picture
            // keeps its proportions whatever it is replaced with.
            const scale = Math.min(GIFT_MAX_SIZE / texture.width, GIFT_MAX_SIZE / texture.height);
            image.setSize(texture.width * scale, texture.height * scale);

            // A picture has no lid of its own, so its top edge *is* the lid — and
            // no ribbon either, so there is nothing to untie when it opens.
            return { view: image, top: -image.height / 2, ribbon: null };
        } catch {
            return null;
        }
    }

    /**
     * The stand-in present: a pink box with a gold ribbon, drawn in code.
     *
     * The ribbon is a layer of its own, stacked over the box — and therefore
     * over the capy behind it — so opening the present can take it off.
     */
    private drawGiftBox(): GiftArt {
        const box = new Container();

        const art = new Graphics();
        art.roundRect(-150, -104, 300, 216, 18).fill(BOX_FILL);
        art.roundRect(-168, BOX_TOP, 336, 56, 14).fill(BOX_LID);
        box.addChild(art);

        const ribbon = new Container();
        const bands = new Graphics();
        // Ribbon down the middle, tied into a bow above the lid.
        bands.rect(-24, BOX_TOP, 48, 248).fill(COLORS.star);
        bands.circle(-52, -156, 30).stroke({ width: 12, color: COLORS.star });
        bands.circle(52, -156, 30).stroke({ width: 12, color: COLORS.star });
        ribbon.addChild(bands);
        box.addChild(ribbon);

        return { view: box, top: BOX_TOP, ribbon };
    }

    /**
     * The capy in the box.
     *
     * `drawCapyFace` is the very same call the holes make, so this is the
     * character the player has been whacking all game rather than a second capy
     * drawn to look similar — and it keeps matching if that art ever changes.
     * The blush is the celebration's alone: the holes' capys are at work, and
     * this one is the payoff.
     *
     * It sits low enough that the present hides its chin and nothing else —
     * `FACE_SEAT` clears the nose by a couple of pixels, because a capybara
     * without its snout is just a pair of ears. Anything drawn below the lid's
     * line here would never be seen.
     */
    private buildFace(artTop: number): Container {
        const face = new Container();
        const art = new Graphics();

        drawCapyFace(art, FACE_RADIUS, CAPY_TYPES.normal);

        const cheekY = FACE_RADIUS * 0.06;
        art.ellipse(-FACE_RADIUS * 0.76, cheekY, FACE_RADIUS * 0.15, FACE_RADIUS * 0.11)
            .fill({ color: COLORS.accent, alpha: 0.45 });
        art.ellipse(FACE_RADIUS * 0.76, cheekY, FACE_RADIUS * 0.15, FACE_RADIUS * 0.11)
            .fill({ color: COLORS.accent, alpha: 0.45 });

        face.addChild(art);
        this.faceRestY = artTop - FACE_RADIUS * FACE_SEAT;
        face.position.set(0, this.faceRestY);
        face.visible = false;

        // Stored here rather than at the call site so the reveal and the thing
        // being revealed cannot drift apart.
        this.face = face;

        return face;
    }

    // --- The wish -----------------------------------------------------------

    /**
     * The personal lines, built up front and hidden until the box opens.
     *
     * Building them at open time would put text layout in the middle of the one
     * moment that has to feel smooth, so this is a visibility flip and a fade.
     */
    private buildWish(): void {
        const ui = this.uiLayer;
        if (!ui) return;

        const wish = new Container();

        const name = createLabel(CELEBRATION.name, { fontSize: 30, fill: COLORS.star });
        name.anchor.set(0.5);
        name.position.set(SCREEN_CENTER.x, NAME_Y);
        wish.addChild(name);

        const title = createLabel(CELEBRATION.title, { fontSize: 60 });
        title.anchor.set(0.5);
        title.position.set(SCREEN_CENTER.x, WISH_Y);
        wish.addChild(title);

        const message = createLabel(CELEBRATION.message, {
            fontSize: 30,
            align: 'center',
            wordWrap: true,
            wordWrapWidth: 620,
        });
        message.anchor.set(0.5);
        message.position.set(SCREEN_CENTER.x, LOWER_TEXT_Y);
        wish.addChild(message);

        // The letter was the promise the present made; the button now keeps it.
        // Still the accent: the payoff is reading it, and `Menu` is still on
        // screen for anyone who would rather not.
        const letter = createSceneButton('Read the letter', () => {
            this.context?.audio.play(SFX.tap);
            void this.context?.screens.start(SCREENS.Letter);
        }, true);
        letter.position.set(SCREEN_CENTER.x, PRIMARY_Y);
        wish.addChild(letter);

        wish.visible = false;
        wish.alpha = 0;
        ui.addChild(wish);
        this.wish = wish;
    }

    // --- Fireworks ----------------------------------------------------------

    /** Draw the next firework — and its wait — from the sky as it is now. */
    private scheduleFirework(): void {
        const metrics = this.context?.responsive.viewport;
        if (!metrics) return;

        const bounds = metrics.visibleBounds;
        this.firework = nextFirework({
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height * SKY_FRACTION,
        });
        this.pending = this.firework.delayMs;
    }

    private throwBurst(color: number, x: number, y: number, options: Omit<BurstOptions, 'x' | 'y'>): void {
        if (!this.skyLayer) return;

        const burst = new Burst(color, { ...options, x, y });
        this.skyLayer.addChild(burst);
        this.bursts.push(burst);
    }
}

/**
 * Overshoot-and-settle easing, so the present lands with a bounce.
 *
 * `overshoot` is how far past the target it swings; the default is the usual
 * subtle one, and the capy's spring turns it up.
 */
function easeOutBack(t: number, overshoot = 1.70158): number {
    const p = t - 1;

    return 1 + (overshoot + 1) * p * p * p + overshoot * p * p;
}
