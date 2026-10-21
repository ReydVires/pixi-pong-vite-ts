import { Container, Graphics, Rectangle } from 'pixi.js';
import { CELEBRATION, COLORS, SCREEN_CENTER } from '../config';
import type { AssetLoader } from '../core/assets/AssetLoader';
import { createImage } from '../core/display/image';
import type { Nullable } from '../core/types';
import { CAPY_TYPES } from '../levels/capyTypes';
import { Easing } from '../systems/TweenSystem';
import { drawCapyFace } from './capyFace';

/** Where the present comes to rest, and where it falls in from. */
export const GIFT_Y = 500;
const GIFT_FALL_FROM = -320;
/** Longest side the present may occupy, in design px. */
const GIFT_MAX_SIZE = 340;

/**
 * Where the drop starts: off the top edge of whatever is visible. Takes the
 * viewport's `visibleBounds` (or nothing, before the first resize) so a letterbox
 * margin can never let the present appear inside the frame it is falling into.
 */
export function giftStartY(visibleBounds: Nullable<{ y: number }> | undefined): number {
    return Math.min(GIFT_FALL_FROM, (visibleBounds?.y ?? 0) - GIFT_MAX_SIZE);
}
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
 * jack-in-the-box is that it overshoots.
 */
const FACE_RADIUS = 104;
const FACE_SEAT = 0.7;
const FACE_RISE = 150;
const FACE_POP_MS = 620;
const FACE_SPRING = 1.8;

/** Colours of the drawn stand-in present, in the game's own palette. */
const BOX_FILL = 0xff8fab;
const BOX_LID = 0xef6f92;
/** Local y of the drawn box's lid — the line the capy's chin is tucked behind. */
const BOX_TOP = -136;

/** The present's art, and where its top edge sits in the gift's own space. */
interface GiftArt {
    readonly view: Container;
    /** The lid, not the bow: the capy leans out over this line. */
    readonly top: number;
    /**
     * The drawn present's ribbon, or `null` when the art is a supplied picture.
     * Its own layer because ribbon is tied on last and comes off first.
     */
    readonly ribbon: Nullable<Container>;
}

export interface GiftOptions {
    /**
     * Where the drop starts — off the top edge of whatever is visible. A getter
     * so a resize mid-drop still falls in from outside the screen.
     */
    readonly startY: () => number;
    /** Fired once, on the tap that opens the present. */
    readonly onOpen: () => void;
}

/**
 * The birthday present: a tappable display actor that drops in, hovers, and —
 * when opened — punches, sheds its ribbon and springs a capy out of the box.
 *
 * Built through `Gift.create(assets, options)` because the art is optional:
 * whatever `CELEBRATION.gift` points at is used when the file exists, and a
 * drawn box stands in when it does not — a missing asset is the expected state
 * until the art is dropped in, never a broken ending. Either way the capy is
 * inside it.
 *
 * The screen owns the *side effects* of opening (sound, fireworks, revealing
 * the wish) through `onOpen`; everything the box does to itself lives here.
 */
export class Gift extends Container {
    /** The drawn present's ribbon, taken off when the box is opened. */
    private ribbon: Nullable<Container> = null;
    /** The capy living in the present, hidden until the box is opened. */
    private face: Nullable<Container> = null;
    /** Local y the popped capy's centre rests at, sitting on the present's lid. */
    private faceRestY = 0;

    private readonly startY: () => number;
    private readonly onOpen: () => void;

    private dropLeft = GIFT_DROP_MS;
    private bobTime = 0;
    private giftPunch = 0;
    /** Time left on the capy's spring out of the box. */
    private popLeft = 0;
    /** Time left on the ribbon coming off. */
    private untieLeft = 0;
    /** Free-running clock for the head's idle sway. */
    private faceTime = 0;
    private opened = false;

    private constructor(options: GiftOptions) {
        super();
        this.startY = options.startY;
        this.onOpen = options.onOpen;
    }

    /** The present itself: the supplied picture when it loads, a drawn box when it does not. */
    static async create(assets: AssetLoader, options: GiftOptions): Promise<Gift> {
        const gift = new Gift(options);

        const art = (await gift.loadArt(assets)) ?? Gift.drawBox();
        gift.ribbon = art.ribbon;
        // The capy goes in *behind* the art. That is the whole trick — the box
        // hides its chin, so it reads as leaning out of the present, and no
        // artwork has to be split into a front and a back to sell it.
        gift.addChild(gift.buildFace(art.top), art.view);

        // A generous square around the art: a present should be easy to hit, and
        // its own hit area is what makes the box the target rather than the tap
        // needing to land on a drawn edge.
        gift.hitArea = new Rectangle(-GIFT_MAX_SIZE / 2, -GIFT_MAX_SIZE / 2, GIFT_MAX_SIZE, GIFT_MAX_SIZE);
        gift.eventMode = 'static';
        gift.cursor = 'pointer';
        gift.on('pointertap', () => gift.open());

        gift.position.set(SCREEN_CENTER.x, options.startY());
        return gift;
    }

    get isOpened(): boolean {
        return this.opened;
    }

    /**
     * Open the present. The one tap is the whole climax: the box punches, its
     * ribbon comes off, the capy springs out — and the caller's `onOpen` fires
     * in the same beat, so the flourish lands *with* the punch, not after it.
     */
    open(): void {
        if (this.opened) return;
        this.opened = true;
        this.giftPunch = GIFT_PUNCH_MS;
        this.untieLeft = this.ribbon ? UNTIE_MS : 0;

        // Revealed rather than built: the spring starts on the next frame, so
        // nothing is being laid out during the tap it is meant to reward.
        if (this.face) {
            this.face.visible = true;
            this.popLeft = FACE_POP_MS;
        }

        this.onOpen();
    }

    /** Drop in, hover, punch, and carry the ribbon and the capy through their beats. */
    update(dt: number): void {
        this.updateDrop(dt);
        this.updateRibbon(dt);
        this.updateFace(dt);
    }

    /**
     * Drop the box in, then let it hover.
     *
     * The drop overshoots its resting place and settles back — landing with a
     * bounce is what keeps a still box from reading as part of the backdrop.
     */
    private updateDrop(dt: number): void {
        if (this.dropLeft > 0) {
            this.dropLeft = Math.max(0, this.dropLeft - dt);
            const landed = Easing.easeOutBack(1 - this.dropLeft / GIFT_DROP_MS);
            const start = this.startY();
            this.y = start + (GIFT_Y - start) * landed;
        } else {
            this.bobTime += dt;
            this.y = GIFT_Y + Math.sin(this.bobTime / 620) * GIFT_BOB;
        }

        // Punch and hover touch different channels (scale vs position), so the
        // opening flourish never fights the drop that brought it there.
        if (this.giftPunch > 0) this.giftPunch = Math.max(0, this.giftPunch - dt);
        this.scale.set(1 + 0.28 * (this.giftPunch / GIFT_PUNCH_MS));
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

            face.y = this.faceRestY + FACE_RISE * (1 - Easing.easeOutBack(t, FACE_SPRING));
            face.scale.set(0.05 + 0.95 * Easing.easeOutBack(Math.min(1, t * 1.4), FACE_SPRING));
            return;
        }

        this.faceTime += dt;
        face.y = this.faceRestY;
        face.scale.set(1);
        face.rotation = Math.sin(this.faceTime / 520) * 0.05;
    }

    /**
     * The picture at `CELEBRATION.gift`, or `null` when there is nothing to
     * load. A missing file is caught here rather than left to reject the whole
     * screen — the ending has to survive its own artwork being absent.
     */
    private async loadArt(assets: AssetLoader): Promise<Nullable<GiftArt>> {
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
    private static drawBox(): GiftArt {
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

        this.face = face;
        return face;
    }
}
