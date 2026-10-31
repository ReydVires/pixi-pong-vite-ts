import { Container, Graphics, Rectangle } from 'pixi.js';
import { DropIn } from '../components/DropIn';
import { FlyOff } from '../components/FlyOff';
import { PopOut } from '../components/PopOut';
import { Punch } from '../components/Punch';
import { CELEBRATION, COLORS, SCREEN_CENTER } from '../config';
import type { AssetLoader } from '../core/assets/AssetLoader';
import { createImage } from '../core/display/image';
import { Entity } from '../core/entities/Entity';
import type { Nullable } from '../core/types';
import { CAPY_TYPES } from '../levels/capyTypes';
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
/** Height of the idle hover, in design px, and its phase divisor. */
const GIFT_BOB = 7;
const BOB_PHASE_MS = 620;
/** How long the box stays punched after it opens, in ms, and how far it grows. */
const GIFT_PUNCH_MS = 320;
const GIFT_PUNCH = 0.28;

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
const UNTIE_GROWTH = 0.2;

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
/** The slow sway once it has landed: ±0.05 rad, one cycle ≈ 3.3s. */
const FACE_SWAY = 0.05;
const FACE_SWAY_MS = 520;

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
 * It hosts no clocks of its own: `DropIn` lands and hovers it, `Punch` runs the
 * open beat, `FlyOff` takes the ribbon away and `PopOut` springs the capy. The
 * one tap plays all three and fires `onOpen` in the same beat, so the screen's
 * fireworks land *with* the punch rather than after it.
 *
 * Built through `Gift.create(assets, options)` because the art is optional:
 * whatever `CELEBRATION.gift` points at is used when the file exists, and a
 * drawn box stands in when it does not — a missing asset is the expected state
 * until the art is dropped in, never a broken ending. Either way the capy is
 * inside it.
 */
export class Gift extends Entity {
    private readonly onOpen: () => void;
    private punch: Nullable<Punch> = null;
    private untie: Nullable<FlyOff> = null;
    private pop: Nullable<PopOut> = null;
    private opened = false;

    private constructor(options: GiftOptions) {
        super();
        this.onOpen = options.onOpen;
    }

    /** The present itself: the supplied picture when it loads, a drawn box when it does not. */
    static async create(assets: AssetLoader, options: GiftOptions): Promise<Gift> {
        const gift = new Gift(options);

        const art = (await gift.loadArt(assets)) ?? Gift.drawBox();
        const face = gift.buildFace(art.top);
        // The capy goes in *behind* the art. That is the whole trick — the box
        // hides its chin, so it reads as leaning out of the present, and no
        // artwork has to be split into a front and a back to sell it.
        gift.addChild(face.view, art.view);

        gift.addComponent(
            new DropIn(gift, {
                startY: options.startY,
                restY: GIFT_Y,
                ms: GIFT_DROP_MS,
                bobAmplitude: GIFT_BOB,
                bobPhaseMs: BOB_PHASE_MS,
            }),
        );
        gift.punch = gift.addComponent(new Punch(gift, { amount: GIFT_PUNCH, ms: GIFT_PUNCH_MS }));

        if (art.ribbon) {
            gift.untie = gift.addComponent(
                new FlyOff(art.ribbon, {
                    rise: UNTIE_RISE,
                    spin: UNTIE_SPIN,
                    growth: UNTIE_GROWTH,
                    ms: UNTIE_MS,
                }),
            );
        }

        gift.pop = gift.addComponent(
            new PopOut(face.view, {
                restY: face.restY,
                rise: FACE_RISE,
                ms: FACE_POP_MS,
                spring: FACE_SPRING,
                swayRadians: FACE_SWAY,
                swayPhaseMs: FACE_SWAY_MS,
            }),
        );

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

        this.punch?.start();
        this.untie?.start();
        this.pop?.start();

        this.onOpen();
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
    private buildFace(artTop: number): { view: Container; restY: number } {
        const face = new Container();
        const art = new Graphics();

        drawCapyFace(art, FACE_RADIUS, CAPY_TYPES.normal);

        const cheekY = FACE_RADIUS * 0.06;
        art.ellipse(-FACE_RADIUS * 0.76, cheekY, FACE_RADIUS * 0.15, FACE_RADIUS * 0.11)
            .fill({ color: COLORS.accent, alpha: 0.45 });
        art.ellipse(FACE_RADIUS * 0.76, cheekY, FACE_RADIUS * 0.15, FACE_RADIUS * 0.11)
            .fill({ color: COLORS.accent, alpha: 0.45 });

        face.addChild(art);

        const restY = artTop - FACE_RADIUS * FACE_SEAT;
        face.position.set(0, restY);
        face.visible = false;

        return { view: face, restY };
    }
}
